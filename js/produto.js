/* ==========================================================================
   NDJ 3D — Lógica da página de detalhe do produto
   ========================================================================== */

let ndjProdutoAtual = null;
let ndjCorSelecionada = null;

document.addEventListener('DOMContentLoaded', async () => {
  await ndjCarregarDadosIniciais();
  const id = ndjParametroUrl('id');
  ndjProdutoAtual = ndjBuscarProduto(id);
  const container = document.getElementById('conteudo-produto');
  if(!ndjProdutoAtual){
    container.innerHTML = '<p>Produto não encontrado. <a href="produtos.html">Voltar para a loja</a>.</p>';
    return;
  }
  await ndjMontarPaginaProduto();
});

async function ndjMontarPaginaProduto(){
  const p = ndjProdutoAtual;
  const cat = ndjListarCategorias().find(c => c.id === p.categoria);
  document.title = p.nome + ' · NDJ 3D';
  ndjCorSelecionada = p.cores[0] ? p.cores[0].nome : null;

  document.getElementById('trilha-categoria').textContent = cat ? cat.nome : p.categoria;
  document.getElementById('trilha-categoria').href = 'produtos.html?categoria=' + p.categoria;
  document.getElementById('trilha-produto').textContent = p.nome;

  document.getElementById('galeria-principal-img').src = p.imagens[0];
  document.getElementById('galeria-principal-img').alt = p.nome;
  document.getElementById('galeria-miniaturas').innerHTML = p.imagens.map((img, i) => `
    <img src="${img}" class="${i === 0 ? 'ativa' : ''}" data-indice="${i}" alt="Foto ${i+1} de ${p.nome}">
  `).join('');
  document.querySelectorAll('#galeria-miniaturas img').forEach(img => {
    img.addEventListener('click', () => {
      document.getElementById('galeria-principal-img').src = p.imagens[img.dataset.indice];
      document.querySelectorAll('#galeria-miniaturas img').forEach(i => i.classList.remove('ativa'));
      img.classList.add('ativa');
    });
  });

  document.getElementById('nome-produto').textContent = p.nome;
  const resumoAval = await ndjResumoAvaliacoes(p.id);
  document.getElementById('avaliacao-produto').innerHTML = resumoAval.total
    ? '★'.repeat(Math.round(resumoAval.media)) + '☆'.repeat(5 - Math.round(resumoAval.media)) +
      ` (${resumoAval.media.toFixed(1)} · ${resumoAval.total} avaliaç${resumoAval.total === 1 ? 'ão' : 'ões'})`
    : '<span class="sem-avaliacao">Ainda sem avaliações · seja o primeiro a comprar e avaliar</span>';
  document.getElementById('btn-aba-avaliacoes').textContent = `Avaliações (${resumoAval.total})`;

  document.getElementById('estoque-produto').textContent = p.estoque > 10
    ? 'Em estoque' : (p.estoque > 0 ? `Últimas ${p.estoque} unidades` : 'Sob encomenda');

  // Cores
  const blocoCores = document.getElementById('bloco-cores');
  if(p.cores.length){
    blocoCores.innerHTML = `<label class="titulo-opcao">Cor: <span id="nome-cor-selecionada">${p.cores[0].nome}</span></label>
      <div class="opcoes-cor">
        ${p.cores.map((c,i) => `<button type="button" class="opcao-cor ${i===0?'selecionada':''}" style="${c.foto ? `background-image:url('${c.foto}')` : `background:${c.hex}`}" data-nome="${c.nome}" data-i="${i}"><span>${c.nome}</span></button>`).join('')}
      </div>`;
    blocoCores.querySelectorAll('.opcao-cor').forEach(btn => {
      btn.addEventListener('click', () => {
        blocoCores.querySelectorAll('.opcao-cor').forEach(b => b.classList.remove('selecionada'));
        btn.classList.add('selecionada');
        ndjCorSelecionada = btn.dataset.nome;
        document.getElementById('nome-cor-selecionada').textContent = ndjCorSelecionada;
      });
    });
  } else {
    blocoCores.innerHTML = '';
    ndjMostrarFotoCorReal(null);
  }

  // Personalização (sem valor: o preço da personalização é combinado direto
  // com o cliente na Shopee, no TikTok Shop ou pelo WhatsApp).
  const blocoPersonalizar = document.getElementById('bloco-personalizar');
  if(p.personalizacao.disponivel){
    blocoPersonalizar.innerHTML = `
      <div class="caixa-personalizar">
        <div class="linha-check">
          <input type="checkbox" id="check-personalizar">
          <label for="check-personalizar"><strong>Quero personalizar</strong></label>
        </div>
        <input type="text" id="texto-personalizar" placeholder="${p.personalizacao.rotulo}" maxlength="${p.personalizacao.maxCaracteres}" disabled>
        <small>${p.personalizacao.rotulo} · máx. ${p.personalizacao.maxCaracteres} caracteres</small>
      </div>`;
    const check = document.getElementById('check-personalizar');
    const texto = document.getElementById('texto-personalizar');
    check.addEventListener('change', () => {
      texto.disabled = !check.checked;
      if(!check.checked) texto.value = '';
      ndjAtualizarBotaoWhatsapp();
    });
    texto.addEventListener('input', ndjAtualizarBotaoWhatsapp);
  } else {
    blocoPersonalizar.innerHTML = '';
  }

  // Quantidade
  document.getElementById('qtd-input').value = 1;
  document.getElementById('btn-qtd-menos').addEventListener('click', () => {
    ndjQtdSelecionada = Math.max(1, ndjQtdSelecionada - 1);
    document.getElementById('qtd-input').value = ndjQtdSelecionada;
    ndjAtualizarResumoPreco();
  });
  document.getElementById('btn-qtd-mais').addEventListener('click', () => {
    ndjQtdSelecionada = Math.min(p.estoque || 99, ndjQtdSelecionada + 1);
    document.getElementById('qtd-input').value = ndjQtdSelecionada;
    ndjAtualizarResumoPreco();
  });
  document.getElementById('qtd-input').addEventListener('change', (e) => {
    ndjQtdSelecionada = Math.max(1, parseInt(e.target.value) || 1);
    ndjAtualizarResumoPreco();
  });

  ndjAtualizarResumoPreco();

  // Descrição / características / avaliações (abas)
  document.getElementById('painel-descricao').innerHTML = `<p>${p.descricao}</p>`;
  document.getElementById('painel-caracteristicas').innerHTML = `<ul>${p.caracteristicas.map(c => `<li>${c}</li>`).join('')}</ul>`;
  document.getElementById('painel-entrega').innerHTML = `
    <p>Este produto pode ser comprado na <strong>Shopee</strong>${p.tiktokUrl ? ' e no <strong>TikTok Shop</strong>' : ''} — o frete e o prazo de entrega são calculados direto no marketplace, com todas as garantias da plataforma.</p>
    <p>Prefere combinar entrega ou retirada direto com a gente? Fale pelo WhatsApp — é possível combinar a retirada em Chopinzinho e Região sem passar pelo marketplace.</p>
    <p>Pedidos personalizados podem levar de 1 a 3 dias úteis extras para produção antes do envio.</p>
  `;
  ndjLigarAbas();

  ndjMontarAvisoRetiradaLocal('aviso-retirada-local');

  // Botão de compra via WhatsApp
  ndjAtualizarBotaoWhatsapp();

  // Produtos relacionados
  const relacionados = ndjListarProdutos().filter(x => x.categoria === p.categoria && x.id !== p.id).slice(0,4);
  const secaoRelacionados = document.getElementById('grade-relacionados');
  if(relacionados.length){
    secaoRelacionados.innerHTML = relacionados.map(ndjCartaoProdutoHTML).join('');
  } else {
    document.getElementById('secao-relacionados').style.display = 'none';
  }
}

function ndjPersonalizacaoAtiva(){
  const check = document.getElementById('check-personalizar');
  return check && check.checked;
}

/* Mensagem do WhatsApp: só produto, cor e personalização (se houver) —
   sem quantidade e sem valor, já que o site é só catálogo. */
function ndjAtualizarBotaoWhatsapp(){
  const p = ndjProdutoAtual;
  const extra = ndjPersonalizacaoAtiva() ? p.personalizacao.precoExtra : 0;
  const unitario = p.preco + extra;
  const total = unitario * ndjQtdSelecionada;
  document.getElementById('preco-produto-valor').textContent = ndjFormatarMoeda(p.preco);
  document.getElementById('resumo-preco-final').innerHTML = `
    <div class="linha"><span>Preço unitário</span><span>${ndjFormatarMoeda(p.preco)}</span></div>
    ${extra ? `<div class="linha"><span>Personalização</span><span>+ ${ndjFormatarMoeda(extra)}</span></div>` : ''}
    <div class="linha"><span>Quantidade</span><span>${ndjQtdSelecionada}</span></div>
    <div class="linha total"><span>Total</span><span>${ndjFormatarMoeda(total)}</span></div>
  `;
}

function ndjLigarAbas(){
  const botoes = document.querySelectorAll('.abas-cabecalho button');
  botoes.forEach(btn => {
    btn.addEventListener('click', () => {
      botoes.forEach(b => b.classList.remove('ativa'));
      document.querySelectorAll('.painel-aba').forEach(p => p.classList.remove('ativa'));
      btn.classList.add('ativa');
      document.getElementById(btn.dataset.painel).classList.add('ativa');
    });
  });
}
