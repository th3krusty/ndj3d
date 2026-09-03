/* ==========================================================================
   NDJ 3D — Painel administrador
   O login agora usa Supabase Auth (e-mail fixo definido em NDJ_ADMIN_EMAIL,
   dentro de js/supabaseClient.js + senha cadastrada no Supabase). Veja o
   README-SUPABASE.md para o passo a passo de como criar esse usuário.
   ========================================================================== */

let ndjCoresEmEdicao = [];
/* Cada posição (0 a 4) guarda: null (vazio), { url: '...' } (foto já salva
   no Supabase Storage) ou { arquivo: File, preview: 'blob:...' } (foto nova
   escolhida do dispositivo, ainda não enviada). */
let ndjImagensEmEdicao = [null, null, null, null, null];

document.addEventListener('DOMContentLoaded', async () => {
  if(await ndjAdminLogado()){
    await ndjMostrarPainel();
  } else {
    ndjMostrarTelaLogin();
  }

  document.getElementById('form-login-admin').addEventListener('submit', async (e) => {
    e.preventDefault();
    const senha = document.getElementById('campo-senha-admin').value;
    const botao = e.target.querySelector('button[type=submit]');
    botao.disabled = true;
    const ok = await ndjAdminEntrar(senha);
    botao.disabled = false;
    if(ok){
      document.getElementById('erro-login').style.display = 'none';
      await ndjMostrarPainel();
    } else {
      document.getElementById('erro-login').style.display = 'block';
    }
  });

  document.getElementById('btn-sair-admin').addEventListener('click', async () => {
    await ndjAdminSair();
    window.location.reload();
  });

  document.querySelectorAll('.nav-admin button').forEach(btn => {
    btn.addEventListener('click', () => ndjTrocarSecaoAdmin(btn.dataset.secao));
  });

  document.getElementById('btn-novo-produto').addEventListener('click', () => ndjAbrirModalProduto(null));
  document.getElementById('form-produto-admin').addEventListener('submit', ndjSalvarProdutoAdmin);
  document.getElementById('fechar-modal-produto').addEventListener('click', ndjFecharModalProduto);

  for(let i=0; i<5; i++){
    document.getElementById('campo-imagem-' + i).addEventListener('change', (e) => ndjSelecionarImagemProduto(i, e.target.files[0]));
    document.getElementById('remover-imagem-' + i).addEventListener('click', (e) => {
      e.preventDefault();
      ndjRemoverImagemProduto(i);
    });
  }
  document.getElementById('btn-add-cor').addEventListener('click', ndjAdicionarCorEdicao);
  document.getElementById('check-personalizacao-admin').addEventListener('change', (e) => {
    document.getElementById('campos-personalizacao-admin').style.display = e.target.checked ? 'grid' : 'none';
  });
  document.getElementById('busca-admin-produtos').addEventListener('input', (e) => ndjRenderizarTabelaProdutos(e.target.value));

  document.getElementById('btn-nova-categoria').addEventListener('click', () => ndjAbrirModalCategoria(null));
  document.getElementById('form-categoria-admin').addEventListener('submit', ndjSalvarCategoriaAdmin);
  document.getElementById('fechar-modal-categoria').addEventListener('click', () => {
    document.getElementById('modal-categoria').classList.remove('aberta');
  });

  document.getElementById('form-novo-cupom').addEventListener('submit', ndjCriarCupomAdmin);

  document.getElementById('form-alterar-senha').addEventListener('submit', async (e) => {
    e.preventDefault();
    const nova = document.getElementById('campo-nova-senha').value;
    if(nova.length < 6){
      ndjMostrarAviso('A senha deve ter ao menos 6 caracteres (regra do Supabase Auth).', 'erro');
      return;
    }
    try {
      await ndjAlterarSenhaAdmin(nova);
      document.getElementById('campo-nova-senha').value = '';
      ndjMostrarAviso('Senha do administrador atualizada.');
    } catch (err) {
      ndjMostrarAviso('Não foi possível alterar a senha: ' + err.message, 'erro');
    }
  });
});

function ndjMostrarTelaLogin(){
  document.getElementById('tela-login').style.display = 'flex';
  document.getElementById('shell-admin').style.display = 'none';
}

async function ndjMostrarPainel(){
  document.getElementById('tela-login').style.display = 'none';
  document.getElementById('shell-admin').style.display = 'grid';
  await ndjCarregarDadosIniciais();
  await ndjAtualizarMetricasAdmin();
  ndjRenderizarTabelaProdutos();
  ndjRenderizarTabelaCategorias();
  ndjRenderizarTabelaCupons();
  await ndjRenderizarTabelaPedidos();
}

function ndjTrocarSecaoAdmin(secao){
  document.querySelectorAll('.nav-admin button').forEach(b => b.classList.toggle('ativo', b.dataset.secao === secao));
  document.querySelectorAll('.painel-admin-secao').forEach(p => p.classList.toggle('ativo', p.id === 'secao-' + secao));
}

async function ndjAtualizarMetricasAdmin(){
  const produtos = ndjListarProdutos();
  const pedidos = await ndjListarPedidos();
  const faturamento = pedidos.reduce((s,p) => s + p.total, 0);
  document.getElementById('metrica-produtos').textContent = produtos.length;
  document.getElementById('metrica-pedidos').textContent = pedidos.length;
  document.getElementById('metrica-faturamento').textContent = ndjFormatarMoeda(faturamento);
  document.getElementById('metrica-cupons').textContent = ndjListarCupons().filter(c => c.ativo).length;
}

/* ---------------- Produtos ---------------- */
function ndjRenderizarTabelaProdutos(termo){
  let produtos = ndjListarProdutos();
  if(termo){
    produtos = produtos.filter(p => p.nome.toLowerCase().includes(termo.toLowerCase()));
  }
  const corpo = document.getElementById('corpo-tabela-produtos');
  corpo.innerHTML = produtos.map(p => {
    const cat = ndjListarCategorias().find(c => c.id === p.categoria);
    return `
    <tr>
      <td><img src="${p.imagens[0]}" alt=""></td>
      <td>${p.nome}</td>
      <td>${cat ? cat.nome : p.categoria}</td>
      <td>${ndjFormatarMoeda(p.preco)}</td>
      <td>${p.estoque}</td>
      <td>${p.personalizacao.disponivel ? 'Sim (+' + ndjFormatarMoeda(p.personalizacao.precoExtra) + ')' : 'Não'}</td>
      <td class="acoes-tabela">
        <button class="btn btn-contorno btn-pequeno" data-acao="editar" data-id="${p.id}">Editar</button>
        <button class="btn btn-perigo btn-pequeno" data-acao="excluir" data-id="${p.id}">Excluir</button>
      </td>
    </tr>`;
  }).join('') || '<tr><td colspan="7">Nenhum produto cadastrado.</td></tr>';

  corpo.querySelectorAll('[data-acao=editar]').forEach(b => b.addEventListener('click', () => ndjAbrirModalProduto(b.dataset.id)));
  corpo.querySelectorAll('[data-acao=excluir]').forEach(b => b.addEventListener('click', async () => {
    if(confirm('Tem certeza que deseja excluir este produto?')){
      try {
        await ndjExcluirProduto(b.dataset.id);
        ndjRenderizarTabelaProdutos();
        await ndjAtualizarMetricasAdmin();
      } catch (err) {
        ndjMostrarAviso('Não foi possível excluir o produto.', 'erro');
      }
    }
  }));
}

function ndjAbrirModalProduto(id){
  const produto = id ? ndjBuscarProduto(id) : null;
  document.getElementById('titulo-modal-produto').textContent = produto ? 'Editar produto' : 'Novo produto';
  document.getElementById('campo-produto-id').value = produto ? produto.id : '';
  document.getElementById('campo-produto-nome').value = produto ? produto.nome : '';

  const selectCategoria = document.getElementById('campo-produto-categoria');
  const categorias = ndjListarCategorias();
  selectCategoria.innerHTML = categorias.map(c => `<option value="${c.id}">${c.nome}</option>`).join('');
  selectCategoria.value = produto ? produto.categoria : (categorias[0] ? categorias[0].id : '');
  document.getElementById('campo-produto-preco').value = produto ? produto.preco : '';
  document.getElementById('campo-produto-estoque').value = produto ? produto.estoque : 10;
  document.getElementById('campo-produto-peso').value = produto ? produto.pesoKg : 0.1;
  document.getElementById('campo-produto-shopee').value = produto ? produto.shopeeUrl : 'https://shopee.com.br/';
  document.getElementById('campo-produto-descricao').value = produto ? produto.descricao : '';
  document.getElementById('campo-produto-caracteristicas').value = produto ? produto.caracteristicas.join('\n') : '';

  const imagens = produto ? produto.imagens : [];
  ndjImagensEmEdicao = [0,1,2,3,4].map(i => imagens[i] ? { url: imagens[i] } : null);
  ndjRenderizarImagensEdicao();

  ndjCoresEmEdicao = produto ? JSON.parse(JSON.stringify(produto.cores)) : [];
  ndjRenderizarCoresEdicao();

  const check = document.getElementById('check-personalizacao-admin');
  check.checked = produto ? produto.personalizacao.disponivel : false;
  document.getElementById('campos-personalizacao-admin').style.display = check.checked ? 'grid' : 'none';
  document.getElementById('campo-personalizacao-preco').value = produto ? produto.personalizacao.precoExtra : 5;
  document.getElementById('campo-personalizacao-rotulo').value = produto ? produto.personalizacao.rotulo : 'Nome personalizado';
  document.getElementById('campo-personalizacao-max').value = produto ? produto.personalizacao.maxCaracteres : 15;

  document.getElementById('modal-produto').classList.add('aberta');
}

function ndjFecharModalProduto(){
  document.getElementById('modal-produto').classList.remove('aberta');
  ndjLimparPreviewsImagens();
}

/* ---------------- Fotos do produto (upload do dispositivo → Supabase Storage) ---------------- */
function ndjRenderizarImagensEdicao(){
  for(let i=0; i<5; i++){
    const item = ndjImagensEmEdicao[i];
    const img = document.getElementById('preview-imagem-' + i);
    const botaoRemover = document.getElementById('remover-imagem-' + i);
    const urlPreview = item ? (item.preview || item.url) : '';
    if(urlPreview){
      img.src = urlPreview;
      img.style.display = 'block';
      botaoRemover.style.display = 'flex';
    } else {
      img.removeAttribute('src');
      img.style.display = 'none';
      botaoRemover.style.display = 'none';
    }
  }
}

function ndjSelecionarImagemProduto(indice, arquivo){
  if(!arquivo) return;
  if(!arquivo.type.startsWith('image/')){
    ndjMostrarAviso('Escolha um arquivo de imagem (jpg, png, webp...).', 'erro');
    return;
  }
  if(arquivo.size > 5 * 1024 * 1024){
    ndjMostrarAviso('Essa foto passa de 5MB. Escolha uma imagem menor.', 'erro');
    return;
  }
  const anterior = ndjImagensEmEdicao[indice];
  if(anterior && anterior.preview) URL.revokeObjectURL(anterior.preview);
  ndjImagensEmEdicao[indice] = { arquivo, preview: URL.createObjectURL(arquivo) };
  ndjRenderizarImagensEdicao();
}

function ndjRemoverImagemProduto(indice){
  const item = ndjImagensEmEdicao[indice];
  if(item && item.preview) URL.revokeObjectURL(item.preview);
  ndjImagensEmEdicao[indice] = null;
  document.getElementById('campo-imagem-' + indice).value = '';
  ndjRenderizarImagensEdicao();
}

function ndjLimparPreviewsImagens(){
  ndjImagensEmEdicao.forEach(item => { if(item && item.preview) URL.revokeObjectURL(item.preview); });
  ndjImagensEmEdicao = [null, null, null, null, null];
  for(let i=0; i<5; i++) document.getElementById('campo-imagem-' + i).value = '';
}

function ndjRenderizarCoresEdicao(){
  const alvo = document.getElementById('lista-cores-admin');
  alvo.innerHTML = ndjCoresEmEdicao.map((c, i) => `
    <span class="tag-cor-admin"><span style="width:10px;height:10px;border-radius:50%;background:${c.hex};display:inline-block;"></span>${c.nome} <button type="button" data-i="${i}">&times;</button></span>
  `).join('') || '<span style="font-size:12px;color:var(--tinta-suave)">Nenhuma cor adicionada.</span>';

  alvo.querySelectorAll('button').forEach(b => b.addEventListener('click', () => {
    ndjCoresEmEdicao.splice(parseInt(b.dataset.i), 1);
    ndjRenderizarCoresEdicao();
  }));
}

function ndjAdicionarCorEdicao(){
  const nome = document.getElementById('campo-nova-cor-nome').value.trim();
  const hex = document.getElementById('campo-nova-cor-hex').value;
  if(!nome) return;
  ndjCoresEmEdicao.push({ nome, hex });
  document.getElementById('campo-nova-cor-nome').value = '';
  ndjRenderizarCoresEdicao();
}

async function ndjSalvarProdutoAdmin(e){
  e.preventDefault();
  const idExistente = document.getElementById('campo-produto-id').value;
  const temAlgumaFoto = ndjImagensEmEdicao.some(Boolean);
  if(!temAlgumaFoto){
    ndjMostrarAviso('Adicione pelo menos 1 foto (o ideal são 5).', 'erro');
    return;
  }
  const personalizacaoAtiva = document.getElementById('check-personalizacao-admin').checked;
  const id = idExistente || ndjGerarIdProduto();

  const botao = e.target.querySelector('button[type=submit]');
  if(botao) botao.disabled = true;

  let imagens;
  try {
    imagens = await ndjEnviarImagensProduto(id);
  } catch (err) {
    ndjMostrarAviso('Não foi possível enviar as fotos: ' + err.message, 'erro');
    if(botao) botao.disabled = false;
    return;
  }
  if(imagens.length < 1){
    ndjMostrarAviso('Adicione pelo menos 1 foto (o ideal são 5).', 'erro');
    if(botao) botao.disabled = false;
    return;
  }

  const produto = {
    id,
    nome: document.getElementById('campo-produto-nome').value.trim(),
    categoria: document.getElementById('campo-produto-categoria').value,
    preco: parseFloat(document.getElementById('campo-produto-preco').value) || 0,
    imagens,
    cores: ndjCoresEmEdicao,
    personalizacao: {
      disponivel: personalizacaoAtiva,
      precoExtra: parseFloat(document.getElementById('campo-personalizacao-preco').value) || 0,
      rotulo: document.getElementById('campo-personalizacao-rotulo').value.trim(),
      maxCaracteres: parseInt(document.getElementById('campo-personalizacao-max').value) || 15
    },
    descricao: document.getElementById('campo-produto-descricao').value.trim(),
    caracteristicas: document.getElementById('campo-produto-caracteristicas').value.split('\n').map(s=>s.trim()).filter(Boolean),
    pesoKg: parseFloat(document.getElementById('campo-produto-peso').value) || 0.1,
    estoque: parseInt(document.getElementById('campo-produto-estoque').value) || 0,
    shopeeUrl: document.getElementById('campo-produto-shopee').value.trim() || 'https://shopee.com.br/'
  };

  try {
    await ndjSalvarProduto(produto);
    ndjFecharModalProduto();
    ndjRenderizarTabelaProdutos();
    await ndjAtualizarMetricasAdmin();
    ndjMostrarAviso('Produto salvo com sucesso!');
  } catch (err) {
    ndjMostrarAviso('Não foi possível salvar o produto.', 'erro');
  } finally {
    if(botao) botao.disabled = false;
  }
}

/* Percorre as 5 posições: fotos já salvas (só reaproveita a URL) e fotos
   novas (faz upload pro Supabase Storage e pega a URL pública de volta). */
async function ndjEnviarImagensProduto(produtoId){
  const urls = [];
  for(let i=0; i<5; i++){
    const item = ndjImagensEmEdicao[i];
    if(!item) continue;
    if(item.url){
      urls.push(item.url);
    } else if(item.arquivo){
      const url = await ndjEnviarFotoProduto(produtoId, i, item.arquivo);
      urls.push(url);
    }
  }
  return urls;
}

/* ---------------- Cupons ---------------- */
function ndjRenderizarTabelaCupons(){
  const cupons = ndjListarCupons();
  const corpo = document.getElementById('corpo-tabela-cupons');
  corpo.innerHTML = cupons.map((c) => `
    <tr>
      <td><strong>${c.codigo}</strong></td>
      <td>${c.tipo === 'percentual' ? 'Percentual' : 'Valor fixo'}</td>
      <td>${c.tipo === 'percentual' ? c.valor + '%' : ndjFormatarMoeda(c.valor)}</td>
      <td><span class="pill-status ${c.ativo ? 'ativo' : 'inativo'}">${c.ativo ? 'Ativo' : 'Inativo'}</span></td>
      <td class="acoes-tabela">
        <button class="btn btn-contorno btn-pequeno" data-acao="alternar" data-id="${c.id}">${c.ativo ? 'Desativar' : 'Ativar'}</button>
        <button class="btn btn-perigo btn-pequeno" data-acao="excluir" data-id="${c.id}">Excluir</button>
      </td>
    </tr>
  `).join('') || '<tr><td colspan="5">Nenhum cupom cadastrado.</td></tr>';

  corpo.querySelectorAll('[data-acao=alternar]').forEach(b => b.addEventListener('click', async () => {
    const cupom = ndjListarCupons().find(c => String(c.id) === b.dataset.id);
    if(!cupom) return;
    try {
      await ndjAtualizarCupom(Object.assign({}, cupom, { ativo: !cupom.ativo }));
      ndjRenderizarTabelaCupons();
      await ndjAtualizarMetricasAdmin();
    } catch (err) {
      ndjMostrarAviso('Não foi possível atualizar o cupom.', 'erro');
    }
  }));
  corpo.querySelectorAll('[data-acao=excluir]').forEach(b => b.addEventListener('click', async () => {
    if(!confirm('Tem certeza que deseja excluir este cupom?')) return;
    try {
      await ndjExcluirCupom(b.dataset.id);
      ndjRenderizarTabelaCupons();
      await ndjAtualizarMetricasAdmin();
    } catch (err) {
      ndjMostrarAviso('Não foi possível excluir o cupom.', 'erro');
    }
  }));
}

async function ndjCriarCupomAdmin(e){
  e.preventDefault();
  const codigo = document.getElementById('campo-cupom-codigo').value.trim().toUpperCase();
  if(!codigo) return;
  if(ndjListarCupons().some(c => c.codigo === codigo)){
    ndjMostrarAviso('Já existe um cupom com esse código.', 'erro');
    return;
  }
  try {
    await ndjCriarCupom({
      codigo,
      tipo: document.getElementById('campo-cupom-tipo').value,
      valor: parseFloat(document.getElementById('campo-cupom-valor').value) || 0,
      validade: document.getElementById('campo-cupom-validade').value || ''
    });
    e.target.reset();
    ndjRenderizarTabelaCupons();
    await ndjAtualizarMetricasAdmin();
    ndjMostrarAviso('Cupom criado!');
  } catch (err) {
    ndjMostrarAviso('Não foi possível criar o cupom.', 'erro');
  }
}

/* ---------------- Pedidos ---------------- */
async function ndjRenderizarTabelaPedidos(){
  const pedidos = await ndjListarPedidos();
  const corpo = document.getElementById('corpo-tabela-pedidos');
  corpo.innerHTML = pedidos.map(p => `
    <tr>
      <td>
        <strong>${p.numero}</strong><br>
        <div class="edita-rastreio" style="display:flex; gap:4px; margin-top:4px">
          <input type="text" class="campo-rastreio-admin" data-numero="${p.numero}" value="${p.rastreio || ''}" placeholder="Código de rastreio" style="font-size:12px; padding:4px 6px; width:120px">
          <button type="button" class="btn-salvar-rastreio" data-numero="${p.numero}" style="font-size:12px; padding:4px 8px">Salvar</button>
        </div>
      </td>
      <td>${p.cliente.nome || '—'}<br><small>${p.cliente.email || ''}</small></td>
      <td>${new Date(p.dataCriacao).toLocaleDateString('pt-BR')}</td>
      <td>${ndjFormatarMoeda(p.total)}</td>
      <td>
        <select data-numero="${p.numero}" class="select-status-pedido">
          ${p.etapas.map(et => `<option value="${et.chave}" ${et.chave===p.status?'selected':''}>${et.rotulo}</option>`).join('')}
        </select>
      </td>
    </tr>
  `).join('') || '<tr><td colspan="5">Nenhum pedido ainda.</td></tr>';

  corpo.querySelectorAll('.select-status-pedido').forEach(sel => {
    sel.addEventListener('change', async () => {
      const pedidos = await ndjListarPedidos();
      const pedido = pedidos.find(p => p.numero === sel.dataset.numero);
      if(!pedido) return;
      pedido.status = sel.value;
      const etapa = pedido.etapas.find(e => e.chave === sel.value);
      if(etapa && !etapa.data) etapa.data = new Date().toISOString();
      try {
        await ndjAtualizarStatusPedido(pedido.numero, pedido.status, pedido.etapas);
        ndjMostrarAviso('Status do pedido atualizado.');
      } catch (err) {
        ndjMostrarAviso('Não foi possível atualizar o status.', 'erro');
      }
    });
  });

  corpo.querySelectorAll('.btn-salvar-rastreio').forEach(botao => {
    botao.addEventListener('click', async () => {
      const numero = botao.dataset.numero;
      const campo = corpo.querySelector(`.campo-rastreio-admin[data-numero="${numero}"]`);
      const rastreio = campo.value.trim();
      try {
        await ndjAtualizarRastreioPedido(numero, rastreio);
        ndjMostrarAviso(rastreio ? 'Código de rastreio salvo. O cliente já pode ver.' : 'Rastreio removido.');
      } catch (err) {
        ndjMostrarAviso('Não foi possível salvar o rastreio.', 'erro');
      }
    });
  });
}

/* ---------------- Categorias ---------------- */
function ndjRenderizarTabelaCategorias(){
  const categorias = ndjListarCategorias();
  const corpo = document.getElementById('corpo-tabela-categorias');
  corpo.innerHTML = categorias.map(c => `
    <tr>
      <td><img src="${c.icone || NDJ_ICONE_CATEGORIA_PADRAO}" alt="" style="width:32px;height:32px;object-fit:contain;"></td>
      <td>${c.nome}</td>
      <td>${c.desc || '—'}</td>
      <td>${ndjProdutosDaCategoria(c.id)}</td>
      <td class="acoes-tabela">
        <button class="btn btn-contorno btn-pequeno" data-acao="editar-cat" data-id="${c.id}">Editar</button>
        <button class="btn btn-perigo btn-pequeno" data-acao="excluir-cat" data-id="${c.id}">Excluir</button>
      </td>
    </tr>
  `).join('') || '<tr><td colspan="5">Nenhuma categoria cadastrada.</td></tr>';

  corpo.querySelectorAll('[data-acao=editar-cat]').forEach(b => b.addEventListener('click', () => ndjAbrirModalCategoria(b.dataset.id)));
  corpo.querySelectorAll('[data-acao=excluir-cat]').forEach(b => b.addEventListener('click', async () => {
    const emUso = ndjProdutosDaCategoria(b.dataset.id);
    if(emUso > 0){
      ndjMostrarAviso(`Não é possível excluir: ${emUso} produto(s) ainda usam essa categoria.`, 'erro');
      return;
    }
    if(confirm('Tem certeza que deseja excluir esta categoria?')){
      try {
        await ndjExcluirCategoria(b.dataset.id);
        ndjRenderizarTabelaCategorias();
      } catch (err) {
        ndjMostrarAviso('Não foi possível excluir a categoria.', 'erro');
      }
    }
  }));
}

function ndjAbrirModalCategoria(id){
  const categoria = id ? ndjBuscarCategoria(id) : null;
  document.getElementById('titulo-modal-categoria').textContent = categoria ? 'Editar categoria' : 'Nova categoria';
  document.getElementById('campo-categoria-id').value = categoria ? categoria.id : '';
  document.getElementById('campo-categoria-nome').value = categoria ? categoria.nome : '';
  document.getElementById('campo-categoria-desc').value = categoria ? (categoria.desc || '') : '';
  document.getElementById('campo-categoria-icone').value = categoria ? (categoria.icone || '') : '';
  document.getElementById('modal-categoria').classList.add('aberta');
}

async function ndjSalvarCategoriaAdmin(e){
  e.preventDefault();
  const idExistente = document.getElementById('campo-categoria-id').value;
  const nome = document.getElementById('campo-categoria-nome').value.trim();
  if(!nome){
    ndjMostrarAviso('Digite um nome para a categoria.', 'erro');
    return;
  }
  const icone = document.getElementById('campo-categoria-icone').value.trim() || NDJ_ICONE_CATEGORIA_PADRAO;

  const categoria = {
    id: idExistente || ndjGerarIdCategoria(nome),
    nome,
    desc: document.getElementById('campo-categoria-desc').value.trim(),
    icone
  };

  try {
    await ndjSalvarCategoria(categoria);
    document.getElementById('modal-categoria').classList.remove('aberta');
    ndjRenderizarTabelaCategorias();
    await ndjAtualizarMetricasAdmin();
    ndjMostrarAviso('Categoria salva com sucesso!');
  } catch (err) {
    ndjMostrarAviso('Não foi possível salvar a categoria.', 'erro');
  }
}
