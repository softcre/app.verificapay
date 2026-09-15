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
  access_token text, -- almacenar cifrado en producción (ver nota de seguridad al final)
  refresh_token text, -- token OAuth para renovar el access_token cuando expire
  external_user_id text,
  collector_id text, -- user_id de MP (u otro proveedor) dueño de la cuenta; usado para matchear webhooks
  status text not null default 'active' check (status in ('active', 'inactive', 'error')),
  connected_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Delta idempotente para bases ya creadas antes de sumar OAuth:
alter table public.wallets add column if not exists refresh_token text;

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

-- ============================================================
-- PAYMENTS (pagos recibidos, alimentados por el webhook del proveedor)
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

-- Habilita Supabase Realtime sobre payments para que el dashboard se
-- actualice solo cuando el webhook inserta un pago nuevo.
alter publication supabase_realtime add table public.payments;

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
-- RLS
-- ============================================================
alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.wallets enable row level security;
alter table public.payments replica identity full;

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
-- El campo wallets.access_token guarda el token de la API de Mercado Pago
-- (u otra billetera). Para producción, no lo guardes en texto plano:
-- usá Supabase Vault, o cifralo en una Edge Function antes de persistirlo,
-- y nunca lo expongas al cliente (leelo solo desde el service_role en
-- funciones server-side).
