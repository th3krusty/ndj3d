/* ==========================================================================
   NDJ 3D — Confirmação de pedido e rastreio
   ========================================================================== */

document.addEventListener('DOMContentLoaded', async () => {
  await ndjCarregarDadosIniciais();

  const confirmacaoEl = document.getElementById('bloco-confirmacao-pedido');
  const numeroConfirmacao = ndjParametroUrl('numero');
  if(confirmacaoEl){
    if(!numeroConfirmacao){
      confirmacaoEl.style.display = 'none';
    } else {
      const pedido = await ndjBuscarPedido(numeroConfirmacao);
      if(pedido){
        ndjRenderizarConfirmacao(pedido);
        await ndjRenderizarBlocoAvaliacao(pedido, 'bloco-avaliar-confirmacao');
      } else {
        confirmacaoEl.innerHTML = '<div class="container"><p>Pedido não encontrado.</p></div>';
      }
    }
  }

  const formRastreio = document.getElementById('form-rastreio');
  if(formRastreio){
    formRastreio.addEventListener('submit', async (e) => {
      e.preventDefault();
      const numero = document.getElementById('campo-rastreio-numero').value;
      const pedido = await ndjBuscarPedido(numero);
      const alvo = document.getElementById('resultado-rastreio');
      if(!pedido){
        alvo.innerHTML = '<p style="color:var(--erro)">Não encontramos nenhum pedido com esse número. Confira o código enviado por e-mail.</p>';
        return;
      }
      alvo.innerHTML = ndjMontarLinhaDoTempo(pedido);
      await ndjRenderizarBlocoAvaliacao(pedido, 'bloco-avaliar-rastreio');
    });

    if(numeroConfirmacao && !document.getElementById('bloco-confirmacao-pedido')){
      document.getElementById('campo-rastreio-numero').value = numeroConfirmacao;
      formRastreio.dispatchEvent(new Event('submit'));
    }
  }
});

function ndjRenderizarConfirmacao(pedido){
  document.getElementById('numero-pedido-valor').textContent = pedido.numero;
  document.getElementById('codigo-rastreio-valor').textContent = pedido.rastreio;
  document.getElementById('email-confirmacao').textContent = pedido.cliente.email || '';
  document.getElementById('total-confirmacao').textContent = ndjFormatarMoeda(pedido.total);
  document.getElementById('linha-do-tempo-pedido').innerHTML = ndjMontarLinhaDoTempo(pedido);
}

function ndjMontarLinhaDoTempo(pedido){
  const indiceAtual = pedido.etapas.findIndex(e => e.chave === pedido.status);
  const cabecalho = `
    <div class="numero-pedido">📦 Pedido ${pedido.numero} · Rastreio ${pedido.rastreio}</div>
  `;
  const linhas = pedido.etapas.map((etapa, i) => {
    let classe = '';
    if(i < indiceAtual) classe = 'concluido';
    else if(i === indiceAtual) classe = 'atual';
    return `
      <div class="evento-tempo ${classe}">
        <div class="bola-tempo">${i <= indiceAtual ? '✓' : ''}</div>
        <div>
          <strong>${etapa.rotulo}</strong>
          <span>${i <= indiceAtual ? (etapa.data ? new Date(etapa.data).toLocaleString('pt-BR') : 'Em andamento') : 'Aguardando etapa anterior'}</span>
        </div>
      </div>
    `;
  }).join('');
  return cabecalho + `<div class="linha-tempo">${linhas}</div>`;
}

/* ---------- Avaliação pós-entrega ----------
   Só aparece quando o pedido está com status "entregue" (definido pelo admin
   no painel). Depois de enviada, a avaliação fica salva por produto e some
   o formulário pra não deixar avaliar o mesmo pedido duas vezes. */
async function ndjRenderizarBlocoAvaliacao(pedido, idContainer){
  const alvo = document.getElementById(idContainer);
  if(!alvo) return;

  if(pedido.status !== 'entregue'){
    alvo.innerHTML = '';
    return;
  }

  if(pedido.avaliado){
    alvo.innerHTML = `
      <div class="caixa-avaliar-pedido">
        <p>✅ Obrigado por avaliar este pedido! Sua opinião já está na página dos produtos.</p>
      </div>`;
    return;
  }

  const itensUnicos = [];
  const vistos = new Set();
  pedido.itens.forEach(item => {
    if(!vistos.has(item.produtoId)){
      vistos.add(item.produtoId);
      itensUnicos.push(item);
    }
  });

  alvo.innerHTML = `
    <div class="caixa-avaliar-pedido">
      <span class="eyebrow">Pedido entregue</span>
      <h3>Avalie seus produtos</h3>
      <p>Conte pra gente o que achou — sua avaliação aparece na página de cada produto.</p>
      <form id="form-avaliar-pedido">
        ${itensUnicos.map(item => `
          <div class="item-avaliar" data-produto-id="${item.produtoId}">
            <div class="item-avaliar-topo">
              <img src="${item.imagem}" alt="">
              <strong>${ndjEscaparHtml(item.nome)}</strong>
            </div>
            <div class="estrelas-input" data-nota="0">
              ${[1,2,3,4,5].map(n => `<span class="estrela" data-valor="${n}">☆</span>`).join('')}
            </div>
            <textarea class="campo-comentario" placeholder="Como foi sua experiência com esse produto? (opcional)" maxlength="500"></textarea>
          </div>
        `).join('')}
        <input type="text" id="nome-avaliador" placeholder="Seu nome (aparece junto da avaliação, opcional)" maxlength="60" value="${ndjEscaparHtml((pedido.cliente && pedido.cliente.nome) ? pedido.cliente.nome.split(' ')[0] : '')}">
        <button class="btn btn-primario" type="submit">Enviar avaliação</button>
      </form>
    </div>`;

  ndjLigarFormAvaliacao(pedido, idContainer);
}

function ndjLigarFormAvaliacao(pedido, idContainer){
  const alvo = document.getElementById(idContainer);

  alvo.querySelectorAll('.estrelas-input').forEach(campo => {
    const estrelas = campo.querySelectorAll('.estrela');
    estrelas.forEach(estrela => {
      estrela.addEventListener('click', () => {
        const valor = parseInt(estrela.dataset.valor, 10);
        campo.dataset.nota = valor;
        estrelas.forEach(e => {
          e.textContent = parseInt(e.dataset.valor, 10) <= valor ? '★' : '☆';
        });
      });
    });
  });

  const form = document.getElementById('form-avaliar-pedido');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const itens = form.querySelectorAll('.item-avaliar');
    const semNota = Array.from(itens).some(el => parseInt(el.querySelector('.estrelas-input').dataset.nota, 10) === 0);
    if(semNota){
      ndjMostrarAviso('Selecione de 1 a 5 estrelas para cada produto antes de enviar.', 'erro');
      return;
    }

    const botaoEnviar = form.querySelector('button[type=submit]');
    botaoEnviar.disabled = true;
    botaoEnviar.textContent = 'Enviando...';

    const nomeAvaliador = document.getElementById('nome-avaliador').value.trim();

    try {
      for(const el of itens){
        await ndjCriarAvaliacao({
          produtoId: el.dataset.produtoId,
          pedidoNumero: pedido.numero,
          nomeCliente: nomeAvaliador,
          nota: parseInt(el.querySelector('.estrelas-input').dataset.nota, 10),
          comentario: el.querySelector('.campo-comentario').value.trim()
        });
      }

      await ndjMarcarPedidoAvaliado(pedido.numero);
      pedido.avaliado = true;
      ndjMostrarAviso('Avaliação enviada, obrigado!');
      await ndjRenderizarBlocoAvaliacao(pedido, idContainer);
    } catch (err) {
      ndjMostrarAviso('Não foi possível enviar sua avaliação. Tente novamente.', 'erro');
      botaoEnviar.disabled = false;
      botaoEnviar.textContent = 'Enviar avaliação';
    }
  });
}
