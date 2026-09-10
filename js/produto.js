/* ==========================================================================
   NDJ 3D — Lógica da página de detalhe do produto (catálogo)
   Site 100% catálogo: sem preço, sem estoque e sem escolha de quantidade
   no site. O visitante vê o produto e compra pela Shopee, pelo TikTok Shop
   ou combina direto pelo WhatsApp.
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

  // Cores — ao escolher uma cor, a foto principal passa a mostrar a foto
  // real daquela cor (quando cadastrada). Sem foto de cor, a foto principal
  // volta para a primeira foto do produto.
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
        ndjAtualizarFotoPrincipalPelaCor(p.cores[parseInt(btn.dataset.i)]);
        ndjAtualizarBotaoWhatsapp();
      });
    });
    ndjAtualizarFotoPrincipalPelaCor(p.cores[0]);
  } else {
    blocoCores.innerHTML = '';
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
        <small>${p.personalizacao.rotulo} · máx. ${p.personalizacao.maxCaracteres} caracteres · informe esse texto ao combinar a compra</small>
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

  // Pedido mínimo — informativo (o cadastro continua no admin; o site não
  // tem mais seletor de quantidade, então isso só avisa o visitante).
  const avisoPedidoMinimo = document.getElementById('aviso-pedido-minimo');
  if(p.pedidoMinimo && p.pedidoMinimo.ativo && p.pedidoMinimo.quantidade > 1){
    avisoPedidoMinimo.textContent = `Pedido mínimo: ${p.pedidoMinimo.quantidade} unidades`;
    avisoPedidoMinimo.style.display = 'block';
  } else {
    avisoPedidoMinimo.style.display = 'none';
  }

  // Aviso de desconto especial comprando direto pelo WhatsApp
  ndjMontarAvisoDescontoWhatsapp('aviso-desconto-whatsapp');

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

/* Troca a foto principal pela foto real da cor escolhida (quando existir).
   Sem foto cadastrada para a cor, volta pra primeira foto do produto. */
function ndjAtualizarFotoPrincipalPelaCor(cor){
  const p = ndjProdutoAtual;
  const imgPrincipal = document.getElementById('galeria-principal-img');
  if(cor && cor.foto){
    imgPrincipal.src = cor.foto;
    imgPrincipal.alt = p.nome + ' na cor ' + cor.nome;
  } else {
    imgPrincipal.src = p.imagens[0];
    imgPrincipal.alt = p.nome;
  }
  document.querySelectorAll('#galeria-miniaturas img').forEach(i => i.classList.remove('ativa'));
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

/* Mensagem do WhatsApp: só produto, cor e personalização (se houver) —
   sem quantidade e sem valor, já que o site é só catálogo. */
function ndjAtualizarBotaoWhatsapp(){
  const p = ndjProdutoAtual;
  if(!p) return;
  const personalizado = ndjPersonalizacaoAtiva();
  const textoPersonalizado = personalizado ? (document.getElementById('texto-personalizar') ? document.getElementById('texto-personalizar').value.trim() : '') : '';

  let mensagem = `Olá! Tenho interesse no produto *${p.nome}*`;
  if(ndjCorSelecionada) mensagem += ` na cor ${ndjCorSelecionada}`;
  mensagem += '.';
  if(personalizado && textoPersonalizado) mensagem += `\nPersonalização: ${textoPersonalizado}`;
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
