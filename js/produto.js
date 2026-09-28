/* ==========================================================================
   NDJ 3D — Lógica da página de detalhe do produto
   Loja completa: preço, quantidade (respeitando pedido mínimo), carrinho,
   frete estimado e avaliações — além de cor com foto real, personalização,
   aviso de desconto no WhatsApp e links para os marketplaces.
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

function ndjQuantidadeMinima(){
  const p = ndjProdutoAtual;
  return (p.pedidoMinimo && p.pedidoMinimo.ativo) ? Math.max(1, p.pedidoMinimo.quantidade) : 1;
}

async function ndjMontarPaginaProduto(){
  const p = ndjProdutoAtual;
  const cat = ndjListarCategorias().find(c => c.id === p.categoria);
  document.title = p.nome + ' · NDJ 3D';
  ndjCorSelecionada = p.cores[0] ? p.cores[0].nome : null;
  ndjQtdSelecionada = ndjQuantidadeMinima();

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

  document.getElementById('estoque-produto').textContent = p.pausado
    ? ''
    : (p.estoque > 10 ? 'Em estoque' : (p.estoque > 0 ? `Últimas ${p.estoque} unidades` : 'Sob encomenda'));

  // Avaliações — resumo (média + total) ao lado do título
  ndjAvaliacoesDoProduto(p.id).then(avaliacoes => {
    const resumo = ndjResumoAvaliacoes(avaliacoes);
    const alvoResumo = document.getElementById('resumo-avaliacao-produto');
    alvoResumo.innerHTML = resumo.total
      ? `★ ${resumo.media.toFixed(1)} · ${resumo.total} avaliaç${resumo.total===1?'ão':'ões'}`
      : '<span class="sem-avaliacao">Ainda sem avaliações</span>';
    ndjMontarPainelAvaliacoes(avaliacoes);
  });

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

  // Personalização
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
        <small class="aviso-personalizacao-whatsapp">A personalização será combinada após a aprovação do pedido via WhatsApp</small>
      </div>`;
    const check = document.getElementById('check-personalizar');
    const texto = document.getElementById('texto-personalizar');
    check.addEventListener('change', () => {
      texto.disabled = !check.checked;
      if(!check.checked) texto.value = '';
      ndjAtualizarResumoPreco();
    });
    texto.addEventListener('input', ndjAtualizarBotaoWhatsapp);
  } else {
    blocoPersonalizar.innerHTML = '';
  }

  // Quantidade (respeitando pedido mínimo)
  const minimo = ndjQuantidadeMinima();
  const inputQtd = document.getElementById('qtd-input');
  inputQtd.min = minimo;
  inputQtd.value = minimo;
  const avisoPedidoMinimo = document.getElementById('aviso-pedido-minimo');
  if(minimo > 1){
    avisoPedidoMinimo.textContent = `Pedido mínimo: ${minimo} unidades`;
    avisoPedidoMinimo.style.display = 'block';
  } else {
    avisoPedidoMinimo.style.display = 'none';
  }

  document.getElementById('btn-qtd-menos').addEventListener('click', () => {
    ndjQtdSelecionada = Math.max(minimo, ndjQtdSelecionada - 1);
    inputQtd.value = ndjQtdSelecionada;
    ndjAtualizarResumoPreco();
  });
  document.getElementById('btn-qtd-mais').addEventListener('click', () => {
    ndjQtdSelecionada = ndjQtdSelecionada + 1;
    inputQtd.value = ndjQtdSelecionada;
    ndjAtualizarResumoPreco();
  });
  inputQtd.addEventListener('change', () => {
    ndjQtdSelecionada = Math.max(minimo, parseInt(inputQtd.value) || minimo);
    inputQtd.value = ndjQtdSelecionada;
    ndjAtualizarResumoPreco();
  });

  ndjAtualizarResumoPreco();

  // Links dos marketplaces + botão WhatsApp
  ndjMontarLinksMarketplace(p);
  
  ndjAtualizarBotaoWhatsapp();

  document.getElementById('btn-adicionar-carrinho').addEventListener('click', () => ndjAdicionarProdutoAoCarrinho(false));
  document.getElementById('btn-comprar-agora').addEventListener('click', () => ndjAdicionarProdutoAoCarrinho(true));

  ndjAplicarEstadoPausado(p);

  // Descrição / características — preserva as quebras de linha digitadas no
  // admin: o texto é escapado (evita HTML quebrado com < > &) e cada \n
  // vira um <br>, já que innerHTML ignora quebras de linha "cruas".
  const descricaoEscapada = (p.descricao || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\r\n|\r|\n/g, '<br>');
  document.getElementById('painel-descricao').innerHTML = `<p>${descricaoEscapada}</p>`;
  document.getElementById('painel-caracteristicas').innerHTML = `<ul>${p.caracteristicas.map(c => `<li>${c}</li>`).join('')}</ul>`;

  document.getElementById('texto-entrega-produto').innerHTML = `
    <p style="margin-top:16px">Este produto também pode ser comprado na <strong>Shopee</strong>${p.tiktokUrl ? ' e no <strong>TikTok Shop</strong>' : ''}, com todas as garantias da plataforma.</p>
    <p>Pedidos personalizados podem levar de 1 a 3 dias úteis extras para produção antes do envio.</p>
  `;
  document.getElementById('btn-calcular-frete-produto').addEventListener('click', ndjCalcularFreteProduto);

  ndjLigarAbas();
  ndjMontarAvisoRetiradaLocal('aviso-retirada-local');

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

function ndjPrecoUnitarioAtual(){
  return ndjPrecoAtualProduto(ndjProdutoAtual);
}

function ndjAtualizarResumoPreco(){
  const p = ndjProdutoAtual;
  const emPromocao = p.promocao && p.promocao.ativa && p.promocao.precoPromocional > 0;
  const precoAtual = ndjPrecoAtualProduto(p);
  const total = precoAtual * ndjQtdSelecionada;

  document.getElementById('selo-promocao-produto').innerHTML = emPromocao
    ? '<span class="selo-promocao-produto">Promoção</span>'
    : '';

  document.getElementById('preco-produto-valor').innerHTML = emPromocao
    ? `<span class="preco-antigo">${ndjFormatarMoeda(p.preco)}</span> <span class="preco-promocional">${ndjFormatarMoeda(precoAtual)}</span>`
    : ndjFormatarMoeda(precoAtual);

  document.getElementById('resumo-preco-final').innerHTML = `
    <div class="linha"><span>Preço unitário</span><span>${ndjFormatarMoeda(precoAtual)}</span></div>
    <div class="linha"><span>Quantidade</span><span>${ndjQtdSelecionada}</span></div>
    <div class="linha total"><span>Total</span><span>${ndjFormatarMoeda(total)}</span></div>
  `;
  ndjAtualizarBotaoWhatsapp();
}

/* Mensagem do WhatsApp: produto, cor e personalização (se houver) — igual
   já era antes, sem preço/quantidade, pra manter o mesmo tom de "vamos
   combinar direto no chat". */
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

/* Produto pausado no admin: mantém a página acessível (link não quebra),
   mas remove os caminhos de compra pelo site (carrinho/comprar agora/
   WhatsApp) e avisa o cliente que está indisponível no momento. Os links
   de marketplace (Shopee/TikTok) continuam ativos, já que o estoque lá é
   controlado de forma independente. */
function ndjAplicarEstadoPausado(p){
  if(!p.pausado) return;

  const aviso = document.createElement('div');
  aviso.className = 'aviso-produto-pausado';
  aviso.innerHTML = '<strong>Produto indisponível no momento.</strong> Volte em breve ou confira as demais opções da loja.';
  aviso.style.cssText = 'margin:14px 0; padding:12px 14px; border-radius:10px; background:#fdecea; color:#8a1f11; font-size:14px;';
  document.querySelector('.resumo-preco-final').insertAdjacentElement('afterend', aviso);

  document.getElementById('qtd-input').disabled = true;
  document.getElementById('btn-qtd-menos').disabled = true;
  document.getElementById('btn-qtd-mais').disabled = true;

  const btnCarrinho = document.getElementById('btn-adicionar-carrinho');
  const btnComprar = document.getElementById('btn-comprar-agora');
  btnCarrinho.disabled = true;
  btnComprar.disabled = true;
  btnCarrinho.textContent = 'Indisponível';
  btnComprar.textContent = 'Indisponível';

  const btnWhatsapp = document.getElementById('btn-comprar-whatsapp');
  if(btnWhatsapp){
    btnWhatsapp.parentElement.style.display = 'none';
  }
}

function ndjAdicionarProdutoAoCarrinho(irParaCheckout){
  const p = ndjProdutoAtual;
  if(p.pausado){
    ndjMostrarAviso('Este produto está indisponível no momento.', 'erro');
    return;
  }
  const personalizado = ndjPersonalizacaoAtiva();
  const textoPersonalizado = personalizado ? (document.getElementById('texto-personalizar').value.trim()) : '';

  if(personalizado && p.personalizacao.disponivel && !textoPersonalizado){
    ndjMostrarAviso('Digite o texto da personalização antes de continuar.', 'erro');
    return;
  }

  ndjAdicionarAoCarrinho({
    produtoId: p.id,
    nome: p.nome,
    imagem: p.imagens[0],
    cor: ndjCorSelecionada,
    personalizado,
    textoPersonalizado,
    precoUnitario: ndjPrecoUnitarioAtual(),
    quantidade: ndjQtdSelecionada
  });

  if(irParaCheckout){
    window.location.href = 'carrinho.html';
  } else {
    ndjMostrarAviso('Produto adicionado ao carrinho!');
  }
}

async function ndjCalcularFreteProduto(){
  const cep = document.getElementById('campo-cep-produto').value;
  const alvo = document.getElementById('resultado-frete-produto');
  const digitos = (cep || '').replace(/\D/g, '');

  if(digitos.length !== 8){
    alvo.innerHTML = '<p style="color:var(--erro); font-size:13px;">Digite um CEP válido (8 números).</p>';
    return;
  }

  const botao = document.getElementById('btn-calcular-frete-produto');
  botao.disabled = true;
  alvo.innerHTML = '<p style="font-size:13px; color:var(--tinta-suave);">Calculando frete...</p>';

  const p = ndjProdutoAtual;
  const opcoes = await ndjCalcularFrete(cep, [{
    nome: p.nome,
    pesoKg: p.pesoKg,
    preco: p.preco,
    quantidade: ndjQtdSelecionada
  }]);
  botao.disabled = false;

  if(!opcoes || opcoes.erro){
    alvo.innerHTML = `<p style="color:var(--erro); font-size:13px;">${(opcoes && opcoes.erro) || 'Digite um CEP válido (8 números).'}</p>`;
    return;
  }
  if(!opcoes.length){
    alvo.innerHTML = '<p style="color:var(--erro); font-size:13px;">Nenhuma opção de frete encontrada para esse CEP.</p>';
    return;
  }

  alvo.innerHTML = opcoes.map(op => `
    <div class="opcao-frete">
      <span>${op.nome} — até ${op.prazoDias} dias úteis</span>
      <span>${ndjFormatarMoeda(op.valor)}</span>
    </div>
  `).join('');
}

/* ---------------- Avaliações (aba do produto) ---------------- */
function ndjMontarPainelAvaliacoes(avaliacoes){
  const alvo = document.getElementById('painel-avaliacoes');
  if(!avaliacoes.length){
    alvo.innerHTML = '<p class="sem-avaliacao">Este produto ainda não tem avaliações. Seja o primeiro a comprar e avaliar!</p>';
    return;
  }
  alvo.innerHTML = avaliacoes.map(a => `
    <div class="cartao-avaliacao">
      <div class="cartao-avaliacao-topo">
        <strong>${ndjEscaparHtml(a.nome_cliente || 'Cliente NDJ 3D')}</strong>
        <span class="estrelas-exibicao">${'★'.repeat(a.nota)}${'☆'.repeat(5 - a.nota)}</span>
      </div>
      ${a.comentario ? `<p>${ndjEscaparHtml(a.comentario)}</p>` : ''}
      <small>${new Date(a.criado_em).toLocaleDateString('pt-BR')}</small>
    </div>
  `).join('');
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
