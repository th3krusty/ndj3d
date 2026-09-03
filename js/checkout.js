/* ==========================================================================
   NDJ 3D — Lógica do checkout
   O pagamento é processado de verdade pelo Mercado Pago: este arquivo só
   monta o pedido (status "pendente") e chama a Edge Function
   "criar-preferencia-mp", que cria a cobrança no Mercado Pago e devolve o
   link de pagamento (init_point) para onde o cliente é redirecionado.
   A confirmação do pagamento em si chega depois, via webhook, na Edge
   Function "webhook-mp" — ver supabase/functions e o README.
   ========================================================================== */

let ndjFreteEscolhido = null;

document.addEventListener('DOMContentLoaded', async () => {
  const itens = ndjLerCarrinho();
  if(!itens.length){
    window.location.href = 'carrinho.html';
    return;
  }
  await ndjCarregarDadosIniciais();
  const cupomSalvo = sessionStorage.getItem('ndj3d_cupom_checkout');
  window._ndjCupomCheckout = cupomSalvo ? JSON.parse(cupomSalvo) : null;

  document.getElementById('texto-regiao-local').textContent = NDJ_CONFIG.regiaoLocal;

  ndjRenderizarResumoCheckout();
  ndjLigarCombinarLocal();

  document.getElementById('btn-calcular-frete-checkout').addEventListener('click', ndjCalcularFreteCheckout);
  document.getElementById('form-checkout').addEventListener('submit', ndjFinalizarPedido);

  if(ndjParametroUrl('falha') === '1'){
    ndjMostrarAviso('O pagamento não foi concluído. Você pode tentar novamente.', 'erro');
  }
});

function ndjRenderizarResumoCheckout(){
  const itens = ndjLerCarrinho();
  const alvo = document.getElementById('resumo-itens-checkout');
  alvo.innerHTML = itens.map(i => `
    <div class="linha"><span>${i.nome} ${i.cor ? '('+i.cor+')' : ''} x${i.quantidade}</span><span>${ndjFormatarMoeda(i.precoUnitario*i.quantidade)}</span></div>
  `).join('');
  ndjAtualizarTotaisCheckout();
}

function ndjPesoTotalCarrinho(){
  return ndjLerCarrinho().reduce((s,i) => s + (i.pesoKg||0.1) * i.quantidade, 0);
}

/* ---------- Combinar entrega/retirada local (Chopinzinho e Região) ----------
   Quando marcado, dispensa o cálculo de frete (fica "a combinar" e sem
   custo) e deixa endereço/CEP opcionais — o cliente já vai combinar tudo
   pelo WhatsApp depois. */
function ndjLigarCombinarLocal(){
  const check = document.getElementById('check-combinar-local');
  const camposEndereco = ['campo-endereco-cliente', 'campo-cidade-cliente', 'campo-estado-cliente', 'campo-cep-checkout'];

  check.addEventListener('change', () => {
    const combinar = check.checked;
    document.getElementById('opcoes-frete-checkout').style.display = combinar ? 'none' : 'block';
    document.getElementById('campo-cep-checkout').closest('.grupo-form').style.opacity = combinar ? 0.5 : 1;
    document.getElementById('btn-calcular-frete-checkout').disabled = combinar;

    camposEndereco.forEach(id => {
      const campo = document.getElementById(id);
      campo.required = !combinar;
      campo.disabled = combinar;
    });

    if(combinar){
      ndjFreteEscolhido = { nome: 'Combinar via WhatsApp', preco: 0, combinarWhatsapp: true };
      document.getElementById('opcoes-frete-checkout').innerHTML = '';
    } else {
      ndjFreteEscolhido = null;
    }
    ndjAtualizarTotaisCheckout();
  });
}

function ndjCalcularFreteCheckout(){
  const cep = document.getElementById('campo-cep-checkout').value;
  const resultado = ndjCalcularFrete(cep, ndjPesoTotalCarrinho());
  const alvo = document.getElementById('opcoes-frete-checkout');
  if(!resultado){
    alvo.innerHTML = '<p style="color:var(--erro)">CEP inválido.</p>';
    return;
  }
  alvo.innerHTML = resultado.opcoes.map((o,i) => `
    <label class="opcao-frete" style="cursor:pointer">
      <span><input type="radio" name="frete" data-preco="${o.preco}" data-nome="${o.nome}" ${i===0?'checked':''}> ${o.nome} · até ${o.prazoDias} dia(s)</span>
      <strong>${ndjFormatarMoeda(o.preco)}</strong>
    </label>
  `).join('');
  alvo.querySelectorAll('input[name=frete]').forEach(r => r.addEventListener('change', ndjSelecionarFrete));
  ndjSelecionarFrete();
}

function ndjSelecionarFrete(){
  const marcado = document.querySelector('input[name=frete]:checked');
  ndjFreteEscolhido = marcado ? { nome: marcado.dataset.nome, preco: parseFloat(marcado.dataset.preco) } : null;
  ndjAtualizarTotaisCheckout();
}

function ndjAtualizarTotaisCheckout(){
  const subtotal = ndjSubtotalCarrinho();
  const cupom = window._ndjCupomCheckout;
  let desconto = 0;
  if(cupom){
    desconto = cupom.tipo === 'percentual' ? +(subtotal*(cupom.valor/100)).toFixed(2) : Math.min(subtotal, cupom.valor);
  }
  const frete = ndjFreteEscolhido ? ndjFreteEscolhido.preco : 0;
  const total = subtotal - desconto + frete;
  document.getElementById('checkout-subtotal').textContent = ndjFormatarMoeda(subtotal);
  document.getElementById('checkout-desconto').textContent = '- ' + ndjFormatarMoeda(desconto);
  document.getElementById('linha-checkout-desconto').style.display = desconto ? 'flex' : 'none';
  document.getElementById('checkout-frete').textContent = ndjFreteEscolhido
    ? (ndjFreteEscolhido.combinarWhatsapp ? 'A combinar' : ndjFormatarMoeda(frete))
    : 'Calcule acima';
  document.getElementById('checkout-total').textContent = ndjFormatarMoeda(total);
}

async function ndjFinalizarPedido(e){
  e.preventDefault();

  if(!ndjFreteEscolhido){
    ndjMostrarAviso('Calcule e selecione uma opção de frete, ou marque para combinar a entrega/retirada pelo WhatsApp.', 'erro');
    return;
  }

  const botao = document.getElementById('btn-confirmar-pedido');
  botao.disabled = true;
  botao.textContent = 'Preparando pagamento...';

  const dadosCliente = {
    nome: document.getElementById('campo-nome-cliente').value.trim(),
    email: document.getElementById('campo-email-cliente').value.trim(),
    telefone: document.getElementById('campo-telefone-cliente').value.trim(),
    endereco: document.getElementById('campo-endereco-cliente').value.trim(),
    cidade: document.getElementById('campo-cidade-cliente').value.trim(),
    estado: document.getElementById('campo-estado-cliente').value.trim(),
    cep: document.getElementById('campo-cep-checkout').value.trim()
  };

  try {
    const itens = ndjLerCarrinho();
    const subtotal = ndjSubtotalCarrinho();
    const cupom = window._ndjCupomCheckout;
    const desconto = cupom ? (cupom.tipo === 'percentual' ? +(subtotal*(cupom.valor/100)).toFixed(2) : Math.min(subtotal, cupom.valor)) : 0;
    const total = subtotal - desconto + ndjFreteEscolhido.preco;

    // 1) cria o pedido no nosso banco, ainda como "pendente" (aguardando pagamento)
    const pedido = await ndjCriarPedido({
      cliente: dadosCliente,
      itens,
      metodoPagamento: 'mercadopago',
      frete: ndjFreteEscolhido,
      cupom: cupom ? cupom.codigo : null,
      subtotal, desconto, total,
      status: 'pendente'
    });

    // 2) pede pro Mercado Pago (via Edge Function) criar a cobrança desse pedido
    const { data, error } = await ndjSupabase.functions.invoke('criar-preferencia-mp', {
      body: {
        numero: pedido.numero,
        itens,
        frete: ndjFreteEscolhido,
        cliente: dadosCliente,
        urlBase: window.location.origin + window.location.pathname.replace(/checkout\.html$/, '')
      }
    });

    if(error || !data || !data.initPoint){
      throw new Error((data && data.erro) || 'Não foi possível iniciar o pagamento.');
    }

    ndjSalvarCarrinho([]);
    sessionStorage.removeItem('ndj3d_cupom_checkout');

    // 3) manda o cliente para a página de pagamento do Mercado Pago
    window.location.href = data.initPoint;
  } catch (err) {
    console.error(err);
    ndjMostrarAviso('Não foi possível iniciar o pagamento. Tente novamente em instantes.', 'erro');
    botao.disabled = false;
    botao.textContent = 'Ir para pagamento';
  }
}
