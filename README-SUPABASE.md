# NDJ 3D — Como subir no Supabase

O site deixou de usar `localStorage` (dados só no navegador de cada pessoa) e
passou a usar o Supabase como banco de dados real. Siga os passos abaixo uma
única vez, para deixar tudo funcionando.

## 1. Criar o projeto no Supabase

1. Acesse [supabase.com](https://supabase.com) e crie (ou entre na) sua conta.
2. Clique em **New project**, escolha um nome (ex: `ndj3d`) e uma senha forte
   para o banco (guarde essa senha em outro lugar, não é a mesma coisa da
   senha do painel admin do site).
3. Espere o projeto terminar de ser criado (leva 1-2 minutos).

## 2. Rodar o schema (criar as tabelas)

1. No painel do projeto, abra **SQL Editor** (menu lateral) → **New query**.
2. Abra o arquivo `supabase/schema.sql` (está junto com os arquivos do site),
   copie todo o conteúdo e cole no editor.
3. Clique em **Run**. Isso cria as tabelas `produtos`, `categorias`, `cupons`,
   `pedidos` e `avaliacoes`, ativa a segurança (RLS) e já insere o catálogo
   de demonstração (os mesmos 8 produtos que já vinham no site).

## 3. Pegar a URL e a chave (anon key) do projeto

1. No menu lateral, vá em **Project Settings** → **API**.
2. Copie o **Project URL** (algo como `https://xxxxxxxx.supabase.co`).
3. Copie a chave em **Project API keys → anon public** (é uma chave longa,
   começando com `eyJ...`).
4. Abra `js/supabaseClient.js` no código do site e cole os dois valores:

```js
const SUPABASE_URL = 'https://xxxxxxxx.supabase.co';
const SUPABASE_ANON_KEY = 'eyJ...';
```

**Importante:** essa é a chave "anon" (pública) — ela é para ficar no
navegador mesmo, sem problema. Nunca use a chave `service_role` no código
do site (essa é secreta).

## 4. Criar o usuário administrador (login do painel /admin.html)

O login do painel agora usa o **Supabase Auth** em vez da senha fixa
`ndj3d2026` que ficava salva no navegador.

1. No painel do Supabase, vá em **Authentication** → **Users** → **Add user**
   → **Create new user**.
2. Preencha um e-mail (pode ser qualquer um seu, ex: `admin@ndj3d.com.br`) e
   uma senha de sua escolha. Marque **Auto Confirm User** para não precisar
   confirmar por e-mail.
3. Abra `js/supabaseClient.js` e garanta que `NDJ_ADMIN_EMAIL` está com o
   **mesmo e-mail** que você cadastrou:

```js
const NDJ_ADMIN_EMAIL = 'admin@ndj3d.com.br';
```

4. Pronto: em `admin.html`, digite a **senha** que você definiu no passo 2
   (o e-mail já está fixo no código, você só digita a senha, igual antes).

Se quiser trocar a senha depois, use a tela **Configurações** dentro do
próprio painel admin (ela agora chama o Supabase Auth por trás).

## 5. Publicar no Vercel (ou onde você já hospeda o site)

Nada muda aqui — continua sendo um site 100% estático (HTML/CSS/JS puro).
Basta fazer o deploy da pasta normalmente (ex: `vercel --prod`, ou arrastar
a pasta pro painel do Vercel). O site vai se conectar direto ao Supabase
pelo navegador de cada visitante.

## O que mudou, na prática

- Produtos, categorias, cupons, pedidos e avaliações agora ficam no
  Supabase — um pedido feito por um cliente já aparece no painel admin
  em qualquer computador, sem precisar do mesmo navegador.
- O carrinho de compras continua no `localStorage` (faz sentido: é só o
  "rascunho" de compra de quem está navegando naquele momento).
- O login do admin passou a usar Supabase Auth (mais seguro que a senha
  simples salva no navegador de antes).

## Sobre segurança (leia antes de vender de verdade)

Como o site não tem um servidor próprio, toda escrita no banco (criar
pedido, salvar produto no admin etc.) é feita direto do navegador usando a
chave pública (anon key) — inclusive as ações do próprio painel admin, que
hoje ficam "escondidas" atrás do login, mas tecnicamente qualquer pessoa que
souber sua URL e anon key poderia chamar a API do Supabase diretamente (isso
já valia, de outro jeito, no site anterior 100% localStorage — só que agora
os dados são compartilhados entre todo mundo, então vale mais a pena
reforçar isso quando o volume de vendas crescer).

As políticas de RLS em `supabase/schema.sql` já deixam **produtos**,
**categorias** e **cupons** protegidos contra escrita por quem não estiver
logado como admin. **Pedidos** e **avaliações** continuam abertos para
escrita pública (é necessário, para o cliente conseguir finalizar a compra e
avaliar sem fazer login). Se no futuro você quiser reforçar isso — por
exemplo, impedir que alguém finalize pedidos "fantasmas" só chamando a API
direto — o próximo passo é mover essas escritas para uma **Supabase Edge
Function** (roda no servidor do Supabase, usando a chave secreta
`service_role`) em vez de fazer direto do navegador. Isso também é o momento
certo para conectar um gateway de pagamento de verdade (Mercado Pago,
PagSeguro, Stripe — ver README.md), já que o pagamento simulado hoje também
não deveria ficar só no navegador.

## Onde ver os dados

No painel do Supabase, em **Table Editor**, você pode ver e editar
diretamente as linhas de `produtos`, `categorias`, `cupons`, `pedidos` e
`avaliacoes` — útil para corrigir algo rápido sem precisar abrir o painel
admin do site.
