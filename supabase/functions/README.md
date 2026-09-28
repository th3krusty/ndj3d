# Edge Functions — Mercado Pago

Duas funções cuidam do pagamento pelo site:

- **`criar-preferencia-mp`** — chamada pelo checkout do site. Cria a
  cobrança no Mercado Pago e devolve o link de pagamento (`init_point`).
- **`webhook-mp`** — recebida pelo Mercado Pago quando o status de um
  pagamento muda. Atualiza o pedido no banco (pago, cancelado etc.).

## 1. Pegar o Access Token do Mercado Pago

1. Entre em https://www.mercadopago.com.br/developers/panel
2. Crie (ou abra) uma aplicação → **Credenciais de produção**
3. Copie o **Access Token** (começa com `APP_USR-...`)

## 2. Configurar as variáveis (Secrets) no Supabase

No painel do Supabase → **Edge Functions → Manage secrets**, adicione:

| Nome                          | Valor |
|-------------------------------|-------|
| `MP_ACCESS_TOKEN`              | o Access Token copiado acima |
| `SITE_URL`                     | a URL pública do site, ex: `https://ndj3d.com.br` |
| `SUPABASE_SERVICE_ROLE_KEY`    | Painel → Settings → API → `service_role` (secreta!) |

(`SUPABASE_URL` já é preenchida automaticamente pelo Supabase.)

## 3. Publicar as funções

Com a [Supabase CLI](https://supabase.com/docs/guides/cli) instalada e logada:

```bash
supabase functions deploy criar-preferencia-mp
supabase functions deploy webhook-mp --no-verify-jwt
```

O `--no-verify-jwt` no webhook é necessário porque quem chama essa função é
o próprio Mercado Pago (sem token de usuário do site).

## 4. Testar

Faça uma compra de teste no site usando as
[credenciais e cartões de teste](https://www.mercadopago.com.br/developers/pt/docs/checkout-pro/additional-content/your-integrations/test/cards)
do Mercado Pago antes de liberar para clientes reais.

---

# Edge Function — Melhor Envio (frete real)

A função **`calcular-frete-me`** substitui a simulação de frete por uma
cotação real (Correios e transportadoras parceiras), usando o CEP de
origem **85560-000**.

## 1. Gerar o token pessoal de acesso

Você **não precisa de CNPJ nem do fluxo OAuth2 completo** — só do token
pessoal da sua própria conta:

1. Crie uma conta grátis em https://melhorenvio.com.br (pode ser com CPF)
2. Vá em **Gerenciar Tokens** (dentro de Integrações/API no painel)
3. Clique em **Gerar novo Token**, dê um nome (ex: "Site NDJ 3D") e marque
   pelo menos o escopo de **cotação de fretes**
4. Copie o token gerado — ele começa parecido com um JWT longo

## 2. Configurar as Secrets no Supabase

No painel do Supabase → **Edge Functions → Manage secrets**, adicione:

| Nome | Valor |
|---|---|
| `ME_ACCESS_TOKEN` | o token pessoal gerado acima |
| `ME_USER_AGENT` | `NDJ 3D (seu-email@exemplo.com)` — obrigatório pela API |
| `ME_CEP_ORIGEM` | `85560000` (já é o padrão mesmo se não configurar) |

## 3. Publicar a função

```bash
supabase functions deploy calcular-frete-me
```

## 4. Testar sem gerar cotações "de verdade" (opcional)

O Melhor Envio tem um ambiente sandbox separado, com seu próprio login e
token. Pra usar:

1. Crie uma conta em https://sandbox.melhorenvio.com.br e gere um token lá
2. Adicione a secret `ME_API_BASE_URL` = `https://sandbox.melhorenvio.com.br`
3. Troque `ME_ACCESS_TOKEN` pelo token do sandbox
4. Depois de testar, é só apagar a secret `ME_API_BASE_URL` (ou trocar de
   volta para o token de produção) pra voltar ao ambiente real

## Observação sobre as dimensões da caixa

Como os produtos da NDJ 3D são pequenos e parecidos em tamanho, a função
usa uma caixa padrão de **16 x 11 x 4 cm** para todos os produtos — só o
peso (cadastrado em cada produto no admin) e o valor declarado (usado no
seguro do envio) variam. Se no futuro você vender algo bem maior ou menor
que isso, me avise que ajusto o cálculo para usar as dimensões reais de
cada produto.
