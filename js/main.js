/* ==========================================================================
   NDJ 3D — Comportamentos gerais de interface
   ========================================================================== */

document.addEventListener('DOMContentLoaded', async () => {
  await ndjCarregarDadosIniciais();
  ndjAtualizarBadgeCarrinho();
  ndjRenderizarCategoriasHome();
  ndjRenderizarDestaques();
  ndjRenderizarGradeProdutos();
});
/* O menu mobile agora é montado em js/layout.js, junto com o cabeçalho. */

/* ---------- Aviso de entrega/retirada combinada (Chopinzinho e Região) ----------
   Reutilizado na página de produto e no carrinho. */
function ndjMontarAvisoRetiradaLocal(idAlvo){
  const alvo = document.getElementById(idAlvo);
  if(!alvo) return;
  alvo.innerHTML = `📍 É de <strong>${NDJ_CONFIG.regiaoLocal}</strong>? A entrega ou retirada também pode ser combinada direto pelo
    <a href="https://wa.me/${NDJ_CONFIG.whatsappNumero}" target="_blank" rel="noopener">WhatsApp</a>, sem pagar frete calculado.`;
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
  const produtos = ndjListarProdutos().slice(0, 4);
  alvo.innerHTML = produtos.map(ndjCartaoProdutoHTML).join('');
}

/* ---------- Cartão de produto reutilizável ---------- */
function ndjCartaoProdutoHTML(p){
  const cat = ndjListarCategorias().find(c => c.id === p.categoria);
  return `
    <div class="cartao-produto">
      <a href="produto.html?id=${p.id}" class="miniatura">
        <span class="tag-categoria">${cat ? cat.nome : p.categoria}</span>
        <img src="${p.imagens[0]}" alt="${p.nome}" loading="lazy">
      </a>
      <div class="corpo-cartao">
        <h3><a href="produto.html?id=${p.id}">${p.nome}</a></h3>
        <div class="cores-mini">
          ${p.cores.slice(0,5).map(c => `<span class="ponto-cor" style="background:${c.hex}" title="${c.nome}"></span>`).join('')}
        </div>
        <div class="preco">${ndjFormatarMoeda(p.preco)} ${p.personalizacao.disponivel ? '<small>a partir de</small>' : ''}</div>
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
