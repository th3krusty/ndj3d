// ==========================================================================
// NDJ 3D — Edge Function "webhook-mp"
//
// Recebe as notificações que o Mercado Pago envia quando o status de um
// pagamento muda (aprovado, recusado, estornado...). Consulta os detalhes
// do pagamento na API do Mercado Pago e atualiza o pedido correspondente
// (encontrado pelo external_reference = número do pedido) na tabela
// "pedidos" do Supabase.
//
// CONFIGURAÇÃO NECESSÁRIA (Painel Supabase → Edge Functions → Secrets):
//   MP_ACCESS_TOKEN            → mesmo token usado em criar-preferencia-mp
//   SUPABASE_URL               → preenchido automaticamente pelo Supabase
//   SUPABASE_SERVICE_ROLE_KEY  → chave "service role" do projeto (Painel →
//                                 Settings → API) — necessária pois esta
//                                 função escreve na tabela ignorando RLS.
//
// No Mercado Pago, configure a notification_url (webhook) apontando para:
//   https://<seu-projeto>.supabase.co/functions/v1/webhook-mp
// (isso já é feito automaticamente pela função criar-preferencia-mp em
// cada preferência criada, mas também pode configurar globalmente no
// painel do Mercado Pago em Suas integrações → Webhooks).
//
// Para publicar: supabase functions deploy webhook-mp --no-verify-jwt
// ==========================================================================

import { serve } from "https://deno.land/std@0.201.0/http/server.ts";

serve(async (req) => {
  try {
    const MP_ACCESS_TOKEN = Deno.env.get("MP_ACCESS_TOKEN");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!MP_ACCESS_TOKEN || !SUPABASE_URL || !SERVICE_ROLE_KEY) {
      throw new Error("Variáveis de ambiente não configuradas.");
    }

    const url = new URL(req.url);
    let paymentId = url.searchParams.get("data.id") || url.searchParams.get("id");
    let topic = url.searchParams.get("type") || url.searchParams.get("topic");

    // Algumas notificações do Mercado Pago vêm no corpo (POST JSON) em vez
    // da query string — cobre os dois formatos.
    if (req.method === "POST") {
      try {
        const body = await req.json();
        paymentId = paymentId || body?.data?.id || body?.id;
        topic = topic || body?.type || body?.topic;
      } catch (_e) {
        // corpo vazio ou não-JSON — segue só com os query params
      }
    }

    // Só nos interessam notificações de pagamento.
    if (topic && topic !== "payment") {
      return new Response("ignorado", { status: 200 });
    }
    if (!paymentId) {
      return new Response("sem payment id", { status: 200 });
    }

    // Busca os detalhes reais do pagamento na API do Mercado Pago (nunca
    // confiar cegamente no conteúdo da notificação recebida).
    const respostaPagamento = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { "Authorization": `Bearer ${MP_ACCESS_TOKEN}` }
    });
    const pagamento = await respostaPagamento.json();

    if (!respostaPagamento.ok) {
      console.error("Erro ao consultar pagamento no Mercado Pago:", pagamento);
      return new Response("erro ao consultar pagamento", { status: 200 });
    }

    const numeroPedido = pagamento.external_reference;
    if (!numeroPedido) {
      return new Response("pagamento sem pedido associado", { status: 200 });
    }

    // Mapeia o status do Mercado Pago para o status interno do pedido.
    const mapaStatus: Record<string, string> = {
      approved: "pago",
      pending: "aguardando_pagamento",
      in_process: "aguardando_pagamento",
      rejected: "cancelado",
      cancelled: "cancelado",
      refunded: "cancelado",
      charged_back: "cancelado"
    };
    const novoStatus = mapaStatus[pagamento.status] || "aguardando_pagamento";

    // Busca o pedido atual pra atualizar as etapas preservando as datas
    // que já tinham sido preenchidas.
    const respostaPedido = await fetch(
      `${SUPABASE_URL}/rest/v1/pedidos?numero=eq.${encodeURIComponent(numeroPedido)}&select=etapas`,
      { headers: { "apikey": SERVICE_ROLE_KEY, "Authorization": `Bearer ${SERVICE_ROLE_KEY}` } }
    );
    const pedidosEncontrados = await respostaPedido.json();
    const etapas = (pedidosEncontrados && pedidosEncontrados[0] && pedidosEncontrados[0].etapas) || [];
    const etapa = etapas.find((e: any) => e.chave === novoStatus);
    if (etapa && !etapa.data) etapa.data = new Date().toISOString();

    await fetch(`${SUPABASE_URL}/rest/v1/pedidos?numero=eq.${encodeURIComponent(numeroPedido)}`, {
      method: "PATCH",
      headers: {
        "apikey": SERVICE_ROLE_KEY,
        "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        status: novoStatus,
        etapas,
        mp_payment_id: String(pagamento.id)
      })
    });

    return new Response("ok", { status: 200 });
  } catch (err) {
    console.error(err);
    // Sempre responde 200 pro Mercado Pago não ficar reenviando a
    // notificação indefinidamente por um erro do nosso lado.
    return new Response("erro interno", { status: 200 });
  }
});
