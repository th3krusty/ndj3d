// ==========================================================================
// NDJ 3D — Edge Function: criar-preferencia-mp
// Chamada pelo checkout do site (js/checkout.js) depois que o pedido já foi
// criado no banco com status "pendente". Esta função cria a cobrança no
// Mercado Pago (uma "preference" do Checkout Pro) e devolve o link de
// pagamento (init_point) para o navegador redirecionar o cliente.
//
// Precisa do secret MERCADOPAGO_ACCESS_TOKEN configurado no projeto
// (Supabase → Edge Functions → Secrets). Veja o README para o passo a passo.
// ==========================================================================
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if(req.method === 'OPTIONS'){
    return new Response('ok', { headers: CORS_HEADERS });
  }

  try {
    const { numero, itens, frete, cliente, urlBase } = await req.json();

    if(!numero || !Array.isArray(itens) || !itens.length){
      return new Response(JSON.stringify({ erro: 'Dados do pedido incompletos.' }), {
        status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
      });
    }

    const accessToken = Deno.env.get('MERCADOPAGO_ACCESS_TOKEN');
    if(!accessToken){
      return new Response(JSON.stringify({ erro: 'MERCADOPAGO_ACCESS_TOKEN não configurado no projeto.' }), {
        status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');

    // Monta os itens da cobrança (um item por produto do carrinho + frete, se houver)
    const itensMp = itens.map((i) => ({
      title: String(i.nome).slice(0, 250),
      quantity: Number(i.quantidade) || 1,
      unit_price: Number(i.precoUnitario) || 0,
      currency_id: 'BRL'
    }));
    if(frete && frete.preco > 0){
      itensMp.push({
        title: 'Frete - ' + (frete.nome || 'Entrega'),
        quantity: 1,
        unit_price: Number(frete.preco),
        currency_id: 'BRL'
      });
    }

    const base = (urlBase || '').replace(/\/$/, '');
    const preferencia = {
      items: itensMp,
      payer: { name: cliente?.nome || '', email: cliente?.email || undefined },
      external_reference: numero,
      back_urls: {
        success: `${base}/pedido.html?numero=${numero}`,
        pending: `${base}/pedido.html?numero=${numero}`,
        failure: `${base}/checkout.html?falha=1`
      },
      auto_return: 'approved',
      notification_url: `${supabaseUrl}/functions/v1/webhook-mp`,
      statement_descriptor: 'NDJ3D'
    };

    const respostaMp = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify(preferencia)
    });

    const dadosMp = await respostaMp.json();

    if(!respostaMp.ok){
      console.error('Erro do Mercado Pago:', dadosMp);
      return new Response(JSON.stringify({ erro: 'O Mercado Pago recusou a criação da cobrança.' }), {
        status: 502, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
      });
    }

    // Guarda o id da preferência no pedido, pra facilitar conferência depois.
    const supabaseAdmin = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'));
    await supabaseAdmin.from('pedidos').update({ mp_preference_id: dadosMp.id }).eq('numero', numero);

    return new Response(JSON.stringify({ initPoint: dadosMp.init_point, preferenceId: dadosMp.id }), {
      status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
    });
  } catch (err) {
    console.error('Erro inesperado em criar-preferencia-mp:', err);
    return new Response(JSON.stringify({ erro: 'Erro interno ao criar o pagamento.' }), {
      status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
    });
  }
});
