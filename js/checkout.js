/* ==========================================================================
   NDJ 3D — Lógica do checkout
   ATENÇÃO: o pagamento aqui é SIMULADO para fins de demonstração do fluxo
   de compra. Para receber pagamentos de verdade, integre um gateway real
   (ex.: Mercado Pago, PagSeguro, Stripe) no backend antes de confirmar
   o pedido — ver README.md do projeto.
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

  ndjRenderizarResumoCheckout();
  ndjLigarSelecaoPagamento();

  document.getElementById('btn-calcular-frete-checkout').addEventListener('click', ndjCalcularFreteCheckout);
  document.getElementById('form-checkout').addEventListener('submit', ndjFinalizarPedido);
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
  document.getElementById('checkout-frete').textContent = ndjFreteEscolhido ? ndjFormatarMoeda(frete) : 'Calcule acima';
  document.getElementById('checkout-total').textContent = ndjFormatarMoeda(total);
}

function ndjLigarSelecaoPagamento(){
  const opcoes = document.querySelectorAll('.opcao-pagamento');
  opcoes.forEach(op => {
    op.addEventListener('click', () => {
      opcoes.forEach(o => o.classList.remove('selecionada'));
      op.classList.add('selecionada');
      document.querySelectorAll('.detalhes-pagamento').forEach(d => d.classList.remove('ativa'));
      document.getElementById('detalhes-' + op.dataset.metodo).classList.add('ativa');
      document.getElementById('metodo-pagamento-escolhido').value = op.dataset.metodo;
    });
  });
}

async function ndjFinalizarPedido(e){
  e.preventDefault();

  if(!ndjFreteEscolhido){
    ndjMostrarAviso('Calcule e selecione uma opção de frete antes de continuar.', 'erro');
    return;
  }
  const metodo = document.getElementById('metodo-pagamento-escolhido').value;
  if(!metodo){
    ndjMostrarAviso('Selecione uma forma de pagamento.', 'erro');
    return;
  }
  if(metodo === 'cartao'){
    const numero = document.getElementById('campo-cartao-numero').value.trim();
    const nome = document.getElementById('campo-cartao-nome').value.trim();
    const validade = document.getElementById('campo-cartao-validade').value.trim();
    const cvv = document.getElementById('campo-cartao-cvv').value.trim();
    if(!numero || !nome || !validade || !cvv){
      ndjMostrarAviso('Preencha todos os dados do cartão.', 'erro');
      return;
    }
  }

  const botao = document.getElementById('btn-confirmar-pedido');
  botao.disabled = true;
  botao.textContent = 'Processando pagamento...';

  const dadosCliente = {
    nome: document.getElementById('campo-nome-cliente').value.trim(),
    email: document.getElementById('campo-email-cliente').value.trim(),
    telefone: document.getElementById('campo-telefone-cliente').value.trim(),
    endereco: document.getElementById('campo-endereco-cliente').value.trim(),
    cidade: document.getElementById('campo-cidade-cliente').value.trim(),
    estado: document.getElementById('campo-estado-cliente').value.trim(),
    cep: document.getElementById('campo-cep-checkout').value.trim()
  };

  // Simulação de processamento de pagamento (troque por integração real de gateway).
  setTimeout(async () => {
    const itens = ndjLerCarrinho();
    const subtotal = ndjSubtotalCarrinho();
    const cupom = window._ndjCupomCheckout;
    const desconto = cupom ? (cupom.tipo === 'percentual' ? +(subtotal*(cupom.valor/100)).toFixed(2) : Math.min(subtotal, cupom.valor)) : 0;
    const total = subtotal - desconto + ndjFreteEscolhido.preco;

    try {
      const pedido = await ndjCriarPedido({
        cliente: dadosCliente,
        itens,
        metodoPagamento: metodo,
        frete: ndjFreteEscolhido,
        cupom: cupom ? cupom.codigo : null,
        subtotal, desconto, total
      });

      ndjSalvarCarrinho([]);
      sessionStorage.removeItem('ndj3d_cupom_checkout');
      window.location.href = 'pedido.html?numero=' + pedido.numero;
    } catch (err) {
      ndjMostrarAviso('Não foi possível confirmar seu pedido. Tente novamente em instantes.', 'erro');
      botao.disabled = false;
      botao.textContent = 'Confirmar e pagar';
    }
  }, 1400);
}
