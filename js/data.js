/* ==========================================================================
   NDJ 3D — Camada de dados (Supabase)

   O site agora é um CATÁLOGO: a venda acontece na Shopee e no TikTok Shop
   (ou combinada direto pelo WhatsApp), então esta camada só cuida de
   produtos e categorias — nada de carrinho, checkout, cupons ou pedidos.

   Produtos e categorias são carregados UMA VEZ por página (em
   ndjCarregarDadosIniciais, chamado no início de main.js / produto.js /
   admin.js) e guardados aqui em ndjCache. Depois disso, ndjListarProdutos(),
   ndjBuscarProduto() etc. continuam funcionando de forma síncrona.
   ========================================================================== */

const NDJ_ICONE_CATEGORIA_PADRAO = 'assets/icones/generico.svg';

const ndjCache = {
  produtos: [],
  categorias: [],
  carregado: false
};

/* ---------- Carregamento inicial (produtos + categorias) ----------
   Várias páginas carregam js/main.js + um script próprio (produto.js,
   admin.js etc.), e os dois chamam esta função no início. Para não
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
  const [produtosRes, categoriasRes] = await Promise.all([
    ndjSupabase.from('produtos').select('*').order('criado_em', { ascending: true }),
    ndjSupabase.from('categorias').select('*').order('ordem', { ascending: true })
  ]);

  if(produtosRes.error) console.error('Erro ao carregar produtos:', produtosRes.error);
  if(categoriasRes.error) console.error('Erro ao carregar categorias:', categoriasRes.error);

  ndjCache.produtos = (produtosRes.data || []).map(ndjMapearProdutoDoBanco);
  ndjCache.categorias = categoriasRes.data || [];
  ndjCache.carregado = true;
}

/* O banco usa snake_case (shopee_url, tiktok_url) e o resto do site usa
   camelCase (shopeeUrl, tiktokUrl) — essas funções fazem a conversão. */
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
    estoque: p.estoque,
    shopeeUrl: p.shopee_url || '',
    tiktokUrl: p.tiktok_url || '',
    pedidoMinimo: p.pedido_minimo || { ativo: false, quantidade: 1 }
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
    estoque: p.estoque,
    shopee_url: p.shopeeUrl,
    tiktok_url: p.tiktokUrl,
    pedido_minimo: p.pedidoMinimo
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

/* Foto de referência de uma cor específica (ex: "Dourado" → foto real da
   peça nessa cor), enviada para o mesmo bucket de fotos dos produtos. */
async function ndjEnviarFotoCor(produtoId, indiceCor, arquivo){
  const extensao = (arquivo.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
  const caminho = `${produtoId}/cores/${indiceCor}-${Date.now()}.${extensao}`;

  const { error } = await ndjSupabase.storage
    .from(NDJ_BUCKET_IMAGENS_PRODUTOS)
    .upload(caminho, arquivo, { cacheControl: '3600', upsert: true });

  if(error){ console.error('Erro ao enviar foto da cor:', error); throw error; }

  const { data } = ndjSupabase.storage.from(NDJ_BUCKET_IMAGENS_PRODUTOS).getPublicUrl(caminho);
  return data.publicUrl;
}

/* ---------- Admin (via Supabase Auth) ---------- */
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
