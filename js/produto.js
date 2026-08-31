/* ==========================================================================
   NDJ 3D — Lógica da página de detalhe do produto
   ========================================================================== */

let ndjProdutoAtual = null;
let ndjCorSelecionada = null;
let ndjQtdSelecionada = 1;

document.addEventListener('DOMContentLoaded', async () => {
  await ndjCarregarDadosIniciais();
  const id = ndjParametroUrl('id');
  ndjProdutoAtual = ndjBuscarProduto(id);
  const container = document.getElementById('conteudo-produto');
  if(!ndjProdutoAtual){
    container.innerHTML = '<p>Produto não encontrado. <a href="produtos.html">Voltar para a loja</a>.</p>';
    return;
  }
  ndjAtualizarBadgeCarrinho();
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

  document.getElementById('link-shopee-produto').href = p.shopeeUrl;
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
        ${p.cores.map((c,i) => `<button type="button" class="opcao-cor ${i===0?'selecionada':''}" style="background:${c.hex}" data-nome="${c.nome}"><span>${c.nome}</span></button>`).join('')}
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
  }

  // Personalização
  const blocoPersonalizar = document.getElementById('bloco-personalizar');
  if(p.personalizacao.disponivel){
    blocoPersonalizar.innerHTML = `
      <div class="caixa-personalizar">
        <div class="linha-check">
          <input type="checkbox" id="check-personalizar">
          <label for="check-personalizar"><strong>Quero personalizar</strong> (+ ${ndjFormatarMoeda(p.personalizacao.precoExtra)})</label>
        </div>
        <input type="text" id="texto-personalizar" placeholder="${p.personalizacao.rotulo}" maxlength="${p.personalizacao.maxCaracteres}" disabled>
        <small>${p.personalizacao.rotulo} · máx. ${p.personalizacao.maxCaracteres} caracteres</small>
      </div>`;
    const check = document.getElementById('check-personalizar');
    const texto = document.getElementById('texto-personalizar');
    check.addEventListener('change', () => {
      texto.disabled = !check.checked;
      if(!check.checked) texto.value = '';
      ndjAtualizarResumoPreco();
    });
    texto.addEventListener('input', ndjAtualizarResumoPreco);
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
  document.getElementById('painel-entrega').innerHTML = `<p>Peso aproximado do pacote: ${(p.pesoKg*1000).toFixed(0)}g. Use a calculadora de frete acima para ver prazo e valor para o seu CEP. Pedidos personalizados podem levar de 1 a 3 dias úteis extras para produção antes do envio.</p>`;
  const listaAval = await ndjAvaliacoesDoProduto(p.id);
  document.getElementById('painel-avaliacoes').innerHTML = listaAval.length
    ? listaAval.map(a => `
        <div class="cartao-avaliacao">
          <div class="cartao-avaliacao-topo">
            <strong>${ndjEscaparHtml(a.nomeCliente || 'Cliente NDJ 3D')}</strong>
            <span class="estrelas-exibicao">${'★'.repeat(a.nota)}${'☆'.repeat(5 - a.nota)}</span>
          </div>
          ${a.comentario ? `<p>${ndjEscaparHtml(a.comentario)}</p>` : ''}
          <small>${new Date(a.data).toLocaleDateString('pt-BR')}</small>
        </div>
      `).join('')
    : '<p>Ainda não há avaliações para este produto. Depois que seu pedido for entregue, você recebe um link para avaliar.</p>';
  ndjLigarAbas();

  // Frete
  document.getElementById('btn-calcular-frete').addEventListener('click', ndjExecutarCalculoFrete);

  // Adicionar ao carrinho
  document.getElementById('btn-adicionar-carrinho').addEventListener('click', ndjAdicionarProdutoAoCarrinho);
  document.getElementById('btn-comprar-agora').addEventListener('click', () => {
    ndjAdicionarProdutoAoCarrinho();
    window.location.href = 'carrinho.html';
  });

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

function ndjAtualizarResumoPreco(){
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

function ndjExecutarCalculoFrete(){
  const cep = document.getElementById('campo-cep').value;
  const resultado = ndjCalcularFrete(cep, ndjProdutoAtual.pesoKg);
  const alvo = document.getElementById('resultado-frete');
  if(!resultado){
    alvo.innerHTML = '<p style="color:var(--erro)">Digite um CEP válido com 8 dígitos.</p>';
    return;
  }
  alvo.innerHTML = `
    <p><strong>Região:</strong> ${resultado.regiao}</p>
    ${resultado.opcoes.map(o => `
      <div class="opcao-frete"><span>${o.nome} · até ${o.prazoDias} dia(s) útil(eis)</span><strong>${ndjFormatarMoeda(o.preco)}</strong></div>
    `).join('')}
  `;
}

function ndjAdicionarProdutoAoCarrinho(){
  const p = ndjProdutoAtual;
  const personalizado = ndjPersonalizacaoAtiva();
  const textoPersonalizado = personalizado ? document.getElementById('texto-personalizar').value.trim() : '';

  if(personalizado && !textoPersonalizado){
    ndjMostrarAviso('Preencha o texto de personalização antes de adicionar ao carrinho.', 'erro');
    return;
  }

  const extra = personalizado ? p.personalizacao.precoExtra : 0;
  ndjAdicionarAoCarrinho({
    produtoId: p.id,
    nome: p.nome,
    imagem: p.imagens[0],
    cor: ndjCorSelecionada,
    personalizadoTexto: textoPersonalizado,
    precoUnitario: p.preco + extra,
    quantidade: ndjQtdSelecionada,
    pesoKg: p.pesoKg
  });
  ndjMostrarAviso('Produto adicionado ao carrinho!');
}
