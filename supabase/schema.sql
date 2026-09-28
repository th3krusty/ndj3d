-- ==========================================================================
-- NDJ 3D — Schema do Supabase (loja completa)
-- Rode este arquivo inteiro no SQL Editor do seu projeto Supabase
-- (Painel → SQL Editor → New query → cole tudo → Run).
--
-- Este site é uma loja completa: carrinho, cupom de desconto, cálculo
-- de frete no checkout e pagamento via Mercado Pago (Pix/cartão/boleto).
-- O produto também pode ser divulgado na Shopee/TikTok Shop e vendido
-- direto pelo WhatsApp, mas a compra pelo próprio site passa por aqui.
--
-- Pode rodar este arquivo tanto num projeto novo quanto num projeto que
-- já existia antes (as tabelas e colunas que já existirem não são
-- recriadas nem apagadas, só o que falta é adicionado).
-- ==========================================================================

-- ---------- Categorias ----------
create table if not exists public.categorias (
  id text primary key,
  nome text not null,
  "desc" text,
  icone text,
  ordem int default 0
);

-- ---------- Produtos ----------
create table if not exists public.produtos (
  id text primary key,
  nome text not null,
  categoria text references public.categorias(id) on update cascade,
  preco numeric(10,2) not null default 0,
  imagens jsonb not null default '[]',
  cores jsonb not null default '[]',
  personalizacao jsonb not null default '{"disponivel":false,"precoExtra":0,"rotulo":"","maxCaracteres":0}',
  descricao text,
  caracteristicas jsonb not null default '[]',
  estoque int default 0,
  shopee_url text,
  tiktok_url text,
  pedido_minimo jsonb not null default '{"ativo":false,"quantidade":1}',
  pausado boolean not null default false,
  criado_em timestamptz not null default now()
);

-- Se a tabela "produtos" já existia (site criado antes da versão catálogo,
-- ou antes da integração com Shopee/TikTok Shop), estas linhas adicionam
-- as colunas que faltarem sem apagar nada do que já existe.
alter table public.produtos add column if not exists shopee_url text;
alter table public.produtos add column if not exists tiktok_url text;
alter table public.produtos add column if not exists estoque int default 0;
alter table public.produtos add column if not exists pedido_minimo jsonb not null default '{"ativo":false,"quantidade":1}';
alter table public.produtos add column if not exists peso_kg numeric(6,3) not null default 0.3;
alter table public.produtos add column if not exists promocao jsonb not null default '{"ativa":false,"precoPromocional":0}';
alter table public.produtos add column if not exists pausado boolean not null default false;

-- ---------- Cupons de desconto ----------
create table if not exists public.cupons (
  id text primary key,
  codigo text not null unique,
  tipo text not null default 'percentual', -- 'percentual' ou 'fixo'
  valor numeric(10,2) not null default 0,
  valor_minimo numeric(10,2) not null default 0, -- pedido precisa ter pelo menos esse subtotal pro cupom valer
  primeira_compra_apenas boolean not null default false, -- se true, so vale para CPFs sem pedido anterior
  validade date,
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);
alter table public.cupons add column if not exists valor_minimo numeric(10,2) not null default 0;
alter table public.cupons add column if not exists primeira_compra_apenas boolean not null default false;

-- ---------- Pedidos ----------
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

-- ---------- Avaliacoes de produtos ----------
create table if not exists public.avaliacoes (
  id text primary key,
  pedido_numero text references public.pedidos(numero) on delete set null,
  produto_id text references public.produtos(id) on delete cascade,
  nome_cliente text,
  nota int not null default 5,
  comentario text,
  criado_em timestamptz not null default now()
);

-- ---------- Banner de ponta a ponta da página inicial ----------
-- Linha única (id fixo 'home'): uma imagem para celular e outra para
-- computador (o site troca automaticamente conforme a tela), com um link
-- opcional para quando o cliente clicar no banner.
create table if not exists public.banner_index (
  id text primary key default 'home',
  imagem_desktop text,
  imagem_mobile text,
  link text,
  atualizado_em timestamptz not null default now()
);
insert into public.banner_index (id) values ('home') on conflict (id) do nothing;

-- Cada cor em "cores" já podia ter {"nome","hex"}; agora pode ter também
-- "foto" (URL da foto de referência daquela cor, enviada pelo painel admin
-- e guardada no mesmo bucket "produtos-imagens"). Como "cores" é jsonb, não
-- é preciso alterar a coluna — o campo novo simplesmente aparece nos
-- produtos que tiverem uma foto de cor cadastrada.

-- ==========================================================================
-- Row Level Security (RLS)
--
-- IMPORTANTE — leia isto: como este é um site 100% estático (sem servidor
-- próprio), toda escrita no banco (salvar produto/categoria no admin) é
-- feita pelo navegador usando a "anon key", que é pública. Por isso as
-- políticas abaixo são propositalmente abertas para leitura pública
-- (produtos e categorias precisam aparecer pra qualquer visitante) e
-- escrita só para quem estiver autenticado no painel admin.
--
-- Se no futuro você quiser um controle mais forte, o caminho é mover
-- essas escritas para uma Supabase Edge Function ou um pequeno backend
-- que use a service_role key (essa sim, secreta).
-- ==========================================================================

alter table public.categorias enable row level security;
alter table public.produtos enable row level security;

-- Categorias: leitura pública; escrita só para o admin autenticado
drop policy if exists "categorias_select_publica" on public.categorias;
create policy "categorias_select_publica" on public.categorias for select using (true);
drop policy if exists "categorias_insert_admin" on public.categorias;
create policy "categorias_insert_admin" on public.categorias for insert to authenticated with check (true);
drop policy if exists "categorias_update_admin" on public.categorias;
create policy "categorias_update_admin" on public.categorias for update to authenticated using (true);
drop policy if exists "categorias_delete_admin" on public.categorias;
create policy "categorias_delete_admin" on public.categorias for delete to authenticated using (true);

-- Produtos: leitura pública; escrita só para o admin autenticado
drop policy if exists "produtos_select_publica" on public.produtos;
create policy "produtos_select_publica" on public.produtos for select using (true);
drop policy if exists "produtos_insert_admin" on public.produtos;
create policy "produtos_insert_admin" on public.produtos for insert to authenticated with check (true);
drop policy if exists "produtos_update_admin" on public.produtos;
create policy "produtos_update_admin" on public.produtos for update to authenticated using (true);
drop policy if exists "produtos_delete_admin" on public.produtos;
create policy "produtos_delete_admin" on public.produtos for delete to authenticated using (true);

-- Cupons: leitura publica (para validar no carrinho); escrita so admin
alter table public.cupons enable row level security;
drop policy if exists "cupons_select_publica" on public.cupons;
create policy "cupons_select_publica" on public.cupons for select using (true);
drop policy if exists "cupons_insert_admin" on public.cupons;
create policy "cupons_insert_admin" on public.cupons for insert to authenticated with check (true);
drop policy if exists "cupons_update_admin" on public.cupons;
create policy "cupons_update_admin" on public.cupons for update to authenticated using (true);
drop policy if exists "cupons_delete_admin" on public.cupons;
create policy "cupons_delete_admin" on public.cupons for delete to authenticated using (true);

-- Pedidos: qualquer pessoa pode CRIAR seu proprio pedido no checkout e
-- CONSULTAR (para a pagina "Rastrear pedido"); so o admin pode alterar
-- status/rastreio.
alter table public.pedidos enable row level security;
drop policy if exists "pedidos_select_publica" on public.pedidos;
create policy "pedidos_select_publica" on public.pedidos for select using (true);
drop policy if exists "pedidos_insert_publica" on public.pedidos;
create policy "pedidos_insert_publica" on public.pedidos for insert with check (true);
drop policy if exists "pedidos_update_admin" on public.pedidos;
create policy "pedidos_update_admin" on public.pedidos for update to authenticated using (true);

-- Avaliacoes: leitura publica; qualquer pessoa pode enviar uma avaliacao
-- (o site so libera o formulario para quem tem um pedido entregue).
alter table public.avaliacoes enable row level security;
drop policy if exists "avaliacoes_select_publica" on public.avaliacoes;
create policy "avaliacoes_select_publica" on public.avaliacoes for select using (true);
drop policy if exists "avaliacoes_insert_publica" on public.avaliacoes;
create policy "avaliacoes_insert_publica" on public.avaliacoes for insert with check (true);

-- Banner da home: leitura publica (aparece pra qualquer visitante); so o
-- admin autenticado pode trocar as imagens/link.
alter table public.banner_index enable row level security;
drop policy if exists "banner_index_select_publica" on public.banner_index;
create policy "banner_index_select_publica" on public.banner_index for select using (true);
drop policy if exists "banner_index_update_admin" on public.banner_index;
create policy "banner_index_update_admin" on public.banner_index for update to authenticated using (true);
drop policy if exists "banner_index_insert_admin" on public.banner_index;
create policy "banner_index_insert_admin" on public.banner_index for insert to authenticated with check (true);

-- ==========================================================================
-- Storage — bucket para as fotos dos produtos (upload direto do dispositivo
-- no painel admin, em vez de colar um link). Leitura pública (para as fotos
-- aparecerem no site) e escrita só para o admin autenticado.
-- ==========================================================================

insert into storage.buckets (id, name, public)
values ('produtos-imagens', 'produtos-imagens', true)
on conflict (id) do nothing;

drop policy if exists "produtos_imagens_select_publica" on storage.objects;
create policy "produtos_imagens_select_publica" on storage.objects
  for select using (bucket_id = 'produtos-imagens');
drop policy if exists "produtos_imagens_insert_admin" on storage.objects;
create policy "produtos_imagens_insert_admin" on storage.objects
  for insert to authenticated with check (bucket_id = 'produtos-imagens');
drop policy if exists "produtos_imagens_update_admin" on storage.objects;
create policy "produtos_imagens_update_admin" on storage.objects
  for update to authenticated using (bucket_id = 'produtos-imagens');
drop policy if exists "produtos_imagens_delete_admin" on storage.objects;
create policy "produtos_imagens_delete_admin" on storage.objects
  for delete to authenticated using (bucket_id = 'produtos-imagens');

-- Bucket separado para as imagens do banner da home (marketing/propaganda).
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

-- ==========================================================================
-- Dados iniciais (mesmo catálogo de demonstração que já vinha no site)
-- Apague ou edite à vontade depois pelo painel admin.
-- ==========================================================================

insert into public.categorias (id, nome, "desc", icone, ordem) values
  ('presentes', 'Presentes', 'Peças criativas para presentear', 'assets/icones/presentes.svg', 1),
  ('lembrancinhas', 'Lembrancinhas', 'Festas, chás e eventos especiais', 'assets/icones/lembrancinhas.svg', 2),
  ('chaveiros', 'Chaveiros', 'Chaveiros personalizados no seu estilo', 'assets/icones/chaveiros.svg', 3),
  ('sensoriais', 'Sensoriais', 'Brinquedos e objetos sensoriais (fidgets)', 'assets/icones/sensoriais.svg', 4),
  ('utilidades', 'Utilidades', 'Peças práticas para o dia a dia', 'assets/icones/utilidades.svg', 5),
  ('decoracao', 'Decoração', 'Peças para deixar seu ambiente único', 'assets/icones/decoracao.svg', 6)
on conflict (id) do nothing;

