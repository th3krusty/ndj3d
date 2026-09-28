// ==========================================================================
// NDJ 3D — Edge Function "criar-preferencia-mp"
//
// Recebe do checkout do site: { pedidoNumero, itens, frete, desconto,
// total, cliente }. Cria uma "preferência de pagamento" no Mercado Pago
// (Checkout Pro) e devolve { init_point }, o link para onde o navegador do
// cliente deve ser redirecionado para pagar com Pix, cartão ou boleto.
//
// CONFIGURAÇÃO NECESSÁRIA (Painel Supabase → Edge Functions → Secrets):
//   MP_ACCESS_TOKEN (ou MERCADOPAGO_ACCESS_TOKEN) → Access Token de
//                        produção da sua conta Mercado Pago (Mercado Pago
//                        → Seu negócio → Configurações → Credenciais de
//                        produção). Qualquer um dos dois nomes funciona.
//   SITE_URL          → URL pública do site, ex: https://ndj3d.com.br
//                        (usada para montar os links de volta do pagamento)
//
// Para publicar: supabase functions deploy criar-preferencia-mp
// ==========================================================================

import { serve } from "https://deno.land/std@0.201.0/http/server.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  try {
    const MP_ACCESS_TOKEN = Deno.env.get("MP_ACCESS_TOKEN") || Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");
    const SITE_URL = Deno.env.get("SITE_URL") || "https://ndj3d.com.br";

    if (!MP_ACCESS_TOKEN) {
      throw new Error("Access Token do Mercado Pago não configurado nas Secrets da função (MP_ACCESS_TOKEN ou MERCADOPAGO_ACCESS_TOKEN).");
    }

    const { pedidoNumero, itens, frete, desconto, total, cliente } = await req.json();

    if (!pedidoNumero || !itens || !itens.length) {
      throw new Error("Dados do pedido incompletos.");
    }

    // Monta a lista de itens no formato exigido pelo Mercado Pago.
    const items = itens.map((item: any) => ({
      title: item.nome + (item.cor ? ` (${item.cor})` : ""),
      quantity: item.quantidade,
      unit_price: Number(item.precoUnitario),
      currency_id: "BRL"
    }));

    if (frete && frete > 0) {
      items.push({ title: "Frete", quantity: 1, unit_price: Number(frete), currency_id: "BRL" });
    }

    // O desconto do cupom é aplicado como um item de valor negativo, já
    // que a API de preferências não tem um campo de desconto dedicado.
    if (desconto && desconto > 0) {
      items.push({ title: "Desconto (cupom)", quantity: 1, unit_price: -Number(desconto), currency_id: "BRL" });
    }

    const preferencia = {
      items,
      payer: {
        name: cliente?.nome || "",
        email: cliente?.email || undefined,
        identification: cliente?.cpf ? { type: "CPF", number: String(cliente.cpf).replace(/\D/g, "") } : undefined
      },
      external_reference: pedidoNumero,
      back_urls: {
        success: `${SITE_URL}/pedido.html?pedido=${pedidoNumero}`,
        pending: `${SITE_URL}/pedido.html?pedido=${pedidoNumero}`,
        failure: `${SITE_URL}/checkout.html?pedido=${pedidoNumero}&erro=pagamento`
      },
      auto_return: "approved",
      notification_url: `${Deno.env.get("SUPABASE_URL")}/functions/v1/webhook-mp`,
      statement_descriptor: "NDJ3D"
    };

    const resposta = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${MP_ACCESS_TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(preferencia)
    });

    const dadosMp = await resposta.json();

    if (!resposta.ok) {
      console.error("Erro do Mercado Pago:", dadosMp);
      throw new Error(dadosMp?.message || "Não foi possível criar a preferência de pagamento.");
    }

    if (!dadosMp.init_point) {
      console.error("Mercado Pago não devolveu init_point:", dadosMp);
      throw new Error("Mercado Pago não devolveu o link de pagamento (init_point). Verifique se o Access Token é de PRODUÇÃO, não de teste/sandbox.");
    }

    // Guarda o id da preferência no pedido, pra facilitar conferência depois.
    try {
      const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
      const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      if (SUPABASE_URL && SERVICE_ROLE_KEY) {
        await fetch(`${SUPABASE_URL}/rest/v1/pedidos?numero=eq.${encodeURIComponent(pedidoNumero)}`, {
          method: "PATCH",
          headers: {
            "apikey": SERVICE_ROLE_KEY,
            "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ mp_preference_id: dadosMp.id })
        });
      }
    } catch (e) {
      console.error("Não foi possível salvar mp_preference_id (não impede o pagamento):", e);
    }

    return new Response(
      JSON.stringify({ init_point: dadosMp.init_point, preference_id: dadosMp.id }),
      { headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error(err);
    return new Response(
      JSON.stringify({ error: err.message || "Erro inesperado ao criar pagamento." }),
      { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  }
});