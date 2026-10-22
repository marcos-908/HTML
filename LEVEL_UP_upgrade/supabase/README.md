# Configuração Supabase — LEVEL UP

1. Crie um projeto em https://supabase.com/dashboard (não é necessário PostgreSQL local nem pgAdmin).
2. No painel, abra **SQL Editor → New query**, cole e execute o arquivo `migrations/202610220001_initial_levelup.sql`.
3. Em **Project Settings → API**, copie a Project URL e a publishable key (ou anon key legada).
4. Copie `supabase/config.example.js` para `supabase-config.js` na raiz do projeto e preencha `url` e `anonKey`. Esse arquivo contém somente configuração pública; nunca use `service_role`.
5. Em **Authentication → URL Configuration**, defina o Site URL para a URL onde o LEVEL UP será hospedado e adicione também `http://localhost:8000` em Redirect URLs durante desenvolvimento.
6. Em **Authentication → Providers → Email**, configure confirmação de e-mail conforme desejado. Use **Authentication → Users** para conferir contas de teste.

## Segurança e limites desta etapa

A migração instala Auth-compatible profiles, estado não autoritativo, histórico de XP e benefícios Free/Pro com RLS. O JSON de estado rejeita as chaves `xp`, `level` e `xpEvents`, e o histórico não pode ser escrito diretamente pelo navegador. A função `levelup_grant_xp` valida limites e deduplica eventos.

**Importante:** antes de usar XP na nuvem em produção, conecte a conclusão de cada atividade/missão do app à RPC `levelup_grant_xp` e derive o saldo/nível do histórico do servidor. Não trate o saldo local como autoritativo. A sincronização do restante do estado e a migração assistida são implementadas no módulo do navegador; não apague o localStorage até confirmar a migração. Assinaturas Pro precisam de webhook/backend de pagamento confiável — não há pagamentos ativados nesta base.
