-- ==========================================================================
-- NDJ 3D — Migração para o modelo de CATÁLOGO
-- Rode isto no SQL Editor do Supabase SE o seu banco já existia antes
-- (site antigo, com carrinho/checkout/Mercado Pago).
--
-- Este script é seguro e NÃO destrutivo:
--   • adiciona a coluna que falta (tiktok_url) sem apagar nada;
--   • NÃO apaga as tabelas antigas (pedidos, cupons, avaliacoes) — o site
--     novo simplesmente não usa mais elas, mas seu histórico de pedidos
--     continua salvo no banco, caso queira consultar depois.
-- Pode rodar quantas vezes quiser, ele não duplica nada.
-- ==========================================================================

-- Novo campo: link do produto no TikTok Shop (fica vazio até você
-- cadastrar — o site mostra "em breve" nesse caso).
alter table public.produtos add column if not exists tiktok_url text;

-- O campo peso_kg (usado antes para calcular frete no próprio site) não é
-- mais usado pelo painel admin nem pela página do produto, mas a coluna
-- continua no banco sem problema — não precisa remover.

-- Novo campo: pedido mínimo por produto (se o produto exige uma
-- quantidade mínima e qual é). Fica desativado por padrão.
alter table public.produtos add column if not exists pedido_minimo jsonb not null default '{"ativo":false,"quantidade":1}';

-- Cada cor dentro de "cores" agora pode ter um campo "foto" (URL da foto
-- de referência real daquela cor). Como "cores" é jsonb, nenhuma alteração
-- de coluna é necessária — o painel admin já passa a salvar esse campo
-- quando você anexar uma foto ao cadastrar a cor.

-- ==========================================================================
-- OPCIONAL — só rode o bloco abaixo se você tiver certeza de que não
-- precisa mais do histórico de pedidos, cupons e avaliações do site antigo.
-- Isso apaga essas tabelas e os dados nelas PARA SEMPRE.
-- ==========================================================================

-- drop table if exists public.avaliacoes;
-- drop table if exists public.pedidos;
-- drop table if exists public.cupons;
