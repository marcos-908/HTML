/* Auth + sync explícita do estado não autoritativo. Supabase JS v2 via CDN. */
(function(){
  'use strict';
  const $ = (s, root=document) => root.querySelector(s);
  let client=null, user=null, busy=false;
  const status = (msg, error=false) => { const el=$('#cloud-status'); if(el){el.textContent=msg;el.dataset.error=error?'true':'false';} };
  const config=window.LEVELUP_SUPABASE_CONFIG;
  if(window.supabase?.createClient && config?.url && config?.anonKey && !config.url.includes('SEU-PROJETO') && !config.anonKey.includes('SUA_')) {
    try { client=window.supabase.createClient(config.url,config.anonKey); } catch(e){ console.error('Configuração Supabase inválida',e); }
  }
  function available(){return !!client}
  function safeState(source){const copy=JSON.parse(JSON.stringify(source||{}));delete copy.xp;delete copy.level;delete copy.xpEvents;return copy}
  async function refresh(){
    if(!client){status('Supabase não configurado. O modo local continua funcionando.',true);return null}
    const {data:{session},error}=await client.auth.getSession(); if(error){status('Não foi possível verificar a sessão.',true);return null}
    user=session?.user||null;
    const email=$('#cloud-email'), plan=$('#cloud-plan'), login=$('#cloud-login'), logout=$('#cloud-logout'), sync=$('#cloud-sync'), migrate=$('#cloud-migrate'), recover=$('#cloud-recover');
    if(email)email.textContent=user?user.email:'Nenhuma conta conectada';
    if(login)login.hidden=!!user; if(logout)logout.hidden=!user; if(sync)sync.disabled=!user; if(migrate)migrate.disabled=!user; const restore=$('#cloud-restore'); if(restore)restore.disabled=!user;
    if(plan)plan.textContent=user?'Free (padrão)':'—';
    status(user?'Conectado. Os dados locais não foram alterados.':'Modo local: entre para habilitar recursos da conta.');
    return user;
  }
  async function auth(action){
    if(!client){status('Configure supabase-config.js e execute a migração SQL primeiro.',true);return}
    const email=$('#auth-email')?.value.trim(), password=$('#auth-password')?.value||'';
    if(!email){status('Informe seu e-mail.',true);return}
    busy=true; const submit=$('#cloud-auth-submit');if(submit){submit.disabled=true;submit.textContent='Aguarde…'}
    try {
      let result;
      if(action==='signup') result=await client.auth.signUp({email,password,options:{emailRedirectTo:location.origin+location.pathname}});
      else if(action==='login') result=await client.auth.signInWithPassword({email,password});
      else if(action==='recover') result=await client.auth.resetPasswordForEmail(email,{redirectTo:location.origin+location.pathname});
      if(result?.error) throw result.error;
      if(action==='signup'&&!result.data?.session) status('Cadastro enviado. Confira seu e-mail para confirmar a conta.');
      else if(action==='recover') status('Se o e-mail estiver cadastrado, você receberá um link de recuperação.');
      else status('Autenticação concluída.');
      await refresh();
    } catch(e){status(friendlyError(e),true)} finally {busy=false;if(submit){submit.disabled=false;submit.textContent='Continuar'}}
  }
  function friendlyError(e){const m=String(e?.message||'');if(/Invalid login credentials/i.test(m))return 'E-mail ou senha incorretos.';if(/Email not confirmed/i.test(m))return 'Confirme seu e-mail antes de entrar.';if(/Password should be/i.test(m))return 'A senha não atende aos requisitos mínimos do Supabase.';if(/already registered/i.test(m))return 'Este e-mail já possui cadastro. Tente entrar.';return m||'Não foi possível concluir. Verifique a conexão e a configuração.'}
  async function signOut(){if(!client)return;const {error}=await client.auth.signOut();if(error){status('Não foi possível encerrar a sessão.',true);return}await refresh();status('Sessão encerrada. Os dados locais continuam neste navegador.')}
  function exportLocal(){const data=localStorage.getItem('levelUpData_v1');if(!data)throw new Error('Não há dados locais para exportar.');const blob=new Blob([JSON.stringify({app:'LEVEL UP',exportedAt:new Date().toISOString(),data:JSON.parse(data)},null,2)],{type:'application/json'});const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`level-up-backup-antes-da-nuvem-${new Date().toISOString().slice(0,10)}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
  async function syncLocal(sourceState){
    if(!client||!user)throw new Error('Entre na sua conta primeiro.');
    const raw=sourceState ? JSON.stringify(sourceState) : localStorage.getItem('levelUpData_v1');if(!raw)throw new Error('Não há dados locais para sincronizar.');
    const payload=safeState(JSON.parse(raw));
    const {error}=await client.from('user_app_state').upsert({user_id:user.id,payload,schema_version:1},{onConflict:'user_id'});
    if(error)throw error;
  }
  async function restoreCloud(){
    if(!client||!user)throw new Error('Entre na sua conta primeiro.');
    const {data,error}=await client.from('user_app_state').select('payload,updated_at').eq('user_id',user.id).maybeSingle();if(error)throw error;if(!data)throw new Error('Ainda não há backup na nuvem para esta conta.');
    const yes=confirm('A restauração substituirá os dados locais não relacionados a XP. Primeiro será baixado um backup completo deste navegador. Continuar?');if(!yes)return;
    exportLocal();
    const key='levelUpData_v1', old=JSON.parse(localStorage.getItem(key)||'{}'), incoming=data.payload||{};
    const merged={...old,...incoming,xp:old.xp??0,level:old.level??1,xpEvents:Array.isArray(old.xpEvents)?old.xpEvents:[]};
    localStorage.setItem(key,JSON.stringify(merged));
    status('Dados locais restaurados da nuvem. XP/nível continuam locais até concluir a integração autoritativa.',true);
    location.reload();
  }
  async function migrate(){
    if(!client||!user)throw new Error('Entre na sua conta primeiro.');
    if(!confirm('Vamos fazer backup do estado local e copiar para sua conta os dados de tarefas, rotina, missões e preferências. XP, nível e eventos de XP não serão enviados como autoridade. Os dados locais não serão apagados. Deseja continuar?'))return;
    exportLocal();await syncLocal();status('Migração concluída: backup local mantido e estado não-XP copiado para a nuvem.');
  }
  let syncTimer=null;
  function queueSync(sourceState){ if(!client||!user)return; clearTimeout(syncTimer); syncTimer=setTimeout(()=>syncLocal(sourceState).then(()=>status('Alterações não relacionadas a XP sincronizadas.')).catch(e=>status('Falha ao sincronizar. Seus dados locais foram preservados: '+friendlyError(e),true)),900); }
  async function profile(){
    if(!client||!user)throw new Error('Entre na sua conta primeiro.');
    const name=$('#profile-name')?.value.trim()||'Player One';
    const {error}=await client.from('profiles').update({display_name:name}).eq('id',user.id);if(error)throw error;
  }
  async function safeAction(fn, success){try{busy=true;status('Processando…');await fn();if(success)status(success); }catch(e){status(friendlyError(e),true)}finally{busy=false}}
  document.addEventListener('click',e=>{
    const b=e.target.closest('[data-cloud-action]');if(!b)return;
    const a=b.dataset.cloudAction;
    if(a==='auth-open'){$('#cloud-auth-panel').hidden=false;return}
    if(a==='auth-close'){$('#cloud-auth-panel').hidden=true;return}
    if(a==='login' && b.type==='submit'){return}
    if(a==='login' && b.type==='submit'){return}
    if(a==='login'||a==='signup'||a==='recover'){auth(a);return}
    if(a==='logout'){safeAction(signOut);return}
    if(a==='migrate'){safeAction(migrate);return}
    if(a==='sync'){safeAction(syncLocal,'Estado local sincronizado (sem XP/nível).');return}
    if(a==='restore'){safeAction(restoreCloud);return}
    if(a==='profile-save'){safeAction(profile,'Perfil atualizado na nuvem.');return}
  });
  document.addEventListener('submit',e=>{if(e.target.id==='cloud-auth-form'){e.preventDefault();auth(e.submitter?.dataset.cloudAction||'login')}});
  window.LevelUpCloud={available,refresh,get user(){return user},safeState,syncLocal,restoreCloud,migrate,queueSync};
  if(client){client.auth.onAuthStateChange(()=>{setTimeout(refresh,0)});refresh().catch(e=>console.warn('Supabase session init:',e))}
})();
