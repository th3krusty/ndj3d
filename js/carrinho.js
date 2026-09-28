/* ==========================================================================
   NDJ 3D — Página do carrinho
   ========================================================================== */

let ndjCupomAplicado = null;

document.addEventListener('DOMContentLoaded', async () => {
  await ndjCarregarDadosIniciais();
  ndjRenderizarCarrinho();
  ndjMontarAvisoRetiradaLocal('aviso-retirada-local-carrinho');

  document.getElementById('form-cupom').addEventListener('submit', async (e) => {
    e.preventDefault();
    await ndjAplicarCupomCarrinho();
  });

  document.getElementById('btn-finalizar-compra').addEventListener('click', () => {
    const itens = ndjLerCarrinho();
    if(!itens.length) return;
    const pausados = itens.filter(item => {
      const produto = ndjBuscarProduto(item.produtoId);
      return produto && produto.pausado;
    });
    if(pausados.length){
      ndjMostrarAviso('Remova do carrinho os produtos indisponíveis antes de continuar.', 'erro');
      ndjRenderizarCarrinho();
      return;
    }
    window.location.href = 'checkout.html';
  });
});

function ndjRenderizarCarrinho(){
  const itens = ndjLerCarrinho();
  const lista = document.getElementById('lista-itens-carrinho');
  const vazio = document.getElementById('carrinho-vazio');
  const coluna = document.getElementById('coluna-resumo');

  if(!itens.length){
    lista.innerHTML = '';
    vazio.style.display = 'block';
    if(coluna) coluna.style.display = 'none';
    ndjAtualizarResumoCarrinho();
    return;
  }

  vazio.style.display = 'none';
  if(coluna) coluna.style.display = 'block';

  lista.innerHTML = itens.map(item => {
    const produto = ndjBuscarProduto(item.produtoId);
    const minimo = produto && produto.pedidoMinimo && produto.pedidoMinimo.ativo ? produto.pedidoMinimo.quantidade : 1;
    const pausado = produto && produto.pausado;
    return `
    <div class="item-carrinho" data-id="${item.id}">
      <img src="${item.imagem}" alt="${item.nome}">
      <div>
        <h4>${item.nome}</h4>
        ${pausado ? '<small style="color:var(--erro); font-weight:600;">Produto indisponível — remova para continuar</small><br>' : ''}
        <div class="detalhes-item">
          ${item.cor ? `Cor: ${item.cor}<br>` : ''}
          ${item.textoPersonalizado ? `Personalização: "${ndjEscaparHtml(item.textoPersonalizado)}"<br>` : ''}
          ${minimo > 1 ? `Pedido mínimo: ${minimo} un.` : ''}
        </div>
        <div class="quantidade-linha">
          <div class="seletor-qtd">
            <button type="button" class="btn-qtd-menos" data-id="${item.id}">−</button>
            <input type="number" class="input-qtd-carrinho" data-id="${item.id}" value="${item.quantidade}" min="${minimo}">
            <button type="button" class="btn-qtd-mais" data-id="${item.id}">+</button>
          </div>
          <button type="button" class="remover-item" data-id="${item.id}">Remover</button>
        </div>
      </div>
      <div class="preco-item">${ndjFormatarMoeda(item.precoUnitario * item.quantidade)}</div>
    </div>`;
  }).join('');

  lista.querySelectorAll('.btn-qtd-menos').forEach(b => b.addEventListener('click', () => ndjAlterarQuantidadeItem(b.dataset.id, -1)));
  lista.querySelectorAll('.btn-qtd-mais').forEach(b => b.addEventListener('click', () => ndjAlterarQuantidadeItem(b.dataset.id, 1)));
  lista.querySelectorAll('.input-qtd-carrinho').forEach(input => {
    input.addEventListener('change', () => {
      const minimo = parseInt(input.min) || 1;
      const valor = Math.max(minimo, parseInt(input.value) || minimo);
      ndjAtualizarQuantidadeCarrinho(input.dataset.id, valor);
      ndjRenderizarCarrinho();
    });
  });
  lista.querySelectorAll('.remover-item').forEach(b => b.addEventListener('click', () => {
    ndjRemoverDoCarrinho(b.dataset.id);
    ndjRenderizarCarrinho();
  }));

  ndjAtualizarResumoCarrinho();
}

function ndjAlterarQuantidadeItem(idItem, delta){
  const itens = ndjLerCarrinho();
  const item = itens.find(i => i.id === idItem);
  if(!item) return;
  const produto = ndjBuscarProduto(item.produtoId);
  const minimo = produto && produto.pedidoMinimo && produto.pedidoMinimo.ativo ? produto.pedidoMinimo.quantidade : 1;
  const nova = Math.max(minimo, item.quantidade + delta);
  ndjAtualizarQuantidadeCarrinho(idItem, nova);
  ndjRenderizarCarrinho();
}

async function ndjAplicarCupomCarrinho(){
  const campo = document.getElementById('campo-cupom');
  const msg = document.getElementById('msg-cupom');
  const codigo = campo.value.trim();
  if(!codigo) return;

  const subtotal = ndjSubtotalCarrinho();
  const cupom = await ndjBuscarCupom(codigo);

  if(!cupom || !cupom.ativo || (cupom.validade && new Date(cupom.validade + 'T23:59:59') < new Date())){
    ndjCupomAplicado = null;
    msg.textContent = 'Cupom inválido ou expirado.';
    msg.className = 'msg-cupom erro';
    ndjAtualizarResumoCarrinho();
    return;
  }

  if(cupom.valor_minimo && subtotal < cupom.valor_minimo){
    ndjCupomAplicado = null;
    msg.textContent = `Esse cupom só é válido para pedidos a partir de ${ndjFormatarMoeda(cupom.valor_minimo)}. Faltam ${ndjFormatarMoeda(cupom.valor_minimo - subtotal)}.`;
    msg.className = 'msg-cupom erro';
    ndjAtualizarResumoCarrinho();
    return;
  }

  ndjCupomAplicado = cupom;
  msg.textContent = cupom.primeira_compra_apenas
    ? `Cupom "${cupom.codigo}" aplicado! Ele é válido só na primeira compra — vamos confirmar isso pelo seu CPF na finalização.`
    : `Cupom "${cupom.codigo}" aplicado!`;
  msg.className = 'msg-cupom sucesso';
  ndjAtualizarResumoCarrinho();
}

function ndjAtualizarResumoCarrinho(){
  const itens = ndjLerCarrinho();
  const subtotal = ndjSubtotalCarrinho(itens);
  const desconto = ndjCupomAplicado ? ndjCalcularDescontoCupom(ndjCupomAplicado, subtotal) : 0;
  const total = Math.max(0, subtotal - desconto);

  const msg = document.getElementById('msg-cupom');
  if(ndjCupomAplicado && ndjCupomAplicado.valor_minimo && subtotal < ndjCupomAplicado.valor_minimo){
    msg.textContent = `O cupom "${ndjCupomAplicado.codigo}" precisa de um pedido a partir de ${ndjFormatarMoeda(ndjCupomAplicado.valor_minimo)} — ele será removido do total até o carrinho chegar nesse valor.`;
    msg.className = 'msg-cupom erro';
  }

  document.getElementById('valor-subtotal').textContent = ndjFormatarMoeda(subtotal);
  const linhaDesconto = document.getElementById('linha-desconto');
  if(desconto > 0){
    linhaDesconto.style.display = 'flex';
    document.getElementById('valor-desconto').textContent = '- ' + ndjFormatarMoeda(desconto);
  } else {
    linhaDesconto.style.display = 'none';
  }
  document.getElementById('valor-total-carrinho').textContent = ndjFormatarMoeda(total);

  const btnFinalizar = document.getElementById('btn-finalizar-compra');
  if(btnFinalizar) btnFinalizar.disabled = itens.length === 0;

  // Guarda o cupom aplicado para o checkout usar
  if(ndjCupomAplicado){
    sessionStorage.setItem('ndj_cupom_aplicado', JSON.stringify(ndjCupomAplicado));
  } else {
    sessionStorage.removeItem('ndj_cupom_aplicado');
  }
}
