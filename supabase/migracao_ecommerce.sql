-- ==========================================================================
-- NDJ 3D — Migração para voltar a ser uma loja completa (ecommerce)
-- Rode isto no SQL Editor do Supabase se o seu banco já está no ar (ex:
-- ele passou pela fase "catálogo" e agora precisa do carrinho/cupom/
-- checkout/Mercado Pago de volta).
--
-- Este script é seguro e NÃO destrutivo: só adiciona o que falta.
-- Pode rodar quantas vezes quiser, ele não duplica nada.
-- Se preferir, pode simplesmente rodar o supabase/schema.sql inteiro —
-- ele já inclui tudo isto e também não apaga dados existentes.
-- ==========================================================================

alter table public.produtos add column if not exists peso_kg numeric(6,3) not null default 0.3;

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

create table if not exists public.pedidos (
  numero text primary key,
  cliente jsonb not null default '{}',
  itens jsonb not null default '[]',
  subtotal numeric(10,2) not null default 0,
  desconto numeric(10,2) not null default 0,
  cupom_codigo text,
  frete numeric(10,2) not null default 0,
  frete_nome text,
  total numeric(10,2) not null default 0,
  combinar_local boolean not null default false,
  status text not null default 'aguardando_pagamento',
  etapas jsonb not null default '[]',
  rastreio text,
  mp_payment_id text,
  mp_preference_id text,
  avaliado boolean not null default false,
  criado_em timestamptz not null default now()
);

create table if not exists public.avaliacoes (
  id text primary key,
  pedido_numero text references public.pedidos(numero) on delete set null,
  produto_id text references public.produtos(id) on delete cascade,
  nome_cliente text,
  nota int not null default 5,
  comentario text,
  criado_em timestamptz not null default now()
);

alter table public.cupons enable row level security;
drop policy if exists "cupons_select_publica" on public.cupons;
create policy "cupons_select_publica" on public.cupons for select using (true);
drop policy if exists "cupons_insert_admin" on public.cupons;
create policy "cupons_insert_admin" on public.cupons for insert to authenticated with check (true);
drop policy if exists "cupons_update_admin" on public.cupons;
create policy "cupons_update_admin" on public.cupons for update to authenticated using (true);
drop policy if exists "cupons_delete_admin" on public.cupons;
create policy "cupons_delete_admin" on public.cupons for delete to authenticated using (true);

alter table public.pedidos enable row level security;
drop policy if exists "pedidos_select_publica" on public.pedidos;
create policy "pedidos_select_publica" on public.pedidos for select using (true);
drop policy if exists "pedidos_insert_publica" on public.pedidos;
create policy "pedidos_insert_publica" on public.pedidos for insert with check (true);
drop policy if exists "pedidos_update_admin" on public.pedidos;
create policy "pedidos_update_admin" on public.pedidos for update to authenticated using (true);

alter table public.avaliacoes enable row level security;
drop policy if exists "avaliacoes_select_publica" on public.avaliacoes;
create policy "avaliacoes_select_publica" on public.avaliacoes for select using (true);
drop policy if exists "avaliacoes_insert_publica" on public.avaliacoes;
create policy "avaliacoes_insert_publica" on public.avaliacoes for insert with check (true);

-- Banner de ponta a ponta da home (não destrutivo, pode rodar mesmo se
-- já tiver rodado antes).

create table if not exists public.banner_index (
  id text primary key default 'home',
  imagem_desktop text,
  imagem_mobile text,
  link text,
  atualizado_em timestamptz not null default now()
);
insert into public.banner_index (id) values ('home') on conflict (id) do nothing;

alter table public.banner_index enable row level security;
drop policy if exists "banner_index_select_publica" on public.banner_index;
create policy "banner_index_select_publica" on public.banner_index for select using (true);
drop policy if exists "banner_index_update_admin" on public.banner_index;
create policy "banner_index_update_admin" on public.banner_index for update to authenticated using (true);
drop policy if exists "banner_index_insert_admin" on public.banner_index;
create policy "banner_index_insert_admin" on public.banner_index for insert to authenticated with check (true);

insert into storage.buckets (id, name, public)
values ('banners-site', 'banners-site', true)
on conflict (id) do nothing;

drop policy if exists "banners_site_select_publica" on storage.objects;
create policy "banners_site_select_publica" on storage.objects
  for select using (bucket_id = 'banners-site');
drop policy if exists "banners_site_insert_admin" on storage.objects;
create policy "banners_site_insert_admin" on storage.objects
  for insert to authenticated with check (bucket_id = 'banners-site');
drop policy if exists "banners_site_update_admin" on storage.objects;
create policy "banners_site_update_admin" on storage.objects
  for update to authenticated using (bucket_id = 'banners-site');
drop policy if exists "banners_site_delete_admin" on storage.objects;
create policy "banners_site_delete_admin" on storage.objects
  for delete to authenticated using (bucket_id = 'banners-site');

-- Preço promocional por produto (não destrutivo).
alter table public.produtos add column if not exists promocao jsonb not null default '{"ativa":false,"precoPromocional":0}';

-- Pausar produto (indisponibilidade temporária, não destrutivo).
alter table public.produtos add column if not exists pausado boolean not null default false;
