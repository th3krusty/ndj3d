-- ==========================================================================
-- Corrige a tabela de cupons no Supabase (rode no SQL Editor, uma vez só).
-- Seguro para rodar de novo: não apaga nenhum cupom existente.
-- ==========================================================================

create table if not exists public.cupons (
  id text primary key,
  codigo text not null unique,
  tipo text not null default 'percentual',
  valor numeric(10,2) not null default 0,
  valor_minimo numeric(10,2) not null default 0,
  primeira_compra_apenas boolean not null default false,
  validade date,
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);
alter table public.cupons add column if not exists valor_minimo numeric(10,2) not null default 0;
alter table public.cupons add column if not exists primeira_compra_apenas boolean not null default false;

alter table public.cupons enable row level security;
drop policy if exists "cupons_select_publica" on public.cupons;
create policy "cupons_select_publica" on public.cupons for select using (true);
drop policy if exists "cupons_insert_admin" on public.cupons;
create policy "cupons_insert_admin" on public.cupons for insert to authenticated with check (true);
drop policy if exists "cupons_update_admin" on public.cupons;
create policy "cupons_update_admin" on public.cupons for update to authenticated using (true);
drop policy if exists "cupons_delete_admin" on public.cupons;
create policy "cupons_delete_admin" on public.cupons for delete to authenticated using (true);

-- Faz a API do Supabase enxergar as colunas novas imediatamente.
notify pgrst, 'reload schema';
