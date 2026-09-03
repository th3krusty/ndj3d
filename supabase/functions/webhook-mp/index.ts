// ==========================================================================
// NDJ 3D — Edge Function: webhook-mp
// O Mercado Pago chama esta função sozinho (sem passar pelo navegador do
// cliente) sempre que o status de um pagamento muda. Por isso ela precisa
// ficar acessível SEM exigir o login do Supabase — veja no README como
// desligar a verificação de JWT só para esta função na hora do deploy.
//
// Fluxo: recebe o aviso → busca os detalhes do pagamento na API do Mercado
// Pago (usando o MERCADOPAGO_ACCESS_TOKEN) → localiza o pedido pelo
// "external_reference" (que é o número do pedido) → atualiza o status.
// ==========================================================================
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

Deno.serve(async (req) => {
  try {
    const url = new URL(req.url);
    let paymentId = url.searchParams.get('data.id') || url.searchParams.get('id');
    let tipo = url.searchParams.get('type') || url.searchParams.get('topic');

    if(req.method === 'POST'){
      const corpo = await req.json().catch(() => null);
      if(corpo){
        paymentId = paymentId || corpo?.data?.id || corpo?.id || null;
        tipo = tipo || corpo?.type || corpo?.topic;
      }
    }

    // Só nos interessam notificações de pagamento — outras (ex: merchant_order) são ignoradas.
    if(!paymentId || (tipo && tipo !== 'payment')){
      return new Response('ok', { status: 200 });
    }

    const accessToken = Deno.env.get('MERCADOPAGO_ACCESS_TOKEN');
    const respPagamento = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    if(!respPagamento.ok){
      console.error('Não foi possível consultar o pagamento', paymentId);
      return new Response('ok', { status: 200 }); // responde 200 pro MP não ficar reenviando
    }
    const pagamento = await respPagamento.json();

    const numero = pagamento.external_reference;
    if(!numero) return new Response('ok', { status: 200 });

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL'),
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    );

    const { data: pedido } = await supabaseAdmin.from('pedidos').select('*').eq('numero', numero).maybeSingle();
    if(!pedido) return new Response('ok', { status: 200 });

    let novoStatus = pedido.status;
    if(pagamento.status === 'approved') novoStatus = 'pago';
    else if(pagamento.status === 'rejected') novoStatus = 'pagamento_recusado';
    else if(pagamento.status === 'pending' || pagamento.status === 'in_process') novoStatus = 'pendente';

    const agora = new Date().toISOString();
    const etapas = (pedido.etapas || []).map((et) =>
      et.chave === novoStatus && !et.data ? { ...et, data: agora } : et
    );

    await supabaseAdmin.from('pedidos').update({
      status: novoStatus,
      etapas,
      mp_payment_id: String(paymentId)
    }).eq('numero', numero);

    return new Response('ok', { status: 200 });
  } catch (err) {
    console.error('Erro inesperado em webhook-mp:', err);
    return new Response('erro', { status: 500 });
  }
});
