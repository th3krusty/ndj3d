/* ==========================================================================
   NDJ 3D — Lógica da página de detalhe do produto (catálogo)
   Sem carrinho/checkout: o visitante vê o produto e compra pela Shopee,
   pelo TikTok Shop ou combina direto pelo WhatsApp.
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
        ndjMostrarFotoCorReal(p.cores[parseInt(btn.dataset.i)]);
        ndjAtualizarResumoPreco();
      });
    });
    ndjMostrarFotoCorReal(p.cores[0]);
  } else {
    blocoCores.innerHTML = '';
    ndjMostrarFotoCorReal(null);
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
        <small>${p.personalizacao.rotulo} · máx. ${p.personalizacao.maxCaracteres} caracteres · informe esse texto ao finalizar a compra</small>
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

  // Quantidade (respeitando o pedido mínimo, se houver)
  const qtdMinima = (p.pedidoMinimo && p.pedidoMinimo.ativo) ? Math.max(1, p.pedidoMinimo.quantidade) : 1;
  ndjQtdSelecionada = qtdMinima;
  document.getElementById('qtd-input').value = ndjQtdSelecionada;
  document.getElementById('qtd-input').min = qtdMinima;
  const avisoPedidoMinimo = document.getElementById('aviso-pedido-minimo');
  if(qtdMinima > 1){
    avisoPedidoMinimo.textContent = `Pedido mínimo: ${qtdMinima} unidades`;
    avisoPedidoMinimo.style.display = 'block';
  } else {
    avisoPedidoMinimo.style.display = 'none';
  }
  document.getElementById('btn-qtd-menos').addEventListener('click', () => {
    ndjQtdSelecionada = Math.max(qtdMinima, ndjQtdSelecionada - 1);
    document.getElementById('qtd-input').value = ndjQtdSelecionada;
    ndjAtualizarResumoPreco();
  });
  document.getElementById('btn-qtd-mais').addEventListener('click', () => {
    ndjQtdSelecionada = ndjQtdSelecionada + 1;
    document.getElementById('qtd-input').value = ndjQtdSelecionada;
    ndjAtualizarResumoPreco();
  });
  document.getElementById('qtd-input').addEventListener('change', (e) => {
    ndjQtdSelecionada = Math.max(qtdMinima, parseInt(e.target.value) || qtdMinima);
    document.getElementById('qtd-input').value = ndjQtdSelecionada;
    ndjAtualizarResumoPreco();
  });

  ndjAtualizarResumoPreco();

  // Links dos marketplaces
  ndjMontarLinksMarketplace(p);

  // Descrição / características
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

function ndjMostrarFotoCorReal(cor){
  const bloco = document.getElementById('foto-cor-real');
  if(cor && cor.foto){
    document.getElementById('img-cor-real').src = cor.foto;
    document.getElementById('img-cor-real').alt = 'Foto real na cor ' + cor.nome;
    bloco.style.display = 'block';
  } else {
    bloco.style.display = 'none';
  }
}

function ndjMontarLinksMarketplace(p){
  const alvo = document.getElementById('links-marketplace');
  const botoes = [];

  if(p.shopeeUrl){
    botoes.push(`<a href="${p.shopeeUrl}" target="_blank" rel="noopener" class="btn-marketplace btn-marketplace-shopee">
      <img src="assets/icones/shopee.png" alt="Shopee"> Comprar na Shopee
    </a>`);
  }

  if(p.tiktokUrl){
    botoes.push(`<a href="${p.tiktokUrl}" target="_blank" rel="noopener" class="btn-marketplace btn-marketplace-tiktok">
      <img src="assets/icones/tiktok.svg" alt="TikTok Shop"> Comprar no TikTok Shop
    </a>`);
  } else {
    botoes.push(`<span class="btn-marketplace btn-marketplace-tiktok desabilitado" title="Em breve">
      <img src="assets/icones/tiktok.svg" alt="TikTok Shop"> TikTok Shop (em breve)
    </span>`);
  }

  alvo.innerHTML = botoes.join('');

  const blocoMarketplaces = document.getElementById('bloco-marketplaces');
  if(!p.shopeeUrl && !p.tiktokUrl) blocoMarketplaces.style.display = 'none';
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
    <div class="linha total"><span>Valor estimado</span><span>${ndjFormatarMoeda(total)}</span></div>
  `;
  ndjAtualizarBotaoWhatsapp();
}

function ndjAtualizarBotaoWhatsapp(){
  const p = ndjProdutoAtual;
  if(!p) return;
  const personalizado = ndjPersonalizacaoAtiva();
  const textoPersonalizado = personalizado ? (document.getElementById('texto-personalizar') ? document.getElementById('texto-personalizar').value.trim() : '') : '';
  const extra = personalizado ? p.personalizacao.precoExtra : 0;
  const total = (p.preco + extra) * ndjQtdSelecionada;

  let mensagem = `Olá! Tenho interesse no produto *${p.nome}*`;
  if(ndjCorSelecionada) mensagem += ` na cor ${ndjCorSelecionada}`;
  mensagem += `.\nQuantidade: ${ndjQtdSelecionada}`;
  if(personalizado && textoPersonalizado) mensagem += `\nPersonalização: ${textoPersonalizado}`;
  mensagem += `\nValor estimado: ${ndjFormatarMoeda(total)}`;
  mensagem += `\nLink: ${window.location.href}`;

  const url = `https://wa.me/${NDJ_CONFIG.whatsappNumero}?text=${encodeURIComponent(mensagem)}`;
  const botao = document.getElementById('btn-comprar-whatsapp');
  if(botao) botao.href = url;
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
