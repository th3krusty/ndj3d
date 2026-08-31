/* ==========================================================================
   NDJ 3D — Montador de layout compartilhado
   Injeta o aviso do topo, cabeçalho, rodapé e botões flutuantes em toda
   página que tiver os elementos "âncora" abaixo no HTML:
     <div id="ndj-topo-aviso"></div>
     <header id="ndj-cabecalho"></header>
     <footer id="ndj-rodape"></footer>
     <div id="ndj-flutuantes"></div>
   Assim, qualquer alteração feita aqui (ou em config.js) aparece
   automaticamente em todas as páginas — sem precisar editar uma por uma.
   Controle por página via atributos no <body>:
     data-pagina="index|produtos|produto|carrinho|checkout|pedido|contato"
     data-nav="0"          → esconde o menu de navegação (ex: checkout)
     data-flutuantes="0"   → esconde os botões flutuantes (ex: checkout)
     data-rodape="minimo"  → mostra só a linha de copyright (ex: checkout)
   ========================================================================== */

document.addEventListener('DOMContentLoaded', ndjMontarLayout);

function ndjMontarLayout(){
  const body = document.body;
  const pagina = body.dataset.pagina || '';
  const comNav = body.dataset.nav !== '0';
  const comFlutuantes = body.dataset.flutuantes !== '0';
  const rodapeCompleto = body.dataset.rodape !== 'minimo';

  ndjInjetarTopoAviso();
  ndjInjetarCabecalho(pagina, comNav);
  ndjInjetarRodape(rodapeCompleto);
  if(comFlutuantes) ndjInjetarFlutuantes();
  if(typeof ndjAtualizarBadgeCarrinho === 'function') ndjAtualizarBadgeCarrinho();
}

function ndjInjetarTopoAviso(){
  const alvo = document.getElementById('ndj-topo-aviso');
  if(!alvo) return;
  alvo.textContent = NDJ_CONFIG.topoAviso;
}

function ndjInjetarCabecalho(paginaAtiva, comNav){
  const el = document.getElementById('ndj-cabecalho');
  if(!el) return;

  const linksNav = [
    { href: 'index.html', label: 'Início', chave: 'index' },
    { href: 'produtos.html', label: 'Produtos', chave: 'produtos' },
    { href: 'pedido.html', label: 'Rastrear pedido', chave: 'pedido' },
    { href: 'contato.html', label: 'Contato', chave: 'contato' }
  ];

  const nav = comNav ? `
    <nav class="nav-principal">
      <ul>
        ${linksNav.map(l => `<li><a href="${l.href}" class="${l.chave === paginaAtiva ? 'ativo' : ''}">${l.label}</a></li>`).join('')}
      </ul>
    </nav>` : '';

  el.innerHTML = `
    <div class="container">
      <a href="index.html" class="marca">
        <img src="assets/logo.jpg" alt="Logo ${NDJ_CONFIG.nomeLoja}">
        <div class="txt">
          <strong>${NDJ_CONFIG.nomeLoja}</strong>
          <span>${NDJ_CONFIG.slogan}</span>
        </div>
      </a>
      ${nav}
      <div class="acoes-cabecalho">
        <a href="carrinho.html" class="icone-btn" title="Carrinho">
          🛒<span class="badge-carrinho">0</span>
        </a>
        ${comNav ? '<button class="btn-menu-mobile" aria-label="Abrir menu">☰</button>' : ''}
      </div>
    </div>`;

  if(comNav) ndjLigarMenuMobile();
}

function ndjLigarMenuMobile(){
  const botao = document.querySelector('.btn-menu-mobile');
  const nav = document.querySelector('.nav-principal');
  if(!botao || !nav) return;

  botao.addEventListener('click', (e) => {
    e.stopPropagation();
    const aberto = nav.classList.toggle('aberto');
    botao.setAttribute('aria-expanded', aberto ? 'true' : 'false');
  });

  nav.querySelectorAll('a').forEach(a => {
    a.addEventListener('click', () => nav.classList.remove('aberto'));
  });

  document.addEventListener('click', (e) => {
    if(!nav.contains(e.target) && !botao.contains(e.target)){
      nav.classList.remove('aberto');
    }
  });
}

function ndjInjetarRodape(completo){
  const el = document.getElementById('ndj-rodape');
  if(!el) return;

  if(!completo){
    el.innerHTML = `<div class="container"><div class="copyright">© 2026 ${NDJ_CONFIG.nomeLoja} — ${NDJ_CONFIG.slogan}.</div></div>`;
    return;
  }

  el.innerHTML = `
    <div class="container">
      <div class="grade-rodape">
        <div>
          <a href="index.html" class="marca">
            <img src="assets/logo.jpg" alt="Logo ${NDJ_CONFIG.nomeLoja}">
            <div class="txt"><strong>${NDJ_CONFIG.nomeLoja}</strong><span>${NDJ_CONFIG.slogan}</span></div>
          </a>
          <p class="sobre">Peças impressas em 3D com cuidado artesanal, feitas para presentear, decorar e organizar o seu dia a dia.</p>
          <div class="selos-pagamento">
            <span class="selo">Pix</span><span class="selo">Cartão</span><span class="selo">Boleto</span>
          </div>
        </div>
        <div>
          <h4>Loja</h4>
          <ul>
            <li><a href="produtos.html">Todos os produtos</a></li>
            <li><a href="produtos.html?categoria=presentes">Presentes</a></li>
            <li><a href="produtos.html?categoria=lembrancinhas">Lembrancinhas</a></li>
             <li><a href="produtos.html?categoria=chaveiros">Chaveiros</a></li>
              <li><a href="produtos.html?categoria=sensoriais">Sensoriais</a></li>
          </ul>
        </div>
        <div>
          <h4>Atendimento</h4>
          <ul>
            <li><a href="pedido.html">Rastrear pedido</a></li>
            <li><a href="carrinho.html">Meu carrinho</a></li>
            <li><a href="contato.html">Fale conosco</a></li>
             <li><a href="https://shopee.com.br/ndj3d" target="_blank" rel="noopener">Loja Oficial na Shopee</a></li>
           <li><a href="linker.html" target="_blank" rel="noopener">Linker</a></li>
             <li><a href="admin.html">Área do administrador</a></li>
          </ul>
        </div>
        <div>
          <h4>Contato</h4>
          <ul>
            <li>WhatsApp: ${NDJ_CONFIG.whatsappExibicao}</li>
            <li>${NDJ_CONFIG.email}</li>
            <li>Instagram: @${NDJ_CONFIG.instagramUsuario}</li>
            <li>${NDJ_CONFIG.localizacao}</li>
          </ul>
        </div>
      </div>
      <div class="copyright">© 2026 ${NDJ_CONFIG.nomeLoja} — ${NDJ_CONFIG.slogan}. Todos os direitos reservados.</div>
    </div>
    <div class="rodape-credito">Desenvolvido por <a href="${NDJ_CONFIG.creditoUrl}" target="_blank" rel="noopener" title="${NDJ_CONFIG.creditoNome}">${NDJ_CONFIG.creditoNome}</a></div>
  `;
}

function ndjInjetarFlutuantes(){
  const el = document.getElementById('ndj-flutuantes');
  if(!el) return;

  el.innerHTML = `
    <a class="whatsapp-float" href="https://wa.me/${NDJ_CONFIG.whatsappNumero}" target="_blank" rel="noopener" aria-label="Fale no WhatsApp">
      <svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 24 24" fill="currentColor">
        <path d="M20.52 3.48A11.82 11.82 0 0 0 12.04 0C5.48 0 .14 5.34.14 11.9c0 2.1.55 4.15 1.6 5.95L.06 24l6.3-1.65a11.86 11.86 0 0 0 5.68 1.45h.01c6.56 0 11.9-5.34 11.9-11.9 0-3.18-1.24-6.17-3.43-8.42ZM12.05 21.8h-.01a9.87 9.87 0 0 1-5.03-1.37l-.36-.21-3.74.98 1-3.65-.23-.37a9.87 9.87 0 0 1-1.51-5.28c0-5.45 4.44-9.89 9.9-9.89 2.64 0 5.12 1.03 6.99 2.9a9.82 9.82 0 0 1 2.9 7c0 5.45-4.44 9.89-9.91 9.89Zm5.42-7.41c-.3-.15-1.77-.87-2.05-.97-.28-.1-.48-.15-.68.15-.2.3-.78.97-.96 1.17-.18.2-.35.22-.65.07-.3-.15-1.25-.46-2.38-1.47-.88-.79-1.47-1.77-1.64-2.07-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.07-.15-.68-1.64-.93-2.25-.25-.59-.5-.51-.68-.52h-.58c-.2 0-.52.07-.8.37-.28.3-1.05 1.02-1.05 2.49s1.07 2.89 1.22 3.09c.15.2 2.1 3.2 5.09 4.49.71.31 1.26.5 1.69.64.71.23 1.36.2 1.87.12.57-.09 1.77-.72 2.02-1.42.25-.7.25-1.3.17-1.42-.07-.12-.27-.2-.57-.35Z"/>
      </svg>
    </a>
    <a class="instagram-float" href="${NDJ_CONFIG.instagramUrl}" target="_blank" rel="noopener noreferrer" aria-label="Siga no Instagram">
      <svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect width="20" height="20" x="2" y="2" rx="5" ry="5"></rect>
        <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
        <line x1="17.5" x2="17.51" y1="6.5" y2="6.5"></line>
      </svg>
    </a>
  `;
}
