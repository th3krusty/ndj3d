-- ==========================================================================
-- NDJ 3D — Schema do Supabase (catálogo)
-- Rode este arquivo inteiro no SQL Editor do seu projeto Supabase
-- (Painel → SQL Editor → New query → cole tudo → Run).
--
-- Este site funciona como CATÁLOGO: a venda acontece na Shopee, no
-- TikTok Shop ou combinada direto pelo WhatsApp. Não existe mais
-- carrinho, cupom, checkout, pedido ou pagamento online no site.
--
-- Pode rodar este arquivo tanto num projeto novo quanto num projeto que
-- já tinha a versão antiga do site (com carrinho/pedidos) — as tabelas e
-- colunas que já existirem não são recriadas nem apagadas, só o que
-- falta é adicionado. Se preferir um script mais enxuto que só adiciona
-- a coluna nova sem reinserir os produtos de demonstração, use
-- supabase/migracao_catalogo.sql.
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
  criado_em timestamptz not null default now()
);

-- Se a tabela "produtos" já existia (site criado antes da versão catálogo,
-- ou antes da integração com Shopee/TikTok Shop), estas linhas adicionam
-- as colunas que faltarem sem apagar nada do que já existe.
alter table public.produtos add column if not exists shopee_url text;
alter table public.produtos add column if not exists tiktok_url text;
alter table public.produtos add column if not exists estoque int default 0;
alter table public.produtos add column if not exists pedido_minimo jsonb not null default '{"ativo":false,"quantidade":1}';

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

-- ==========================================================================
-- Dados iniciais (mesmo catálogo de demonstração que já vinha no site)
-- Apague ou edite à vontade depois pelo painel admin.
-- ==========================================================================

insert into public.categorias (id, nome, "desc", icone, ordem) values
  ('presentes', 'Presentes', 'Peças criativas para presentear', 'assets/icones/presentes.svg', 1),
  ('lembrancinhas', 'Lembrancinhas', 'Festas, chás e eventos especiais', 'assets/icones/lembrancinhas.svg', 2),
  ('chaveiros', 'Chaveiros', 'Chaveiros personalizados no seu estilo', 'assets/icones/chaveiros.svg', 3),
  ('sensoriais', 'Sensoriais', 'Brinquedos e objetos sensoriais (fidgets)', 'assets/icones/sensoriais.png', 4),
  ('utilidades', 'Utilidades', 'Peças práticas para o dia a dia', 'assets/icones/utilidades.svg', 5),
  ('decoracao', 'Decoração', 'Peças para deixar seu ambiente único', 'assets/icones/decoracao.svg', 6)
on conflict (id) do nothing;

insert into public.produtos (id, nome, categoria, preco, imagens, cores, personalizacao, descricao, caracteristicas, estoque, shopee_url, tiktok_url) values
('p001', 'Porta-chaves Personalizado', 'lembrancinhas', 24.90,
  '["https://picsum.photos/seed/ndj-chaveiro1/700/700","https://picsum.photos/seed/ndj-chaveiro2/700/700","https://picsum.photos/seed/ndj-chaveiro3/700/700","https://picsum.photos/seed/ndj-chaveiro4/700/700","https://picsum.photos/seed/ndj-chaveiro5/700/700"]',
  '[{"nome":"Preto","hex":"#1B1815"},{"nome":"Dourado","hex":"#B08D57"},{"nome":"Branco","hex":"#F4EEE2"},{"nome":"Vermelho","hex":"#B0473F"}]',
  '{"disponivel":true,"precoExtra":6,"rotulo":"Nome ou frase (até 15 caracteres)","maxCaracteres":15}',
  'Chaveiro impresso em 3D com acabamento fosco, ideal para presentear ou usar no dia a dia. Pode ser gravado com o nome, apelido ou uma frase curta.',
  '["Material: PLA premium","Resistente a quedas do dia a dia","Aro metálico incluso","Tamanho aprox: 6 x 4cm"]',
  80, 'https://shopee.com.br/', ''),

('p002', 'Caixinha Surpresa para Presente', 'presentes', 39.90,
  '["https://picsum.photos/seed/ndj-caixa1/700/700","https://picsum.photos/seed/ndj-caixa2/700/700","https://picsum.photos/seed/ndj-caixa3/700/700","https://picsum.photos/seed/ndj-caixa4/700/700","https://picsum.photos/seed/ndj-caixa5/700/700"]',
  '[{"nome":"Rosé","hex":"#D8BD8E"},{"nome":"Preto Fosco","hex":"#1B1815"},{"nome":"Branco Perolado","hex":"#FBF8F2"}]',
  '{"disponivel":true,"precoExtra":10,"rotulo":"Nome do presenteado","maxCaracteres":20}',
  'Caixinha com abertura em quebra-cabeça: só abre quem sabe o "truque"! Perfeita para presentear com uma mensagem, anel ou mimo pequeno dentro.',
  '["Mecanismo de abertura exclusivo","Compartimento interno de 5x5cm","Ótima para pedidos e datas especiais"]',
  45, 'https://shopee.com.br/', ''),

('p003', 'Organizador de Escrivaninha Modular', 'utilidades', 54.90,
  '["https://picsum.photos/seed/ndj-organizador1/700/700","https://picsum.photos/seed/ndj-organizador2/700/700","https://picsum.photos/seed/ndj-organizador3/700/700","https://picsum.photos/seed/ndj-organizador4/700/700","https://picsum.photos/seed/ndj-organizador5/700/700"]',
  '[{"nome":"Preto","hex":"#1B1815"},{"nome":"Cinza Grafite","hex":"#3A342C"},{"nome":"Bronze","hex":"#8A6B3D"}]',
  '{"disponivel":false,"precoExtra":0,"rotulo":"","maxCaracteres":0}',
  'Módulos encaixáveis para organizar canetas, clipes e cartões na sua mesa. Monte o arranjo do seu jeito.',
  '["3 módulos inclusos","Encaixe sem parafusos","Base antiderrapante"]',
  30, 'https://shopee.com.br/', ''),

('p004', 'Suporte de Celular Articulado', 'utilidades', 32.90,
  '["https://picsum.photos/seed/ndj-suporte1/700/700","https://picsum.photos/seed/ndj-suporte2/700/700","https://picsum.photos/seed/ndj-suporte3/700/700","https://picsum.photos/seed/ndj-suporte4/700/700","https://picsum.photos/seed/ndj-suporte5/700/700"]',
  '[{"nome":"Preto","hex":"#1B1815"},{"nome":"Branco","hex":"#F4EEE2"}]',
  '{"disponivel":true,"precoExtra":5,"rotulo":"Iniciais na base (até 3 letras)","maxCaracteres":3}',
  'Suporte ajustável para celular ou tablet, ótimo para vídeochamadas, receitas e vídeos na cozinha ou mesa de trabalho.',
  '["Ajuste em 6 ângulos","Compatível com a maioria dos aparelhos","Base emborrachada"]',
  60, 'https://shopee.com.br/', ''),

('p005', 'Topo de Bolo Personalizado', 'lembrancinhas', 44.90,
  '["https://picsum.photos/seed/ndj-topo1/700/700","https://picsum.photos/seed/ndj-topo2/700/700","https://picsum.photos/seed/ndj-topo3/700/700","https://picsum.photos/seed/ndj-topo4/700/700","https://picsum.photos/seed/ndj-topo5/700/700"]',
  '[{"nome":"Dourado","hex":"#B08D57"},{"nome":"Prata","hex":"#C9C9C9"},{"nome":"Preto","hex":"#1B1815"},{"nome":"Rosé","hex":"#D8BD8E"}]',
  '{"disponivel":true,"precoExtra":12,"rotulo":"Nome ou idade para o topo","maxCaracteres":18}',
  'Topo de bolo feito sob medida com o nome ou número do aniversariante, corte elegante em filamento com efeito metalizado.',
  '["Impresso sob encomenda","Haste inclusa","Acabamento metalizado"]',
  999, 'https://shopee.com.br/', ''),

('p006', 'Vaso Geométrico Decorativo', 'decoracao', 68.90,
  '["https://picsum.photos/seed/ndj-vaso1/700/700","https://picsum.photos/seed/ndj-vaso2/700/700","https://picsum.photos/seed/ndj-vaso3/700/700","https://picsum.photos/seed/ndj-vaso4/700/700","https://picsum.photos/seed/ndj-vaso5/700/700"]',
  '[{"nome":"Terracota","hex":"#B0473F"},{"nome":"Bronze","hex":"#8A6B3D"},{"nome":"Branco","hex":"#F4EEE2"},{"nome":"Preto","hex":"#1B1815"}]',
  '{"disponivel":false,"precoExtra":0,"rotulo":"","maxCaracteres":0}',
  'Vaso com padrão geométrico facetado, perfeito para suculentas e plantas pequenas. Peça única que vira ponto focal em qualquer ambiente.',
  '["Furo de drenagem opcional","Altura: 14cm","Acabamento fosco"]',
  40, 'https://shopee.com.br/', ''),

('p007', 'Luminária de Mesa Lowpoly', 'decoracao', 89.90,
  '["https://picsum.photos/seed/ndj-luminaria1/700/700","https://picsum.photos/seed/ndj-luminaria2/700/700","https://picsum.photos/seed/ndj-luminaria3/700/700","https://picsum.photos/seed/ndj-luminaria4/700/700","https://picsum.photos/seed/ndj-luminaria5/700/700"]',
  '[{"nome":"Branco","hex":"#F4EEE2"},{"nome":"Preto","hex":"#1B1815"}]',
  '{"disponivel":true,"precoExtra":15,"rotulo":"Nome gravado na base","maxCaracteres":12}',
  'Luminária com design facetado (lowpoly) que cria um efeito de luz e sombra único no ambiente. Acompanha soquete e fiação com plugue.',
  '["Lâmpada LED inclusa","Fiação com selo INMETRO","Altura: 22cm"]',
  25, 'https://shopee.com.br/', ''),

('p008', 'Porta-retrato Articulado', 'presentes', 29.90,
  '["https://picsum.photos/seed/ndj-retrato1/700/700","https://picsum.photos/seed/ndj-retrato2/700/700","https://picsum.photos/seed/ndj-retrato3/700/700","https://picsum.photos/seed/ndj-retrato4/700/700","https://picsum.photos/seed/ndj-retrato5/700/700"]',
  '[{"nome":"Bronze","hex":"#8A6B3D"},{"nome":"Preto","hex":"#1B1815"},{"nome":"Branco","hex":"#F4EEE2"}]',
  '{"disponivel":true,"precoExtra":8,"rotulo":"Frase ou data na base","maxCaracteres":24}',
  'Porta-retrato com dobradiça impressa em peça única, sem parafusos. Um presente afetivo e diferente para fotos 10x15.',
  '["Sem parafusos ou colas","Encaixe para foto 10x15cm","Base com frase personalizável"]',
  70, 'https://shopee.com.br/', '')
on conflict (id) do nothing;
