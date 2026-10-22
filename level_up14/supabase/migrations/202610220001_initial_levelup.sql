-- LEVEL UP / Supabase PostgreSQL
-- Execute pelo SQL Editor do painel Supabase ou via Supabase CLI.
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Player One' check (char_length(display_name) between 1 and 40),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Dados do aplicativo não autoritativos de XP. O payload NÃO pode conter XP/nível.
-- O navegador nunca pode usar esta tabela para definir saldo ou nível.
create table if not exists public.user_app_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  schema_version integer not null default 1,
  updated_at timestamptz not null default now(),
  constraint user_app_state_no_authoritative_xp check (
    not (payload ? 'xp') and not (payload ? 'level') and not (payload ? 'xpEvents')
  )
);

create table if not exists public.xp_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_key text not null,
  event_type text not null check (event_type in ('activity','daily_bonus','mission')),
  source_id text not null,
  xp integer not null check (xp between 0 and 250),
  created_at timestamptz not null default now(),
  unique(user_id, event_key)
);
create index if not exists xp_transactions_user_created_idx on public.xp_transactions(user_id, created_at desc);

create table if not exists public.user_entitlements (
  user_id uuid primary key references auth.users(id) on delete cascade,
  plan text not null default 'free' check (plan in ('free','pro')),
  source text not null default 'default' check (source in ('default','admin','stripe','other')),
  valid_until timestamptz,
  updated_at timestamptz not null default now()
);

create or replace function public.levelup_touch_updated_at()
returns trigger language plpgsql as $$ begin new.updated_at = now(); return new; end $$;
drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at before update on public.profiles for each row execute function public.levelup_touch_updated_at();
drop trigger if exists user_app_state_touch_updated_at on public.user_app_state;
create trigger user_app_state_touch_updated_at before update on public.user_app_state for each row execute function public.levelup_touch_updated_at();

create or replace function public.levelup_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles(id, display_name) values (new.id, coalesce(nullif(new.raw_user_meta_data->>'display_name',''), 'Player One')) on conflict (id) do nothing;
  insert into public.user_entitlements(user_id, plan, source) values (new.id, 'free', 'default') on conflict (user_id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created_levelup on auth.users;
create trigger on_auth_user_created_levelup after insert on auth.users for each row execute function public.levelup_new_user();

alter table public.profiles enable row level security;
alter table public.user_app_state enable row level security;
alter table public.xp_transactions enable row level security;
alter table public.user_entitlements enable row level security;

drop policy if exists "profile_select_own" on public.profiles;
create policy "profile_select_own" on public.profiles for select to authenticated using ((select auth.uid()) = id);
drop policy if exists "profile_update_own" on public.profiles;
create policy "profile_update_own" on public.profiles for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
-- Usuário só salva o estado não autoritativo do próprio app. Não pode inserir XP/nível no JSON.
drop policy if exists "app_state_select_own" on public.user_app_state;
create policy "app_state_select_own" on public.user_app_state for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "app_state_insert_own" on public.user_app_state;
create policy "app_state_insert_own" on public.user_app_state for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "app_state_update_own" on public.user_app_state;
create policy "app_state_update_own" on public.user_app_state for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
-- Histórico de XP é legível, mas não pode ser criado/editado diretamente pelo navegador.
drop policy if exists "xp_select_own" on public.xp_transactions;
create policy "xp_select_own" on public.xp_transactions for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "entitlements_select_own" on public.user_entitlements;
create policy "entitlements_select_own" on public.user_entitlements for select to authenticated using ((select auth.uid()) = user_id);
revoke insert, update, delete on public.xp_transactions from anon, authenticated;
revoke insert, update, delete on public.user_entitlements from anon, authenticated;

-- Concede XP com idempotência, mas apenas para eventos validados pelo servidor.
-- Para atividades, o servidor calcula a recompensa usando dificuldade e duração fornecidas.
create or replace function public.levelup_grant_xp(
  p_event_key text, p_event_type text, p_source_id text,
  p_difficulty text default 'medium', p_duration_minutes integer default 0
) returns table(granted_xp integer, total_xp bigint, duplicate boolean)
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_xp integer; v_total bigint; v_inserted integer;
begin
  if v_uid is null then raise exception 'authentication_required'; end if;
  if p_event_key is null or length(p_event_key) < 1 or length(p_event_key) > 180 then raise exception 'invalid_event_key'; end if;
  if p_source_id is null or length(p_source_id) < 1 or length(p_source_id) > 180 then raise exception 'invalid_source_id'; end if;
  if p_event_type = 'activity' then
    if p_difficulty not in ('easy','medium','hard') or p_duration_minutes < 0 or p_duration_minutes > 1440 then raise exception 'invalid_activity'; end if;
    v_xp := least(case p_difficulty when 'easy' then 30 when 'medium' then 60 else 100 end,
                  case when p_duration_minutes <= 15 then 30 when p_duration_minutes <= 45 then 60 else 100 end);
  elsif p_event_type = 'daily_bonus' then v_xp := 50;
  elsif p_event_type = 'mission' then v_xp := 250;
  else raise exception 'invalid_event_type'; end if;
  insert into public.xp_transactions(user_id,event_key,event_type,source_id,xp)
  values(v_uid,p_event_key,p_event_type,p_source_id,v_xp) on conflict(user_id,event_key) do nothing;
  get diagnostics v_inserted = row_count;
  select coalesce(sum(xp),0) into v_total from public.xp_transactions where user_id=v_uid;
  return query select case when v_inserted=1 then v_xp else 0 end, v_total, (v_inserted=0);
end $$;
revoke all on function public.levelup_grant_xp(text,text,text,text,integer) from public, anon;
grant execute on function public.levelup_grant_xp(text,text,text,text,integer) to authenticated;
