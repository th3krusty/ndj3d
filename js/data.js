/* ==========================================================================
   NDJ 3D — Camada de dados (Supabase)

   Antes, todas as funções abaixo liam e gravavam no localStorage do
   navegador (por isso um pedido feito em um computador não aparecia no
   painel admin de outro). Agora elas conversam com o Supabase.

   Para não precisar reescrever todo o site com "await" em todo lugar,
   produtos, categorias e cupons são carregados UMA VEZ por página (em
   ndjCarregarDadosIniciais, chamado no início de cada arquivo main.js /
   produto.js / carrinho.js / checkout.js / admin.js) e guardados aqui em
   ndjCache. Depois disso, ndjListarProdutos(), ndjBuscarProduto() etc.
   continuam funcionando de forma síncrona, exatamente como antes.

   Já pedidos e avaliações mudam com frequência e podem ser criados por
   qualquer visitante, então essas funções são assíncronas (retornam uma
   Promise) e precisam de "await" em quem as chama.
   ========================================================================== */

const NDJ_CHAVES = {
  carrinho: 'ndj3d_carrinho'
};

const NDJ_ICONE_CATEGORIA_PADRAO = 'assets/icones/generico.svg';

const ndjCache = {
  produtos: [],
  categorias: [],
  cupons: [],
  carregado: false
};

/* ---------- Carregamento inicial (produtos + categorias + cupons) ----------
   Várias páginas carregam js/main.js + um script próprio (produto.js,
   carrinho.js etc.), e os dois chamam esta função no início. Para não
   buscar tudo duas vezes, a primeira chamada guarda sua Promise aqui e as
   chamadas seguintes (na mesma página) reaproveitam o mesmo resultado. */
let _ndjPromessaCarregamento = null;
function ndjCarregarDadosIniciais(){
  if(!_ndjPromessaCarregamento){
    _ndjPromessaCarregamento = ndjCarregarDadosIniciaisAgora();
  }
  return _ndjPromessaCarregamento;
}
async function ndjCarregarDadosIniciaisAgora(){
  const [produtosRes, categoriasRes, cuponsRes] = await Promise.all([
    ndjSupabase.from('produtos').select('*').order('criado_em', { ascending: true }),
    ndjSupabase.from('categorias').select('*').order('ordem', { ascending: true }),
    ndjSupabase.from('cupons').select('*')
  ]);

  if(produtosRes.error) console.error('Erro ao carregar produtos:', produtosRes.error);
  if(categoriasRes.error) console.error('Erro ao carregar categorias:', categoriasRes.error);
  if(cuponsRes.error) console.error('Erro ao carregar cupons:', cuponsRes.error);

  ndjCache.produtos = (produtosRes.data || []).map(ndjMapearProdutoDoBanco);
  ndjCache.categorias = categoriasRes.data || [];
  ndjCache.cupons = (cuponsRes.data || []).map(ndjMapearCupomDoBanco);
  ndjCache.carregado = true;

  ndjAtualizarBadgeCarrinho();
}

/* O banco usa snake_case (peso_kg, shopee_url) e o resto do site usa
   camelCase (pesoKg, shopeeUrl) — essas funções fazem a conversão. */
function ndjMapearProdutoDoBanco(p){
  return {
    id: p.id,
    nome: p.nome,
    categoria: p.categoria,
    preco: Number(p.preco),
    imagens: p.imagens || [],
    cores: p.cores || [],
    personalizacao: p.personalizacao || { disponivel: false, precoExtra: 0, rotulo: '', maxCaracteres: 0 },
    descricao: p.descricao || '',
    caracteristicas: p.caracteristicas || [],
    pesoKg: Number(p.peso_kg),
    estoque: p.estoque,
    shopeeUrl: p.shopee_url
  };
}
function ndjMapearProdutoParaBanco(p){
  return {
    id: p.id,
    nome: p.nome,
    categoria: p.categoria,
    preco: p.preco,
    imagens: p.imagens,
    cores: p.cores,
    personalizacao: p.personalizacao,
    descricao: p.descricao,
    caracteristicas: p.caracteristicas,
    peso_kg: p.pesoKg,
    estoque: p.estoque,
    shopee_url: p.shopeeUrl
  };
}
function ndjMapearCupomDoBanco(c){
  return { id: c.id, codigo: c.codigo, tipo: c.tipo, valor: Number(c.valor), ativo: c.ativo, validade: c.validade || '' };
}
function ndjMapearPedidoDoBanco(p){
  return {
    numero: p.numero,
    rastreio: p.rastreio,
    status: p.status,
    dataCriacao: p.data_criacao,
    etapas: p.etapas,
    cliente: p.cliente,
    itens: p.itens,
    metodoPagamento: p.metodo_pagamento,
    frete: p.frete,
    cupom: p.cupom,
    subtotal: Number(p.subtotal),
    desconto: Number(p.desconto),
    total: Number(p.total),
    avaliado: p.avaliado
  };
}

/* ---------- Categorias ---------- */
function ndjListarCategorias(){
  return ndjCache.categorias;
}
function ndjBuscarCategoria(id){
  return ndjCache.categorias.find(c => c.id === id);
}
async function ndjSalvarCategoria(categoria){
  const { error } = await ndjSupabase.from('categorias').upsert(categoria);
  if(error){ console.error('Erro ao salvar categoria:', error); throw error; }
  const i = ndjCache.categorias.findIndex(c => c.id === categoria.id);
  if(i >= 0){ ndjCache.categorias[i] = categoria; } else { ndjCache.categorias.push(categoria); }
}
async function ndjExcluirCategoria(id){
  const { error } = await ndjSupabase.from('categorias').delete().eq('id', id);
  if(error){ console.error('Erro ao excluir categoria:', error); throw error; }
  ndjCache.categorias = ndjCache.categorias.filter(c => c.id !== id);
}
function ndjGerarIdCategoria(nome){
  const base = (nome || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
  let id = base || ('categoria-' + Date.now().toString().slice(-6));
  const existentes = ndjListarCategorias().map(c => c.id);
  let sufixo = 2;
  let candidato = id;
  while(existentes.includes(candidato)){
    candidato = id + '-' + sufixo;
    sufixo++;
  }
  return candidato;
}
function ndjProdutosDaCategoria(id){
  return ndjListarProdutos().filter(p => p.categoria === id).length;
}

/* ---------- Produtos ---------- */
function ndjListarProdutos(){
  return ndjCache.produtos;
}
function ndjBuscarProduto(id){
  return ndjCache.produtos.find(p => p.id === id);
}
async function ndjSalvarProduto(produto){
  const { error } = await ndjSupabase.from('produtos').upsert(ndjMapearProdutoParaBanco(produto));
  if(error){ console.error('Erro ao salvar produto:', error); throw error; }
  const i = ndjCache.produtos.findIndex(p => p.id === produto.id);
  if(i >= 0){ ndjCache.produtos[i] = produto; } else { ndjCache.produtos.push(produto); }
}
async function ndjExcluirProduto(id){
  const { error } = await ndjSupabase.from('produtos').delete().eq('id', id);
  if(error){ console.error('Erro ao excluir produto:', error); throw error; }
  ndjCache.produtos = ndjCache.produtos.filter(p => p.id !== id);
}
function ndjGerarIdProduto(){
  return 'p' + Date.now().toString().slice(-8);
}

/* ---------- Fotos dos produtos (Supabase Storage) ----------
   As fotos escolhidas no painel admin (direto do dispositivo, sem link)
   são enviadas para o bucket "produtos-imagens" e a URL pública devolvida
   é o que fica salvo em produtos.imagens (veja supabase/schema.sql para
   criar o bucket e as permissões). */
const NDJ_BUCKET_IMAGENS_PRODUTOS = 'produtos-imagens';

async function ndjEnviarFotoProduto(produtoId, indice, arquivo){
  const extensao = (arquivo.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
  const caminho = `${produtoId}/${indice}-${Date.now()}.${extensao}`;

  const { error } = await ndjSupabase.storage
    .from(NDJ_BUCKET_IMAGENS_PRODUTOS)
    .upload(caminho, arquivo, { cacheControl: '3600', upsert: true });

  if(error){ console.error('Erro ao enviar foto do produto:', error); throw error; }

  const { data } = ndjSupabase.storage.from(NDJ_BUCKET_IMAGENS_PRODUTOS).getPublicUrl(caminho);
  return data.publicUrl;
}

/* ---------- Cupons ---------- */
function ndjListarCupons(){
  return ndjCache.cupons;
}
function ndjBuscarCupom(codigo){
  return ndjCache.cupons.find(c => c.codigo.toUpperCase() === (codigo || '').toUpperCase());
}
async function ndjCriarCupom(cupom){
  const { data, error } = await ndjSupabase.from('cupons').insert({
    codigo: cupom.codigo, tipo: cupom.tipo, valor: cupom.valor, ativo: true, validade: cupom.validade || ''
  }).select().single();
  if(error){ console.error('Erro ao criar cupom:', error); throw error; }
  ndjCache.cupons.push(ndjMapearCupomDoBanco(data));
}
async function ndjAtualizarCupom(cupom){
  const { error } = await ndjSupabase.from('cupons')
    .update({ ativo: cupom.ativo, tipo: cupom.tipo, valor: cupom.valor, validade: cupom.validade })
    .eq('id', cupom.id);
  if(error){ console.error('Erro ao atualizar cupom:', error); throw error; }
  const i = ndjCache.cupons.findIndex(c => c.id === cupom.id);
  if(i >= 0) ndjCache.cupons[i] = cupom;
}
async function ndjExcluirCupom(id){
  const { error } = await ndjSupabase.from('cupons').delete().eq('id', id);
  if(error){ console.error('Erro ao excluir cupom:', error); throw error; }
  ndjCache.cupons = ndjCache.cupons.filter(c => c.id !== id);
}

/* ---------- Carrinho (continua local — é só o "estado" do navegador de
   quem está comprando, faz sentido ficar no localStorage mesmo) ---------- */
function ndjLerCarrinho(){
  return JSON.parse(localStorage.getItem(NDJ_CHAVES.carrinho) || '[]');
}
function ndjSalvarCarrinho(itens){
  localStorage.setItem(NDJ_CHAVES.carrinho, JSON.stringify(itens));
  ndjAtualizarBadgeCarrinho();
}
function ndjAdicionarAoCarrinho(item){
  const itens = ndjLerCarrinho();
  itens.push(item);
  ndjSalvarCarrinho(itens);
}
function ndjRemoverDoCarrinho(indice){
  const itens = ndjLerCarrinho();
  itens.splice(indice, 1);
  ndjSalvarCarrinho(itens);
}
function ndjTotalItensCarrinho(){
  return ndjLerCarrinho().reduce((soma, i) => soma + i.quantidade, 0);
}
function ndjAtualizarBadgeCarrinho(){
  document.querySelectorAll('.badge-carrinho').forEach(el => {
    el.textContent = ndjTotalItensCarrinho();
  });
}

/* ---------- Pedidos ---------- */
async function ndjBuscarPedido(numero){
  const { data, error } = await ndjSupabase
    .from('pedidos').select('*')
    .eq('numero', (numero || '').trim().toUpperCase())
    .maybeSingle();
  if(error){ console.error('Erro ao buscar pedido:', error); return null; }
  return data ? ndjMapearPedidoDoBanco(data) : null;
}
async function ndjListarPedidos(){
  const { data, error } = await ndjSupabase.from('pedidos').select('*').order('data_criacao', { ascending: false });
  if(error){ console.error('Erro ao listar pedidos:', error); return []; }
  return (data || []).map(ndjMapearPedidoDoBanco);
}
async function ndjCriarPedido(dados){
  const numero = 'NDJ' + (100000 + Math.floor(Math.random() * 899999));
  const rastreio = 'BR' + Math.floor(100000000 + Math.random() * 899999999) + 'X';
  const agora = new Date().toISOString();
  const pedido = Object.assign({
    numero, rastreio,
    status: 'pago',
    dataCriacao: agora,
    etapas: [
      { chave: 'pago', rotulo: 'Pagamento aprovado', data: agora },
      { chave: 'preparando', rotulo: 'Em produção / separação', data: null },
      { chave: 'enviado', rotulo: 'Pedido enviado', data: null },
      { chave: 'entregue', rotulo: 'Entregue', data: null }
    ],
    avaliado: false
  }, dados);

  const { error } = await ndjSupabase.from('pedidos').insert({
    numero: pedido.numero,
    rastreio: pedido.rastreio,
    status: pedido.status,
    data_criacao: pedido.dataCriacao,
    etapas: pedido.etapas,
    cliente: pedido.cliente,
    itens: pedido.itens,
    metodo_pagamento: pedido.metodoPagamento,
    frete: pedido.frete,
    cupom: pedido.cupom,
    subtotal: pedido.subtotal,
    desconto: pedido.desconto,
    total: pedido.total,
    avaliado: false
  });
  if(error){ console.error('Erro ao criar pedido:', error); throw error; }
  return pedido;
}
async function ndjAtualizarStatusPedido(numero, statusChave, etapas){
  const { error } = await ndjSupabase.from('pedidos').update({ status: statusChave, etapas }).eq('numero', numero);
  if(error){ console.error('Erro ao atualizar status do pedido:', error); throw error; }
}
async function ndjMarcarPedidoAvaliado(numero){
  const { error } = await ndjSupabase.from('pedidos').update({ avaliado: true }).eq('numero', numero);
  if(error){ console.error('Erro ao marcar pedido como avaliado:', error); throw error; }
}

/* ---------- Avaliações de produto (pós-entrega) ----------
   Só é possível avaliar um pedido depois que o admin marca o status como
   "entregue". Cada avaliação fica ligada ao produto E ao número do pedido,
   pra evitar avaliação duplicada do mesmo pedido. */
async function ndjAvaliacoesDoProduto(produtoId){
  const { data, error } = await ndjSupabase
    .from('avaliacoes').select('*')
    .eq('produto_id', produtoId)
    .order('data', { ascending: false });
  if(error){ console.error('Erro ao carregar avaliações:', error); return []; }
  return (data || []).map(a => ({
    produtoId: a.produto_id,
    pedidoNumero: a.pedido_numero,
    nomeCliente: a.nome_cliente,
    nota: a.nota,
    comentario: a.comentario,
    data: a.data
  }));
}
async function ndjResumoAvaliacoes(produtoId){
  const lista = await ndjAvaliacoesDoProduto(produtoId);
  if(!lista.length) return { media: 0, total: 0 };
  const soma = lista.reduce((s, a) => s + a.nota, 0);
  return { media: soma / lista.length, total: lista.length };
}
async function ndjCriarAvaliacao(dados){
  const { error } = await ndjSupabase.from('avaliacoes').insert({
    produto_id: dados.produtoId,
    pedido_numero: dados.pedidoNumero,
    nome_cliente: dados.nomeCliente,
    nota: dados.nota,
    comentario: dados.comentario
  });
  if(error){ console.error('Erro ao criar avaliação:', error); throw error; }
}
function ndjPedidoPodeAvaliar(pedido){
  return !!(pedido && pedido.status === 'entregue' && !pedido.avaliado);
}

/* ---------- Frete (cálculo simulado por região do CEP) ---------- */
function ndjCalcularFrete(cep, pesoKg){
  const limpo = (cep || '').replace(/\D/g, '');
  if(limpo.length !== 8) return null;
  const prefixo = parseInt(limpo.substring(0,2), 10);
  let regiao = 'Outras regiões', basePac = 22, baseSedex = 34, prazoPac = 9, prazoSedex = 4;
  if(prefixo >= 1 && prefixo <= 19){ regiao='São Paulo (capital e região)'; basePac=14; baseSedex=22; prazoPac=4; prazoSedex=2; }
  else if(prefixo >= 20 && prefixo <= 28){ regiao='Rio de Janeiro/ES'; basePac=17; baseSedex=26; prazoPac=5; prazoSedex=2; }
  else if(prefixo >= 80 && prefixo <= 87){ regiao='Paraná'; basePac=13; baseSedex=20; prazoPac=3; prazoSedex=2; }
  else if(prefixo >= 88 && prefixo <= 99){ regiao='Sul (SC/RS)'; basePac=16; baseSedex=25; prazoPac=5; prazoSedex=2; }
  else if(prefixo >= 29 && prefixo <= 79){ regiao='Sudeste/Centro-Oeste'; basePac=19; baseSedex=29; prazoPac=6; prazoSedex=3; }

  const adicionalPeso = Math.max(0, (pesoKg || 0.1) - 0.3) * 18;
  const pac = +(basePac + adicionalPeso).toFixed(2);
  const sedex = +(baseSedex + adicionalPeso).toFixed(2);
  return {
    regiao,
    opcoes: [
      { nome: 'PAC (econômico)', preco: pac, prazoDias: prazoPac },
      { nome: 'SEDEX (expresso)', preco: sedex, prazoDias: prazoSedex }
    ]
  };
}

/* ---------- Admin (agora via Supabase Auth, em vez de senha no localStorage) ---------- */
async function ndjAdminLogado(){
  const { data } = await ndjSupabase.auth.getSession();
  return !!data.session;
}
async function ndjAdminEntrar(senha){
  const { error } = await ndjSupabase.auth.signInWithPassword({ email: NDJ_ADMIN_EMAIL, password: senha });
  return !error;
}
async function ndjAdminSair(){
  await ndjSupabase.auth.signOut();
}
async function ndjAlterarSenhaAdmin(novaSenha){
  const { error } = await ndjSupabase.auth.updateUser({ password: novaSenha });
  if(error){ console.error('Erro ao alterar senha:', error); throw error; }
}

/* ---------- Totais do carrinho (usados no carrinho e no checkout) ---------- */
function ndjSubtotalCarrinho(){
  return ndjLerCarrinho().reduce((soma, i) => soma + i.precoUnitario * i.quantidade, 0);
}
function ndjCalcularDescontoCupom(subtotal, cupom){
  if(!cupom) return 0;
  if(cupom.tipo === 'percentual'){
    return +(subtotal * (cupom.valor/100)).toFixed(2);
  }
  return Math.min(subtotal, cupom.valor);
}

/* ---------- Utilidades ---------- */
function ndjFormatarMoeda(v){
  return v.toLocaleString('pt-BR', { style:'currency', currency:'BRL' });
}
function ndjParametroUrl(nome){
  return new URLSearchParams(window.location.search).get(nome);
}
function ndjEscaparHtml(texto){
  const div = document.createElement('div');
  div.textContent = texto || '';
  return div.innerHTML;
}
