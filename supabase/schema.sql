-- VerificaPay — Esquema de base de datos (Supabase / PostgreSQL)
-- Ejecutar en el SQL Editor de tu proyecto Supabase.

create extension if not exists pgcrypto;

-- ============================================================
-- ORGANIZATIONS (comercios)
-- ============================================================
create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  invite_code text not null unique default substr(replace(gen_random_uuid()::text, '-', ''), 1, 8),
  created_at timestamptz not null default now()
);

-- ============================================================
-- PLANS (paquetes del SaaS: límites que se le asignan a cada comercio)
-- ============================================================
-- max_employees / max_wallets en null = ilimitado.
-- is_active = false: el plan deja de ofrecerse, pero los comercios que ya lo
-- tienen lo conservan. is_default: plan que se preselecciona en altas nuevas.
create table if not exists public.plans (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  price numeric not null default 0 check (price >= 0),
  currency text not null default 'ARS',
  max_employees integer check (max_employees >= 0),
  max_wallets integer check (max_wallets >= 0),
  allowed_providers text[] not null default array['mercado_pago', 'naranja_x', 'uala', 'cuenta_dni', 'modo'],
  is_active boolean not null default true,
  is_default boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists plans_single_default_idx on public.plans(is_default) where is_default;

insert into public.plans (name, description, price, max_employees, max_wallets, allowed_providers, is_default, sort_order)
values
  ('Básico', 'Para comercios chicos con una sola caja.', 0, 2, 1, array['mercado_pago'], true, 1),
  ('Profesional', 'Varias cajas y billeteras.', 0, 10, 3, array['mercado_pago', 'naranja_x', 'uala', 'cuenta_dni', 'modo'], false, 2),
  ('Empresa', 'Sin límites de cajeros ni billeteras.', 0, null, null, array['mercado_pago', 'naranja_x', 'uala', 'cuenta_dni', 'modo'], false, 3)
on conflict (name) do nothing;

alter table public.organizations add column if not exists plan_id uuid references public.plans(id) on delete restrict;

-- Delta idempotente: los comercios creados antes de los planes quedan en el
-- plan por defecto.
update public.organizations
  set plan_id = (select id from public.plans where is_default limit 1)
  where plan_id is null;

create index if not exists organizations_plan_id_idx on public.organizations(plan_id);

-- ============================================================
-- PROFILES (usuarios: dueños y empleados), 1:1 con auth.users
-- ============================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  full_name text not null,
  email text,
  role text not null default 'employee' constraint profiles_role_check check (role in ('owner', 'employee', 'superadmin')),
  shift text,
  status text not null default 'active' constraint profiles_status_check check (status in ('active', 'inactive')),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

-- Delta idempotente para bases ya creadas antes de sumar el rol superadmin:
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (role in ('owner', 'employee', 'superadmin'));

-- Delta idempotente para bases ya creadas antes del módulo de cajeros:
alter table public.profiles add column if not exists email text;
alter table public.profiles add column if not exists status text not null default 'active';
alter table public.profiles add column if not exists created_by uuid references public.profiles(id) on delete set null;
alter table public.profiles drop constraint if exists profiles_status_check;
alter table public.profiles add constraint profiles_status_check check (status in ('active', 'inactive'));

-- Rellena el email de los perfiles existentes desde auth.users:
update public.profiles p
  set email = u.email
  from auth.users u
  where u.id = p.id and p.email is null;

create index if not exists profiles_organization_id_idx on public.profiles(organization_id);

-- ============================================================
-- WALLETS (billeteras virtuales configuradas por comercio)
-- ============================================================
create table if not exists public.wallets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  provider text not null check (provider in ('mercado_pago', 'naranja_x', 'uala', 'cuenta_dni', 'modo')),
  alias text not null,
  public_key text,
  external_user_id text,
  collector_id text, -- user_id de MP (u otro proveedor) dueño de la cuenta; usado para matchear webhooks
  status text not null default 'active' check (status in ('active', 'inactive', 'error')),
  connected_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- WALLET_CREDENTIALS (tokens de las billeteras)
-- ============================================================
-- Tabla aparte para que los tokens nunca lleguen al navegador: tiene RLS
-- activado y ninguna policy, así que solo la service_role key (server-side)
-- puede leerla o escribirla. Los cajeros pueden ver `wallets`, no esto.
create table if not exists public.wallet_credentials (
  wallet_id uuid primary key references public.wallets(id) on delete cascade,
  access_token text, -- almacenar cifrado en producción (ver nota de seguridad al final)
  refresh_token text, -- token OAuth para renovar el access_token cuando expire
  updated_at timestamptz not null default now()
);

alter table public.wallet_credentials enable row level security;
revoke all on public.wallet_credentials from anon, authenticated;

-- Delta idempotente para bases ya creadas con los tokens dentro de wallets:
-- los mueve a wallet_credentials y borra las columnas expuestas.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'wallets' and column_name = 'access_token'
  ) then
    alter table public.wallets add column if not exists refresh_token text;

    insert into public.wallet_credentials (wallet_id, access_token, refresh_token)
      select id, access_token, refresh_token
      from public.wallets
      where access_token is not null or refresh_token is not null
    on conflict (wallet_id) do nothing;

    alter table public.wallets drop column access_token;
    alter table public.wallets drop column refresh_token;
  end if;
end $$;

-- Sincronización de pagos contra la API del proveedor (ver lib/payment-sync.ts):
--   last_synced_at: hasta dónde están guardados los cambios (cursor incremental).
--   sync_started_at: turno de la última sincronización; evita que varias
--                    pantallas abiertas consulten la misma billetera a la vez.
alter table public.wallets add column if not exists last_synced_at timestamptz;
alter table public.wallets add column if not exists sync_started_at timestamptz;

create index if not exists wallets_organization_id_idx on public.wallets(organization_id);
create unique index if not exists wallets_collector_id_idx on public.wallets(provider, collector_id) where collector_id is not null;

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists wallets_set_updated_at on public.wallets;
create trigger wallets_set_updated_at
  before update on public.wallets
  for each row execute function public.set_updated_at();

drop trigger if exists wallet_credentials_set_updated_at on public.wallet_credentials;
create trigger wallet_credentials_set_updated_at
  before update on public.wallet_credentials
  for each row execute function public.set_updated_at();

-- ============================================================
-- PAYMENTS (pagos recibidos: los escriben la sincronización contra la API
-- del proveedor y, para Mercado Pago, también el webhook)
-- ============================================================
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  wallet_id uuid not null references public.wallets(id) on delete cascade,
  provider text not null,
  provider_payment_id text not null,
  amount numeric not null,
  currency text not null default 'ARS',
  status text not null check (status in ('approved', 'pending', 'rejected')),
  payer_name text,
  payer_email text,
  description text,
  payment_method text,
  raw jsonb,
  provider_created_at timestamptz not null,
  provider_updated_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, provider_payment_id)
);

create index if not exists payments_organization_id_idx on public.payments(organization_id, provider_created_at desc);
create index if not exists payments_wallet_id_idx on public.payments(wallet_id, provider_created_at desc);

-- Habilita Supabase Realtime sobre payments para que el dashboard se
-- actualice solo cuando el webhook inserta un pago nuevo.
-- (Idempotente: agregar una tabla que ya está en la publicación da error.)
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'payments'
  ) then
    alter publication supabase_realtime add table public.payments;
  end if;
end $$;

drop trigger if exists payments_set_updated_at on public.payments;
create trigger payments_set_updated_at
  before update on public.payments
  for each row execute function public.set_updated_at();

-- ============================================================
-- Helper: organización del usuario autenticado (evita recursión en RLS)
-- ============================================================
create or replace function public.current_organization_id()
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select organization_id from public.profiles where id = auth.uid();
$$;

create or replace function public.current_role()
returns text
language sql
security definer
set search_path = public
stable
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.current_profile_status()
returns text
language sql
security definer
set search_path = public
stable
as $$
  select status from public.profiles where id = auth.uid();
$$;

-- ============================================================
-- Límites del plan (última barrera: la app valida antes para dar un
-- mensaje claro, pero acá no se puede saltear por ningún camino).
-- ============================================================
drop trigger if exists plans_set_updated_at on public.plans;
create trigger plans_set_updated_at
  before update on public.plans
  for each row execute function public.set_updated_at();

create or replace function public.enforce_employee_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  limit_value integer;
  used integer;
begin
  if new.role <> 'employee' then
    return new;
  end if;

  -- Bloquea la fila del comercio para que dos altas simultáneas no pasen
  -- las dos el chequeo.
  select p.max_employees into limit_value
    from public.organizations o
    left join public.plans p on p.id = o.plan_id
    where o.id = new.organization_id
    for update of o;

  if limit_value is null then
    return new;
  end if;

  select count(*) into used
    from public.profiles
    where organization_id = new.organization_id and role = 'employee';

  if used >= limit_value then
    raise exception 'plan_limit_employees' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_enforce_employee_limit on public.profiles;
create trigger profiles_enforce_employee_limit
  before insert on public.profiles
  for each row execute function public.enforce_employee_limit();

create or replace function public.enforce_wallet_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  limit_value integer;
  providers text[];
  used integer;
begin
  select p.max_wallets, p.allowed_providers into limit_value, providers
    from public.organizations o
    left join public.plans p on p.id = o.plan_id
    where o.id = new.organization_id
    for update of o;

  if providers is not null and not (new.provider = any(providers)) then
    raise exception 'plan_provider_not_allowed' using errcode = 'P0001';
  end if;

  if limit_value is null then
    return new;
  end if;

  select count(*) into used
    from public.wallets
    where organization_id = new.organization_id;

  if used >= limit_value then
    raise exception 'plan_limit_wallets' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists wallets_enforce_limit on public.wallets;
create trigger wallets_enforce_limit
  before insert on public.wallets
  for each row execute function public.enforce_wallet_limit();

-- El owner puede actualizar su comercio por RLS, pero el plan solo lo
-- cambia el superadmin (o el server con la service_role key, sin auth.uid()).
-- Un comercio nuevo sin plan (o dado de alta por un usuario común) arranca
-- en el plan por defecto.
create or replace function public.protect_organization_plan()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  privileged boolean := auth.uid() is null or public.current_role() = 'superadmin';
begin
  if tg_op = 'INSERT' then
    if new.plan_id is null or not privileged then
      new.plan_id := (select id from public.plans where is_default limit 1);
    end if;
  elsif new.plan_id is distinct from old.plan_id and not privileged then
    raise exception 'plan_change_not_allowed' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists organizations_protect_plan on public.organizations;
create trigger organizations_protect_plan
  before insert or update on public.organizations
  for each row execute function public.protect_organization_plan();

-- ============================================================
-- RLS
-- ============================================================
alter table public.plans enable row level security;
alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.wallets enable row level security;
alter table public.payments replica identity full;

-- plans: cualquier usuario autenticado puede LEER los planes (el owner ve los
-- límites del suyo). Las escrituras las hace el superadmin desde el server
-- con la service_role key.
drop policy if exists "plans: select authenticated" on public.plans;
create policy "plans: select authenticated"
  on public.plans for select
  using (auth.uid() is not null);

-- organizations: cualquier usuario autenticado puede LEER su propia organización
drop policy if exists "org: select own" on public.organizations;
create policy "org: select own"
  on public.organizations for select
  using (id = public.current_organization_id());

-- organizations: un superadmin puede LEER todas las organizaciones
drop policy if exists "org: select all (superadmin)" on public.organizations;
create policy "org: select all (superadmin)"
  on public.organizations for select
  using (public.current_role() = 'superadmin');

-- organizations: solo el owner puede actualizar datos del comercio
drop policy if exists "org: update by owner" on public.organizations;
create policy "org: update by owner"
  on public.organizations for update
  using (id = public.current_organization_id() and public.current_role() = 'owner');

-- organizations: cualquiera autenticándose por primera vez puede crear un comercio (alta de dueño)
drop policy if exists "org: insert by authenticated" on public.organizations;
create policy "org: insert by authenticated"
  on public.organizations for insert
  with check (auth.uid() is not null);

-- profiles: ver perfiles de tu propio comercio
drop policy if exists "profiles: select same org" on public.profiles;
create policy "profiles: select same org"
  on public.profiles for select
  using (organization_id = public.current_organization_id());

-- profiles: un superadmin puede LEER perfiles de cualquier organización
drop policy if exists "profiles: select all (superadmin)" on public.profiles;
create policy "profiles: select all (superadmin)"
  on public.profiles for select
  using (public.current_role() = 'superadmin');

-- profiles: un usuario solo puede crear su propio perfil (signup)
drop policy if exists "profiles: insert own" on public.profiles;
create policy "profiles: insert own"
  on public.profiles for insert
  with check (id = auth.uid());

-- profiles: un usuario puede actualizar su propio perfil, pero no puede
-- cambiarse el rol, la organización ni reactivarse solo.
drop policy if exists "profiles: update own" on public.profiles;
create policy "profiles: update own"
  on public.profiles for update
  using (id = auth.uid())
  with check (
    id = auth.uid()
    and role = public.current_role()
    and organization_id = public.current_organization_id()
    and status = public.current_profile_status()
  );

-- profiles: el owner administra los cajeros (empleados) de su comercio
drop policy if exists "profiles: insert employee by owner" on public.profiles;
create policy "profiles: insert employee by owner"
  on public.profiles for insert
  with check (
    organization_id = public.current_organization_id()
    and public.current_role() = 'owner'
    and role = 'employee'
  );

drop policy if exists "profiles: update employee by owner" on public.profiles;
create policy "profiles: update employee by owner"
  on public.profiles for update
  using (
    organization_id = public.current_organization_id()
    and public.current_role() = 'owner'
    and role = 'employee'
  )
  with check (
    organization_id = public.current_organization_id()
    and role = 'employee'
  );

drop policy if exists "profiles: delete employee by owner" on public.profiles;
create policy "profiles: delete employee by owner"
  on public.profiles for delete
  using (
    organization_id = public.current_organization_id()
    and public.current_role() = 'owner'
    and role = 'employee'
  );

-- wallets: ver billeteras del propio comercio
drop policy if exists "wallets: select same org" on public.wallets;
create policy "wallets: select same org"
  on public.wallets for select
  using (organization_id = public.current_organization_id());

-- wallets: un superadmin puede LEER billeteras de cualquier organización
drop policy if exists "wallets: select all (superadmin)" on public.wallets;
create policy "wallets: select all (superadmin)"
  on public.wallets for select
  using (public.current_role() = 'superadmin');

-- wallets: solo el owner administra billeteras
drop policy if exists "wallets: insert by owner" on public.wallets;
create policy "wallets: insert by owner"
  on public.wallets for insert
  with check (organization_id = public.current_organization_id() and public.current_role() = 'owner');

drop policy if exists "wallets: update by owner" on public.wallets;
create policy "wallets: update by owner"
  on public.wallets for update
  using (organization_id = public.current_organization_id() and public.current_role() = 'owner');

drop policy if exists "wallets: delete by owner" on public.wallets;
create policy "wallets: delete by owner"
  on public.wallets for delete
  using (organization_id = public.current_organization_id() and public.current_role() = 'owner');

-- payments: ver pagos del propio comercio (las escrituras las hace el
-- webhook server-side con la service_role key, que ignora RLS)
drop policy if exists "payments: select same org" on public.payments;
create policy "payments: select same org"
  on public.payments for select
  using (organization_id = public.current_organization_id());

-- payments: un superadmin puede LEER pagos de cualquier organización
drop policy if exists "payments: select all (superadmin)" on public.payments;
create policy "payments: select all (superadmin)"
  on public.payments for select
  using (public.current_role() = 'superadmin');

-- ============================================================
-- NOTA DE SEGURIDAD
-- ============================================================
-- wallet_credentials guarda los tokens de la API de Mercado Pago (u otra
-- billetera). Solo se accede desde el server con la service_role key y nunca
-- se expone al cliente. Para producción, además, no los guardes en texto
-- plano: usá Supabase Vault, o cifralos antes de persistirlos.
