/* ==========================================================================
   NDJ 3D — Comportamentos gerais de interface
   ========================================================================== */

document.addEventListener('DOMContentLoaded', async () => {
  await ndjCarregarDadosIniciais();
  ndjAtualizarBadgeCarrinho();
  ndjRenderizarCategoriasHome();
  ndjRenderizarDestaques();
  ndjRenderizarGradeProdutos();
  ndjRenderizarBannerIndex();
});
/* O menu mobile agora é montado em js/layout.js, junto com o cabeçalho. */

/* ---------- Banner de ponta a ponta da home (imagem editável no admin) ----------
   Mostra a imagem de celular ou de computador conforme a tela (via
   <picture>), com o link cadastrado no admin (se houver). Não faz nada
   nas outras páginas, já que só existe #banner-index no index.html. */
async function ndjRenderizarBannerIndex(){
  const alvo = document.getElementById('banner-index');
  if(!alvo) return;

  const banner = await ndjBuscarBannerIndex();
  if(!banner || (!banner.imagem_desktop && !banner.imagem_mobile)){
    alvo.innerHTML = '';
    return;
  }

  const imgDesktop = banner.imagem_desktop || banner.imagem_mobile;
  const imgMobile = banner.imagem_mobile || banner.imagem_desktop;

  const miolo = `
    <picture>
      ${imgMobile ? `<source media="(max-width: 680px)" srcset="${imgMobile}">` : ''}
      <img src="${imgDesktop}" alt="NDJ 3D">
    </picture>
  `;

  alvo.innerHTML = banner.link
    ? `<a class="banner-index-link" href="${banner.link}" target="_blank" rel="noopener">${miolo}</a>`
    : `<div class="banner-index-wrap">${miolo}</div>`;
}

/* ---------- Aviso de entrega/retirada combinada (Chopinzinho e Região) ----------
   Reutilizado na página de produto e no carrinho. */
function ndjMontarAvisoRetiradaLocal(idAlvo){
  const alvo = document.getElementById(idAlvo);
  if(!alvo) return;
  alvo.innerHTML = `É de <strong>${NDJ_CONFIG.regiaoLocal}</strong>? A entrega ou retirada também pode ser combinada direto pelo
    <a href="https://wa.me/${NDJ_CONFIG.whatsappNumero}" target="_blank" rel="noopener">WhatsApp</a>.`;
}

/* ---------- Aviso de desconto especial comprando direto pelo WhatsApp ---------- */
function ndjMontarAvisoDescontoWhatsapp(idAlvo){
  const alvo = document.getElementById(idAlvo);
  if(!alvo) return;
  alvo.innerHTML = `<strong>Desconto especial</strong> para quem comprar direto pelo WhatsApp!`;
}

function ndjMostrarAviso(mensagem, tipo){
  let caixa = document.querySelector('.aviso-flutuante');
  if(!caixa){
    caixa = document.createElement('div');
    caixa.className = 'aviso-flutuante';
    document.body.appendChild(caixa);
  }
  caixa.textContent = mensagem;
  caixa.className = 'aviso-flutuante mostrar' + (tipo === 'erro' ? ' erro' : '');
  clearTimeout(window._ndjAvisoTimeout);
  window._ndjAvisoTimeout = setTimeout(() => caixa.classList.remove('mostrar'), 3200);
}

/* ---------- Página inicial: categorias em destaque ---------- */
function ndjRenderizarCategoriasHome(){
  const alvo = document.getElementById('grade-categorias-home');
  if(!alvo) return;
  alvo.innerHTML = ndjListarCategorias().map(c => `
    <a class="cartao-categoria" href="produtos.html?categoria=${c.id}">
      <div class="icone-categoria"><img src="${c.icone}" alt="Ícone ${c.nome}" loading="lazy"></div>
      <h3>${c.nome}</h3>
      <p>${c.desc}</p>
    </a>
  `).join('');
}

/* ---------- Página inicial: destaques (4 produtos) ---------- */
function ndjRenderizarDestaques(){
  const alvo = document.getElementById('grade-destaques');
  if(!alvo) return;
  const produtos = ndjListarProdutos().filter(p => !p.pausado).slice(0, 4);
  alvo.innerHTML = produtos.map(ndjCartaoProdutoHTML).join('');
}

/* ---------- Cartão de produto reutilizável ---------- */
function ndjCartaoProdutoHTML(p){
  const cat = ndjListarCategorias().find(c => c.id === p.categoria);
  const emPromocao = p.promocao && p.promocao.ativa && p.promocao.precoPromocional > 0;
  return `
    <div class="cartao-produto ${p.pausado ? 'cartao-produto-pausado' : ''}">
      <a href="produto.html?id=${p.id}" class="miniatura">
        <span class="tag-categoria">${cat ? cat.nome : p.categoria}</span>
        ${p.pausado ? '<span class="tag-pausado">Indisponível</span>' : (emPromocao ? '<span class="tag-promocao">Promoção</span>' : '')}
        <img src="${p.imagens[0]}" alt="${p.nome}" loading="lazy">
      </a>
      <div class="corpo-cartao">
        <h3><a href="produto.html?id=${p.id}">${p.nome}</a></h3>
        <div class="cores-mini">
          ${p.cores.slice(0,5).map(c => `<span class="ponto-cor" style="background:${c.hex}" title="${c.nome}"></span>`).join('')}
        </div>
        <div class="preco-cartao">
          ${emPromocao
            ? `<span class="preco-antigo">${ndjFormatarMoeda(p.preco)}</span> <span class="preco-promocional">${ndjFormatarMoeda(p.promocao.precoPromocional)}</span>`
            : ndjFormatarMoeda(p.preco)}
        </div>
        <a href="produto.html?id=${p.id}" class="btn btn-contorno btn-pequeno btn-bloco">Ver produto</a>
      </div>
    </div>
  `;
}

/* ---------- Página de listagem de produtos ---------- */
function ndjRenderizarGradeProdutos(){
  const alvo = document.getElementById('grade-produtos-todos');
  if(!alvo) return;

  const categoriaUrl = ndjParametroUrl('categoria') || 'todas';
  ndjMontarFiltros(categoriaUrl);
  ndjAplicarFiltro(categoriaUrl);

  const busca = document.getElementById('campo-busca-produtos');
  if(busca){
    busca.addEventListener('input', () => ndjAplicarFiltro(ndjFiltroAtivo(), busca.value));
  }
}

function ndjMontarFiltros(categoriaAtiva){
  const alvo = document.getElementById('filtros-categoria');
  if(!alvo) return;
  const todas = [{ id: 'todas', nome: 'Todas' }, ...ndjListarCategorias()];
  alvo.innerHTML = todas.map(c => `
    <button class="chip-filtro ${c.id === categoriaAtiva ? 'ativo' : ''}" data-categoria="${c.id}">${c.nome}</button>
  `).join('');
  alvo.querySelectorAll('.chip-filtro').forEach(btn => {
    btn.addEventListener('click', () => {
      alvo.querySelectorAll('.chip-filtro').forEach(b => b.classList.remove('ativo'));
      btn.classList.add('ativo');
      const busca = document.getElementById('campo-busca-produtos');
      ndjAplicarFiltro(btn.dataset.categoria, busca ? busca.value : '');
    });
  });
}

function ndjFiltroAtivo(){
  const ativo = document.querySelector('.chip-filtro.ativo');
  return ativo ? ativo.dataset.categoria : 'todas';
}

function ndjAplicarFiltro(categoria, termoBusca){
  const alvo = document.getElementById('grade-produtos-todos');
  let produtos = ndjListarProdutos();
  if(categoria && categoria !== 'todas'){
    produtos = produtos.filter(p => p.categoria === categoria);
  }
  if(termoBusca){
    const t = termoBusca.toLowerCase();
    produtos = produtos.filter(p => p.nome.toLowerCase().includes(t));
  }
  document.getElementById('contador-resultados').textContent =
    produtos.length + (produtos.length === 1 ? ' produto encontrado' : ' produtos encontrados');
  alvo.innerHTML = produtos.length
    ? produtos.map(ndjCartaoProdutoHTML).join('')
    : '<p>Nenhum produto encontrado para esse filtro.</p>';
}
