/* ==========================================================================
   NDJ 3D — Confirmação de pedido, rastreio e avaliação pós-entrega
   ========================================================================== */

document.addEventListener('DOMContentLoaded', async () => {
  await ndjCarregarDadosIniciais();

  const numeroUrl = ndjParametroUrl('pedido');
  if(numeroUrl){
    const pedido = await ndjBuscarPedido(numeroUrl);
    if(pedido){
      await ndjMontarConfirmacaoPedido(pedido);
    } else {
      document.getElementById('bloco-confirmacao-pedido').style.display = 'none';
    }
  } else {
    document.getElementById('bloco-confirmacao-pedido').style.display = 'none';
  }

  document.getElementById('form-rastreio').addEventListener('submit', async (e) => {
    e.preventDefault();
    const numero = document.getElementById('campo-rastreio-numero').value.trim();
    await ndjMontarResultadoRastreio(numero);
  });
});

const NDJ_ROTULO_STATUS = {
  aguardando_pagamento: 'Aguardando pagamento',
  pago: 'Pagamento confirmado',
  preparando: 'Preparando pedido',
  enviado: 'Enviado',
  entregue: 'Entregue',
  cancelado: 'Cancelado'
};

/* Envia o evento "purchase" pro Google Analytics (GA4), com os itens e o
   valor do pedido — assim dá pra ver faturamento e produtos mais vendidos
   direto no Analytics. Marca no localStorage que aquele pedido já foi
   enviado, pra não contar de novo se o cliente atualizar a página. */
function ndjRastrearCompraGA4(pedido){
  if(typeof gtag !== 'function') return;

  const chave = 'ndj_ga_compra_' + pedido.numero;
  if(localStorage.getItem(chave)) return;

  gtag('event', 'purchase', {
    transaction_id: pedido.numero,
    value: Number(pedido.total),
    shipping: Number(pedido.frete) || 0,
    currency: 'BRL',
    coupon: pedido.cupom_codigo || undefined,
    items: (pedido.itens || []).map(item => ({
      item_id: item.produtoId,
      item_name: item.nome,
      item_variant: item.cor || undefined,
      price: Number(item.precoUnitario),
      quantity: item.quantidade
    }))
  });

  localStorage.setItem(chave, '1');
}

async function ndjMontarConfirmacaoPedido(pedido){
  document.getElementById('email-confirmacao').textContent = pedido.cliente.email || '';
  document.getElementById('total-confirmacao').textContent = ndjFormatarMoeda(Number(pedido.total));
  document.getElementById('numero-pedido-valor').textContent = pedido.numero;

  ndjRastrearCompraGA4(pedido);

  const separadorRastreio = document.getElementById('separador-rastreio');
  if(pedido.rastreio){
    separadorRastreio.style.display = 'inline';
    document.getElementById('codigo-rastreio-valor').textContent = pedido.rastreio;
  } else {
    separadorRastreio.style.display = 'none';
  }

  ndjMontarLinhaDoTempo('linha-do-tempo-pedido', pedido);

  if(ndjPedidoPodeAvaliar(pedido)){
    await ndjMontarFormularioAvaliacao('bloco-avaliar-confirmacao', pedido);
  }
}

function ndjMontarLinhaDoTempo(idAlvo, pedido){
  const alvo = document.getElementById(idAlvo);
  if(!alvo) return;
  const etapas = pedido.etapas && pedido.etapas.length ? pedido.etapas : NDJ_ETAPAS_PEDIDO_PADRAO;
  const indiceAtual = etapas.findIndex(e => e.chave === pedido.status);

  alvo.innerHTML = etapas.map((et, i) => `
    <div class="evento-tempo ${i <= indiceAtual ? 'concluido' : ''}">
      <div class="bola-tempo">${i <= indiceAtual ? '✓' : ''}</div>
      <div>
        <strong>${et.rotulo}</strong>
        ${et.data ? `<br><small>${new Date(et.data).toLocaleDateString('pt-BR')}</small>` : ''}
      </div>
    </div>
  `).join('');
}

async function ndjMontarResultadoRastreio(numero){
  const alvo = document.getElementById('resultado-rastreio');
  const blocoAvaliar = document.getElementById('bloco-avaliar-rastreio');
  blocoAvaliar.innerHTML = '';

  if(!numero){
    alvo.innerHTML = '';
    return;
  }

  alvo.innerHTML = '<p>Buscando pedido...</p>';
  const pedido = await ndjBuscarPedido(numero);

  if(!pedido){
    alvo.innerHTML = '<p style="color:var(--erro)">Não encontramos nenhum pedido com esse número. Confira se digitou corretamente.</p>';
    return;
  }

  alvo.innerHTML = `
    <div class="caixa-confirmacao" style="text-align:left">
      <p><strong>Pedido ${pedido.numero}</strong></p>
      <p>Status atual: <strong>${NDJ_ROTULO_STATUS[pedido.status] || pedido.status}</strong></p>
      <p>Total: <strong>${ndjFormatarMoeda(Number(pedido.total))}</strong></p>
      ${pedido.rastreio ? `<p>Código de rastreio: <strong>${ndjEscaparHtml(pedido.rastreio)}</strong></p>` : ''}
      <div class="linha-tempo" id="linha-tempo-rastreio"></div>
    </div>
  `;
  ndjMontarLinhaDoTempo('linha-tempo-rastreio', pedido);

  if(ndjPedidoPodeAvaliar(pedido)){
    await ndjMontarFormularioAvaliacao('bloco-avaliar-rastreio', pedido);
  }
}

/* ---------------- Avaliação pós-entrega ---------------- */
async function ndjMontarFormularioAvaliacao(idAlvo, pedido){
  const alvo = document.getElementById(idAlvo);
  if(!alvo) return;

  const produtosUnicos = [];
  const vistos = new Set();
  (pedido.itens || []).forEach(item => {
    if(!vistos.has(item.produtoId)){
      vistos.add(item.produtoId);
      produtosUnicos.push(item);
    }
  });

  alvo.innerHTML = `
    <div class="caixa-avaliar-pedido">
      <h3>Como foi sua experiência?</h3>
      <p>Seu pedido foi entregue! Avalie os produtos que você comprou.</p>
      <form id="form-avaliar-pedido">
        <input type="text" id="nome-avaliador" placeholder="Seu nome (opcional)">
        ${produtosUnicos.map((item, i) => `
          <div class="item-avaliar" data-produto-id="${item.produtoId}">
            <div class="item-avaliar-topo">
              <img src="${item.imagem}" alt="">
              <strong>${item.nome}</strong>
            </div>
            <div class="estrelas-input" data-nota="5">
              ${[1,2,3,4,5].map(n => `<span class="estrela" data-valor="${n}">★</span>`).join('')}
            </div>
            <textarea class="campo-comentario" placeholder="Conte o que você achou (opcional)"></textarea>
          </div>
        `).join('')}
        <button type="submit" class="btn btn-primario btn-bloco" style="margin-top:14px">Enviar avaliação</button>
      </form>
    </div>
  `;

  alvo.querySelectorAll('.estrelas-input').forEach(bloco => {
    const estrelas = bloco.querySelectorAll('.estrela');
    function pintar(nota){
      estrelas.forEach(es => es.style.opacity = parseInt(es.dataset.valor) <= nota ? '1' : '0.3');
    }
    pintar(5);
    estrelas.forEach(es => es.addEventListener('click', () => {
      bloco.dataset.nota = es.dataset.valor;
      pintar(parseInt(es.dataset.valor));
    }));
  });

  document.getElementById('form-avaliar-pedido').addEventListener('submit', async (e) => {
    e.preventDefault();
    const nomeAvaliador = document.getElementById('nome-avaliador').value.trim();
    const botao = e.target.querySelector('button[type=submit]');
    botao.disabled = true;

    try {
      const itensAvaliar = alvo.querySelectorAll('.item-avaliar');
      for(const itemEl of itensAvaliar){
        const nota = parseInt(itemEl.querySelector('.estrelas-input').dataset.nota) || 5;
        const comentario = itemEl.querySelector('.campo-comentario').value.trim();
        await ndjCriarAvaliacao({
          pedidoNumero: pedido.numero,
          produtoId: itemEl.dataset.produtoId,
          nomeCliente: nomeAvaliador,
          nota,
          comentario
        });
      }
      await ndjMarcarPedidoAvaliado(pedido.numero);
      alvo.innerHTML = '<div class="caixa-avaliar-pedido"><h3>Obrigado pela avaliação! 🙌</h3></div>';
    } catch (err) {
      ndjMostrarAviso('Não foi possível enviar a avaliação.', 'erro');
      botao.disabled = false;
    }
  });
}
