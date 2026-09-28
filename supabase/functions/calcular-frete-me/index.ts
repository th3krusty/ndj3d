// ==========================================================================
// NDJ 3D — Edge Function "calcular-frete-me"
//
// Recebe do site (produto.html e checkout.html): { cepDestino, itens }, onde
// itens = [{ nome, pesoKg, preco, quantidade }, ...]. Consulta a API do
// Melhor Envio com o CEP de origem da loja e devolve as opções reais de
// frete (Correios e transportadoras parceiras), já com o desconto do
// Melhor Envio aplicado.
//
// CONFIGURAÇÃO NECESSÁRIA (Painel Supabase → Edge Functions → Secrets):
//   ME_ACCESS_TOKEN   → Token pessoal de acesso da sua conta Melhor Envio
//                        (Painel Melhor Envio → Gerenciar Tokens → Gerar
//                        novo token, com o escopo "Cotações"). Não precisa
//                        do fluxo OAuth2 completo, esse token pessoal já
//                        funciona pra cotação de fretes.
//   ME_USER_AGENT     → Obrigatório pela API do Melhor Envio. Formato:
//                        "Nome da Loja (email@contato.com)", ex:
//                        "NDJ 3D (ndj3d@outlook.com)"
//   ME_CEP_ORIGEM     → Opcional. CEP de onde os produtos são enviados.
//                        Se não configurar, usa 85560-000 (Chopinzinho/PR)
//                        como padrão.
//
// Por padrão esta função usa o ambiente de PRODUÇÃO do Melhor Envio. Pra
// testar sem gerar cobrança real, troque ME_API_BASE_URL (secret opcional)
// para "https://sandbox.melhorenvio.com.br" e use um token gerado no
// ambiente sandbox da sua conta.
//
// Para publicar: supabase functions deploy calcular-frete-me
// ==========================================================================

import { serve } from "https://deno.land/std@0.201.0/http/server.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

// Dimensões padrão de caixa usadas para todos os produtos (em cm), já que
// as peças do catálogo são pequenas e de tamanho parecido (chaveiros,
// enfeites, suportes etc.). O Melhor Envio calcula o empacotamento
// automaticamente a partir disso — não precisa informar pacotes prontos.
const CAIXA_PADRAO_CM = { largura: 11, altura: 4, comprimento: 16 };

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  try {
    const ME_ACCESS_TOKEN = Deno.env.get("ME_ACCESS_TOKEN");
    const ME_USER_AGENT = Deno.env.get("ME_USER_AGENT") || "NDJ 3D (ndj3d@outlook.com)";
    const ME_CEP_ORIGEM = (Deno.env.get("ME_CEP_ORIGEM") || "85560000").replace(/\D/g, "");
    const ME_API_BASE_URL = Deno.env.get("ME_API_BASE_URL") || "https://melhorenvio.com.br";

    if (!ME_ACCESS_TOKEN) {
      throw new Error("ME_ACCESS_TOKEN não configurado nas Secrets da função.");
    }

    const { cepDestino, itens } = await req.json();
    const destino = (cepDestino || "").replace(/\D/g, "");

    if (destino.length !== 8) {
      return new Response(
        JSON.stringify({ error: "CEP de destino inválido." }),
        { status: 200, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }
    if (!itens || !itens.length) {
      throw new Error("Nenhum item informado para calcular o frete.");
    }

    const products = itens.map((item: any, i: number) => ({
      id: item.nome ? String(item.nome).slice(0, 40) : `item-${i}`,
      width: CAIXA_PADRAO_CM.largura,
      height: CAIXA_PADRAO_CM.altura,
      length: CAIXA_PADRAO_CM.comprimento,
      weight: Math.max(0.05, Number(item.pesoKg) || 0.3),
      insurance_value: Number(item.preco) || 0,
      quantity: Math.max(1, parseInt(item.quantidade) || 1)
    }));

    const resposta = await fetch(`${ME_API_BASE_URL}/api/v2/me/shipment/calculate`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${ME_ACCESS_TOKEN}`,
        "Accept": "application/json",
        "Content-Type": "application/json",
        "User-Agent": ME_USER_AGENT
      },
      body: JSON.stringify({
        from: { postal_code: ME_CEP_ORIGEM },
        to: { postal_code: destino },
        products,
        options: { receipt: false, own_hand: false }
      })
    });

    const dadosMe = await resposta.json();

    if (!resposta.ok) {
      console.error("Erro do Melhor Envio:", dadosMe);
      throw new Error(dadosMe?.message || "Não foi possível consultar o frete no Melhor Envio.");
    }

    const opcoes = (Array.isArray(dadosMe) ? dadosMe : [])
      .filter((item: any) => !item.error)
      .map((item: any) => {
        const valor = parseFloat(item.custom_price ?? item.price);
        const nomeTransportadora = item.company?.name ? `${item.company.name} ${item.name}` : item.name;
        return {
          id: String(item.id),
          nome: nomeTransportadora,
          prazoDias: item.delivery_time,
          valor
        };
      })
      .filter((op: any) => !isNaN(op.valor))
      .sort((a: any, b: any) => a.valor - b.valor);

    return new Response(
      JSON.stringify({ opcoes }),
      { headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error(err);
    return new Response(
      JSON.stringify({ error: err.message || "Erro inesperado ao calcular o frete." }),
      { status: 200, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  }
});
