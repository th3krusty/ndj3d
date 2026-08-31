/* ==========================================================================
   NDJ 3D — Lógica do carrinho
   ========================================================================== */

let ndjCupomAplicado = null;

document.addEventListener('DOMContentLoaded', async () => {
  if(!document.getElementById('lista-itens-carrinho')) return;
  await ndjCarregarDadosIniciais();
  ndjRenderizarCarrinho();
  const formCupom = document.getElementById('form-cupom');
  if(formCupom){
    formCupom.addEventListener('submit', (e) => {
      e.preventDefault();
      ndjAplicarCupom(document.getElementById('campo-cupom').value);
    });
  }
  const btnFinalizar = document.getElementById('btn-finalizar-compra');
  if(btnFinalizar){
    btnFinalizar.addEventListener('click', () => {
      const itens = ndjLerCarrinho();
      if(!itens.length) return;
      sessionStorage.setItem('ndj3d_cupom_checkout', ndjCupomAplicado ? JSON.stringify(ndjCupomAplicado) : '');
      window.location.href = 'checkout.html';
    });
  }
});

function ndjRenderizarCarrinho(){
  const itens = ndjLerCarrinho();
  const listaEl = document.getElementById('lista-itens-carrinho');
  const vazioEl = document.getElementById('carrinho-vazio');
  const resumoEl = document.getElementById('coluna-resumo');

  if(!itens.length){
    listaEl.innerHTML = '';
    vazioEl.style.display = 'block';
    if(resumoEl) resumoEl.style.display = 'none';
    return;
  }
  vazioEl.style.display = 'none';
  if(resumoEl) resumoEl.style.display = 'block';

  listaEl.innerHTML = itens.map((item, indice) => `
    <div class="item-carrinho">
      <img src="${item.imagem}" alt="${item.nome}">
      <div>
        <h4>${item.nome}</h4>
        <div class="detalhes-item">
          ${item.cor ? `Cor: ${item.cor}` : ''}
          ${item.personalizadoTexto ? ` · Personalizado: "${item.personalizadoTexto}"` : ''}
          · Qtd: ${item.quantidade}
        </div>
        <button class="remover-item" data-indice="${indice}">Remover</button>
      </div>
      <div class="preco-item">${ndjFormatarMoeda(item.precoUnitario * item.quantidade)}</div>
    </div>
  `).join('');

  listaEl.querySelectorAll('.remover-item').forEach(btn => {
    btn.addEventListener('click', () => {
      ndjRemoverDoCarrinho(parseInt(btn.dataset.indice));
      ndjRenderizarCarrinho();
    });
  });

  ndjAtualizarResumoCarrinho();
}

function ndjAplicarCupom(codigo){
  const cupom = ndjBuscarCupom(codigo);
  const msgEl = document.getElementById('msg-cupom');
  if(!cupom || !cupom.ativo){
    ndjCupomAplicado = null;
    msgEl.textContent = 'Cupom inválido ou expirado.';
    msgEl.className = 'msg-cupom erro';
    ndjAtualizarResumoCarrinho();
    return;
  }
  ndjCupomAplicado = cupom;
  msgEl.textContent = `Cupom "${cupom.codigo}" aplicado com sucesso!`;
  msgEl.className = 'msg-cupom ok';
  ndjAtualizarResumoCarrinho();
}

function ndjCalcularDesconto(subtotal){
  if(!ndjCupomAplicado) return 0;
  if(ndjCupomAplicado.tipo === 'percentual'){
    return +(subtotal * (ndjCupomAplicado.valor/100)).toFixed(2);
  }
  return Math.min(subtotal, ndjCupomAplicado.valor);
}

function ndjAtualizarResumoCarrinho(){
  const subtotal = ndjSubtotalCarrinho();
  const desconto = ndjCalcularDesconto(subtotal);
  const total = subtotal - desconto;
  document.getElementById('valor-subtotal').textContent = ndjFormatarMoeda(subtotal);
  document.getElementById('linha-desconto').style.display = desconto ? 'flex' : 'none';
  document.getElementById('valor-desconto').textContent = '- ' + ndjFormatarMoeda(desconto);
  document.getElementById('valor-total-carrinho').textContent = ndjFormatarMoeda(total) + ' + frete';
}
