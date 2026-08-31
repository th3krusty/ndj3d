# NDJ 3D — Site de E-commerce

Site completo (HTML + CSS + JavaScript puro, sem necessidade de build) para a
loja **NDJ 3D — Ideias que ganham forma**.

## Estrutura de arquivos

```
ndj3d/
├── index.html          → Página inicial
├── produtos.html        → Catálogo com filtro por categoria e busca
├── produto.html          → Página de um produto (fotos, cor, personalização, frete)
├── carrinho.html         → Carrinho de compras + cupom de desconto
├── checkout.html         → Dados de entrega + pagamento
├── pedido.html            → Confirmação do pedido e rastreio
├── contato.html           → Formulário e canais de contato
├── admin.html              → Painel administrador
├── css/
│   ├── style.css        → Estilo de todo o site (separado do HTML)
│   └── admin.css         → Estilo exclusivo do painel admin
├── js/
│   ├── data.js           → "Banco de dados" local (produtos, cupons, pedidos)
│   ├── main.js            → Cabeçalho, categorias, listagem de produtos
│   ├── produto.js          → Lógica da página de produto
│   ├── carrinho.js          → Lógica do carrinho
│   ├── checkout.js           → Lógica do checkout / pagamento simulado
│   ├── pedido.js               → Confirmação e rastreio de pedido
│   ├── contato.js               → Formulário de contato
│   └── admin.js                  → Painel administrador (CRUD completo)
└── assets/
    └── logo.jpg          → Sua logo
```

## ✏️ Layout compartilhado (edite uma vez, atualiza em todas as páginas)

O aviso do topo, o cabeçalho, o rodapé e os botões flutuantes de WhatsApp/Instagram
**não ficam mais copiados em cada página**. Eles são montados automaticamente pelo
`js/layout.js`, usando os dados de `js/config.js`.

**Para mudar o texto do aviso do topo, WhatsApp, Instagram, e-mail, endereço ou o
crédito do rodapé, edite só um arquivo:** `js/config.js`. A alteração aparece em
todas as 7 páginas da loja de uma vez.

Cada página HTML agora só tem "placeholders" vazios que o `layout.js` preenche:
```html
<div class="topo-aviso" id="ndj-topo-aviso"></div>
<header class="cabecalho" id="ndj-cabecalho"></header>
...
<footer class="rodape" id="ndj-rodape"></footer>
<div id="ndj-flutuantes"></div>
```
Por isso é importante manter, em cada página, os `<script>` na ordem:
`data.js` → `config.js` → `layout.js` → (demais scripts da página).

Algumas páginas têm um layout mais simples de propósito — isso é controlado por
atributos no `<body>`:
- `data-nav="0"` → esconde o menu de navegação (usado no `checkout.html`, para não
  distrair o cliente na hora de pagar)
- `data-flutuantes="0"` → esconde os botões flutuantes
- `data-rodape="minimo"` → mostra só a linha de copyright no rodapé

## 📱 Correção do menu mobile

O menu estava "quebrando" no celular porque o botão ☰ apenas trocava um estilo
inline, e o menu reaparecia *dentro* da mesma linha do cabeçalho, empurrando o
ícone do carrinho. Agora o menu mobile é um menu suspenso (dropdown) que abre
por baixo do cabeçalho, fecha ao clicar em um link ou fora dele, e o breakpoint
foi ajustado para telas de até 860px — evitando o aperto em tablets e notebooks
menores também.

## Como abrir e testar

Basta abrir `index.html` diretamente no navegador, ou hospedar a pasta inteira
em qualquer serviço de hospedagem estática (Netlify, Vercel, GitHub Pages,
Hostinger, cPanel etc. — como são só arquivos HTML/CSS/JS, funciona em
qualquer lugar).

## Painel administrador

Acesse `admin.html`.
**Login:** agora feito via Supabase Auth — veja README-SUPABASE.md para criar
o usuário administrador e definir a senha. A senha pode ser trocada depois
em Configurações, dentro do próprio painel.

No painel você pode:
- Cadastrar produtos com até 5 fotos (via link/URL), cores, preço, opção de
  personalização com preço adicional, descrição, características, peso e link
  da Shopee.
- Editar ou excluir qualquer produto existente.
- Criar, ativar/desativar e excluir cupons de desconto (percentual ou fixo).
- Ver todos os pedidos recebidos e atualizar o status de envio (o cliente
  acompanha essa mesma informação na página de rastreio).
- Trocar a senha de acesso ao painel.

## Onde ficam os dados

Este site usa o **Supabase** como banco de dados (produtos, categorias,
cupons, pedidos e avaliações). Isso significa que um pedido feito por um
cliente já aparece no painel administrador em qualquer computador, sem
precisar ser o mesmo navegador. Veja o passo a passo completo de configuração
em **README-SUPABASE.md**.

O carrinho de compras continua salvo no `localStorage` do navegador — faz
sentido ficar assim, é só o "rascunho" da compra de quem está navegando
naquele momento, antes de finalizar o pedido.

## ⚠️ Sobre o pagamento online

O checkout já está com o fluxo completo (Pix, cartão e boleto), mas o
processamento do pagamento está **simulado** — ele não cobra ninguém de
verdade. Antes de vender de fato, você precisa contratar um gateway de
pagamento, por exemplo:
- **Mercado Pago** (Checkout Pro/Transparente)
- **PagSeguro / PagBank**
- **Stripe**

O ponto exato para integrar é a função `ndjFinalizarPedido()` em
`js/checkout.js`: no lugar do `setTimeout` que simula o processamento, você
chamaria a API do gateway escolhido (normalmente feito a partir de um
pequeno backend, para manter as chaves de API seguras) e só criaria o
pedido (`ndjCriarPedido`) depois da confirmação real do pagamento.

## Outras integrações que valem a pena

- **Formulário de contato**: hoje ele só mostra uma mensagem de confirmação.
  Ligue-o a um serviço como Formspree, EmailJS ou seu próprio backend para
  as mensagens chegarem no seu e-mail de verdade.
- **WhatsApp e Instagram**: os botões flutuantes já apontam para
  `wa.me/5546988372988` e `instagram.com/ndj3d` — troque pelos seus números e
  perfil reais em todos os arquivos HTML (procure por `flutuantes`).
- **Shopee**: cada produto tem um ícone 🛍️ que leva ao link cadastrado no
  campo "Link da Shopee" — edite esse campo no painel admin para cada anúncio.
- **Frete**: o cálculo hoje é uma simulação por faixa de CEP. Para valores
  reais dos Correios/transportadoras, integre a API dos Correios ou um
  serviço como Melhor Envio.
