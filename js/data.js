/* ==========================================================================
   NDJ 3D — Camada de dados (Supabase + carrinho local)

   Loja completa: produtos têm preço, estoque, peso (pro cálculo de frete),
   cores (com foto opcional por cor), personalização com nome e pedido
   mínimo. A compra acontece no site (carrinho → checkout → Mercado Pago),
   mas o produto também pode ser divulgado na Shopee/TikTok Shop e vendido
   direto pelo WhatsApp.

   Produtos e categorias são carregados UMA VEZ por página (em
   ndjCarregarDadosIniciais, chamado no início de main.js / produto.js /
   admin.js) e guardados aqui em ndjCache. Depois disso, ndjListarProdutos(),
   ndjBuscarProduto() etc. continuam funcionando de forma síncrona.

   Pedidos, cupons e avaliações mudam com frequência (um cliente pode criar
   um pedido a qualquer momento), então essas funções sempre consultam o
   Supabase na hora, em vez de usar o cache.
   ========================================================================== */

const NDJ_ICONE_CATEGORIA_PADRAO = 'assets/icones/generico.svg';

const NDJ_CHAVES = {
  carrinho: 'ndj_carrinho'
};

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

/* O banco usa snake_case (shopee_url, peso_kg...) e o resto do site usa
   camelCase (shopeeUrl, pesoKg...) — essas funções fazem a conversão. */
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
    pesoKg: p.peso_kg != null ? Number(p.peso_kg) : 0.3,
    shopeeUrl: p.shopee_url || '',
    tiktokUrl: p.tiktok_url || '',
    pedidoMinimo: p.pedido_minimo || { ativo: false, quantidade: 1 },
    promocao: p.promocao || { ativa: false, precoPromocional: 0 },
    pausado: !!p.pausado
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
    peso_kg: p.pesoKg,
    shopee_url: p.shopeeUrl,
    tiktok_url: p.tiktokUrl,
    pedido_minimo: p.pedidoMinimo,
    promocao: p.promocao,
    pausado: !!p.pausado
  };
}

/* Preço "de venda" de um produto agora: já considera a promoção ativa. */
function ndjPrecoAtualProduto(p){
  return (p.promocao && p.promocao.ativa && p.promocao.precoPromocional > 0)
    ? p.promocao.precoPromocional
    : p.preco;
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
  /* Apaga primeiro a pasta de fotos do produto no Storage (imagens + fotos
     de cores), pra não deixar arquivo órfão ocupando espaço no bucket. */
  await ndjExcluirPastaStorage(NDJ_BUCKET_IMAGENS_PRODUTOS, id);
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

/* ---------- Limpeza do Storage (evita foto órfã acumulando no bucket) ----------
   Sempre que uma foto de produto/cor é substituída ou removida no admin, ou
   quando um produto inteiro é excluído, essas funções apagam o(s) arquivo(s)
   correspondentes no Supabase Storage — e não só o registro no banco. */

/* Converte a URL pública devolvida pelo Supabase de volta no caminho
   interno do arquivo dentro do bucket (o que storage.remove() espera). */
function ndjCaminhoDoStorage(url, bucket){
  if(!url || typeof url !== 'string') return null;
  const marcador = `/storage/v1/object/public/${bucket}/`;
  const indice = url.indexOf(marcador);
  if(indice === -1) return null;
  try {
    return decodeURIComponent(url.slice(indice + marcador.length));
  } catch (e) {
    return url.slice(indice + marcador.length);
  }
}

/* Apaga uma lista de URLs públicas (de um bucket só) do Storage. Ignora
   silenciosamente URLs que não pertençam a esse bucket (ex: link externo). */
async function ndjRemoverArquivosStorage(bucket, urls){
  const caminhos = (urls || []).map(u => ndjCaminhoDoStorage(u, bucket)).filter(Boolean);
  if(!caminhos.length) return;
  const { error } = await ndjSupabase.storage.from(bucket).remove(caminhos);
  if(error) console.error(`Erro ao remover arquivo(s) do bucket "${bucket}":`, error);
}

/* Lista todos os arquivos de uma pasta do bucket, entrando nas subpastas
   (o Storage do Supabase não tem "excluir pasta inteira" pronto — uma
   entrada sem "id" é uma subpasta, então descemos nela recursivamente). */
async function ndjListarArquivosRecursivo(bucket, pasta){
  const { data, error } = await ndjSupabase.storage.from(bucket).list(pasta, { limit: 1000 });
  if(error){ console.error(`Erro ao listar "${pasta}" no bucket "${bucket}":`, error); return []; }
  let arquivos = [];
  for(const item of data || []){
    const caminho = pasta ? `${pasta}/${item.name}` : item.name;
    if(item.id === null){
      arquivos = arquivos.concat(await ndjListarArquivosRecursivo(bucket, caminho));
    } else {
      arquivos.push(caminho);
    }
  }
  return arquivos;
}

/* Apaga uma pasta inteira (e subpastas) do Storage — usada ao excluir um
   produto por completo, pra levar junto todas as fotos dele. */
async function ndjExcluirPastaStorage(bucket, pasta){
  const arquivos = await ndjListarArquivosRecursivo(bucket, pasta);
  if(!arquivos.length) return;
  const { error } = await ndjSupabase.storage.from(bucket).remove(arquivos);
  if(error) console.error(`Erro ao excluir pasta "${pasta}" do bucket "${bucket}":`, error);
}

/* ==========================================================================
   Banner de ponta a ponta da página inicial — imagens editáveis pelo
   admin (uma para celular, outra para computador) com link opcional.
   Guardado num bucket separado ("banners-site") e numa tabela de linha
   única (id fixo "home").
   ========================================================================== */
const NDJ_BUCKET_BANNERS = 'banners-site';

async function ndjEnviarImagemBanner(tipo, arquivo){
  const extensao = (arquivo.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
  const caminho = `${tipo}-${Date.now()}.${extensao}`;

  const { error } = await ndjSupabase.storage
    .from(NDJ_BUCKET_BANNERS)
    .upload(caminho, arquivo, { cacheControl: '3600', upsert: true });

  if(error){ console.error('Erro ao enviar imagem do banner:', error); throw error; }

  const { data } = ndjSupabase.storage.from(NDJ_BUCKET_BANNERS).getPublicUrl(caminho);
  return data.publicUrl;
}

async function ndjBuscarBannerIndex(){
  const { data, error } = await ndjSupabase.from('banner_index').select('*').eq('id', 'home').maybeSingle();
  if(error){ console.error('Erro ao buscar banner da home:', error); return null; }
  return data;
}

async function ndjSalvarBannerIndex(banner){
  const registro = {
    id: 'home',
    imagem_desktop: banner.imagemDesktop || null,
    imagem_mobile: banner.imagemMobile || null,
    link: banner.link || null,
    atualizado_em: new Date().toISOString()
  };
  const { error } = await ndjSupabase.from('banner_index').upsert(registro);
  if(error){ console.error('Erro ao salvar banner da home:', error); throw error; }
  return registro;
}

/* ==========================================================================
   Carrinho (guardado no navegador via localStorage — não precisa de login)
   Cada item: { id, produtoId, nome, imagem, cor, personalizado,
                textoPersonalizado, precoUnitario, quantidade }
   "id" identifica a combinação produto+cor+personalização, para poder
   somar quantidade quando o mesmo item é adicionado de novo.
   ========================================================================== */
function ndjLerCarrinho(){
  try {
    return JSON.parse(localStorage.getItem(NDJ_CHAVES.carrinho)) || [];
  } catch (e) {
    return [];
  }
}
function ndjSalvarCarrinho(itens){
  localStorage.setItem(NDJ_CHAVES.carrinho, JSON.stringify(itens));
  ndjAtualizarBadgeCarrinho();
}
function ndjIdItemCarrinho(produtoId, cor, textoPersonalizado){
  return [produtoId, cor || '', textoPersonalizado || ''].join('::');
}
function ndjAdicionarAoCarrinho(item){
  const itens = ndjLerCarrinho();
  const idItem = ndjIdItemCarrinho(item.produtoId, item.cor, item.textoPersonalizado);
  const existente = itens.find(i => i.id === idItem);
  if(existente){
    existente.quantidade += item.quantidade;
  } else {
    itens.push(Object.assign({ id: idItem }, item));
  }
  ndjSalvarCarrinho(itens);
  return itens;
}
function ndjAtualizarQuantidadeCarrinho(idItem, quantidade){
  let itens = ndjLerCarrinho();
  if(quantidade <= 0){
    itens = itens.filter(i => i.id !== idItem);
  } else {
    const item = itens.find(i => i.id === idItem);
    if(item) item.quantidade = quantidade;
  }
  ndjSalvarCarrinho(itens);
  return itens;
}
function ndjRemoverDoCarrinho(idItem){
  const itens = ndjLerCarrinho().filter(i => i.id !== idItem);
  ndjSalvarCarrinho(itens);
  return itens;
}
function ndjEsvaziarCarrinho(){
  ndjSalvarCarrinho([]);
}
function ndjTotalItensCarrinho(){
  return ndjLerCarrinho().reduce((soma, i) => soma + i.quantidade, 0);
}
function ndjSubtotalCarrinho(itens){
  itens = itens || ndjLerCarrinho();
  return itens.reduce((soma, i) => soma + i.precoUnitario * i.quantidade, 0);
}
function ndjPesoTotalCarrinho(itens){
  itens = itens || ndjLerCarrinho();
  return itens.reduce((soma, i) => {
    const produto = ndjBuscarProduto(i.produtoId);
    const peso = produto ? produto.pesoKg : 0.3;
    return soma + peso * i.quantidade;
  }, 0);
}
function ndjAtualizarBadgeCarrinho(){
  const badge = document.querySelector('.badge-carrinho');
  if(!badge) return;
  badge.textContent = ndjTotalItensCarrinho();
}

/* ==========================================================================
   Frete — cotação real via Melhor Envio (Correios e transportadoras
   parceiras), com o CEP de origem da loja fixado na Edge Function
   "calcular-frete-me" (veja supabase/functions/README.md pra configurar
   o token de acesso).

   ndjCalcularFrete(cepDestino, itens) é assíncrona: itens é um array de
   { nome, pesoKg, preco, quantidade }. Retorna:
     - null                  → CEP de destino inválido (não chega a
                                consultar a API)
     - { erro: 'mensagem' }  → a consulta falhou (API fora do ar, token
                                inválido etc.)
     - [ {id, nome, prazoDias, valor}, ... ]  → opções de frete reais,
                                já ordenadas da mais barata pra mais cara
   ========================================================================== */
async function ndjCalcularFrete(cepDestino, itens){
  const digitos = (cepDestino || '').replace(/\D/g, '');
  if(digitos.length !== 8) return null;

  const { data, error } = await ndjSupabase.functions.invoke('calcular-frete-me', {
    body: { cepDestino: digitos, itens }
  });

  if(error){
    console.error('Erro ao chamar a função de frete:', error);
    return { erro: 'Não foi possível calcular o frete agora. Tente novamente em instantes.' };
  }
  if(data && data.error){
    console.error('Erro retornado pela função de frete:', data.error);
    return { erro: 'Não foi possível calcular o frete agora. Tente novamente em instantes.' };
  }

  return (data && data.opcoes) || [];
}

/* ==========================================================================
   Cupons de desconto
   ========================================================================== */
async function ndjListarCuponsAdmin(){
  const { data, error } = await ndjSupabase.from('cupons').select('*').order('criado_em', { ascending: false });
  if(error){ console.error('Erro ao listar cupons:', error); return []; }
  return data || [];
}
async function ndjBuscarCupom(codigo){
  const { data, error } = await ndjSupabase.from('cupons').select('*').eq('codigo', (codigo || '').toUpperCase()).maybeSingle();
  if(error){ console.error('Erro ao buscar cupom:', error); return null; }
  return data || null;
}
async function ndjCriarCupom(cupom){
  const registro = {
    id: 'c' + Date.now().toString().slice(-8),
    codigo: cupom.codigo.toUpperCase(),
    tipo: cupom.tipo,
    valor: cupom.valor,
    valor_minimo: cupom.valorMinimo || 0,
    primeira_compra_apenas: !!cupom.primeiraCompraApenas,
    validade: cupom.validade || null,
    ativo: true
  };
  const { error } = await ndjSupabase.from('cupons').insert(registro);
  if(error){ console.error('Erro ao criar cupom:', error); throw error; }
  return registro;
}
async function ndjAtualizarCupom(cupom){
  const { error } = await ndjSupabase.from('cupons').update({ ativo: cupom.ativo }).eq('id', cupom.id);
  if(error){ console.error('Erro ao atualizar cupom:', error); throw error; }
}
async function ndjExcluirCupom(id){
  const { error } = await ndjSupabase.from('cupons').delete().eq('id', id);
  if(error){ console.error('Erro ao excluir cupom:', error); throw error; }
}
/* Valida se um cupom pode ser usado num pedido de um determinado subtotal:
   precisa estar ativo, dentro da validade e o subtotal precisa bater o
   valor mínimo exigido pelo cupom (quando houver um). Não checa aqui a
   regra de "primeira compra" — essa depende do CPF do cliente, que só é
   coletado no checkout (veja ndjClienteJaComprou). */
function ndjCupomValido(cupom, subtotal){
  if(!cupom || !cupom.ativo) return false;
  if(cupom.validade && new Date(cupom.validade + 'T23:59:59') < new Date()) return false;
  if(cupom.valor_minimo && subtotal != null && subtotal < cupom.valor_minimo) return false;
  return true;
}
function ndjCalcularDescontoCupom(cupom, subtotal){
  if(!ndjCupomValido(cupom, subtotal)) return 0;
  if(cupom.tipo === 'percentual') return Math.round(subtotal * (cupom.valor / 100) * 100) / 100;
  return Math.min(cupom.valor, subtotal);
}

/* ---------- CPF (validação + checagem de "primeira compra") ---------- */
/* Validação padrão de CPF (dígitos verificadores), não só o tamanho. */
function ndjCpfValido(cpf){
  const digitos = (cpf || '').replace(/\D/g, '');
  if(digitos.length !== 11) return false;
  if(/^(\d)\1{10}$/.test(digitos)) return false; // todos os dígitos iguais

  const calcularDigito = (tamanho) => {
    let soma = 0;
    for(let i = 0; i < tamanho; i++){
      soma += parseInt(digitos[i]) * (tamanho + 1 - i);
    }
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };

  return calcularDigito(9) === parseInt(digitos[9]) && calcularDigito(10) === parseInt(digitos[10]);
}
function ndjFormatarCpf(cpf){
  const d = (cpf || '').replace(/\D/g, '');
  if(d.length !== 11) return cpf || '';
  return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6,9)}-${d.slice(9,11)}`;
}
/* Verifica se já existe algum pedido (não cancelado) feito com esse CPF —
   usado pelos cupons marcados como "válido só na primeira compra". */
async function ndjClienteJaComprou(cpf){
  const digitos = (cpf || '').replace(/\D/g, '');
  if(digitos.length !== 11) return false;

  const { data, error } = await ndjSupabase
    .from('pedidos')
    .select('numero')
    .filter('cliente->>cpf', 'eq', digitos)
    .neq('status', 'cancelado')
    .limit(1);

  if(error){ console.error('Erro ao checar pedidos anteriores por CPF:', error); return false; }
  return !!(data && data.length);
}


/* ==========================================================================
   Pedidos
   ========================================================================== */
const NDJ_ETAPAS_PEDIDO_PADRAO = [
  { chave: 'aguardando_pagamento', rotulo: 'Aguardando pagamento', data: null },
  { chave: 'pago', rotulo: 'Pagamento confirmado', data: null },
  { chave: 'preparando', rotulo: 'Preparando pedido', data: null },
  { chave: 'enviado', rotulo: 'Enviado', data: null },
  { chave: 'entregue', rotulo: 'Entregue', data: null }
];

function ndjGerarNumeroPedido(){
  return 'NDJ' + Date.now().toString().slice(-9);
}

async function ndjCriarPedido(dados){
  const numero = ndjGerarNumeroPedido();
  const etapas = JSON.parse(JSON.stringify(NDJ_ETAPAS_PEDIDO_PADRAO));
  etapas[0].data = new Date().toISOString();

  const registro = {
    numero,
    cliente: dados.cliente,
    itens: dados.itens,
    subtotal: dados.subtotal,
    desconto: dados.desconto || 0,
    cupom_codigo: dados.cupomCodigo || null,
    frete: dados.frete || 0,
    frete_nome: dados.freteNome || null,
    total: dados.total,
    combinar_local: !!dados.combinarLocal,
    status: 'aguardando_pagamento',
    etapas,
    rastreio: null,
    avaliado: false
  };

  const { error } = await ndjSupabase.from('pedidos').insert(registro);
  if(error){ console.error('Erro ao criar pedido:', error); throw error; }
  return registro;
}

async function ndjBuscarPedido(numero){
  const { data, error } = await ndjSupabase.from('pedidos').select('*').eq('numero', (numero || '').trim().toUpperCase()).maybeSingle();
  if(error){ console.error('Erro ao buscar pedido:', error); return null; }
  return data || null;
}

async function ndjListarPedidos(){
  const { data, error } = await ndjSupabase.from('pedidos').select('*').order('criado_em', { ascending: false });
  if(error){ console.error('Erro ao listar pedidos:', error); return []; }
  return data || [];
}

async function ndjAtualizarStatusPedido(numero, status, etapas){
  const { error } = await ndjSupabase.from('pedidos').update({ status, etapas }).eq('numero', numero);
  if(error){ console.error('Erro ao atualizar status do pedido:', error); throw error; }
}

async function ndjAtualizarRastreioPedido(numero, rastreio){
  const { error } = await ndjSupabase.from('pedidos').update({ rastreio: rastreio || null }).eq('numero', numero);
  if(error){ console.error('Erro ao salvar rastreio:', error); throw error; }
}

async function ndjMarcarPedidoAvaliado(numero){
  const { error } = await ndjSupabase.from('pedidos').update({ avaliado: true }).eq('numero', numero);
  if(error){ console.error('Erro ao marcar pedido como avaliado:', error); throw error; }
}

function ndjPedidoPodeAvaliar(pedido){
  return !!pedido && pedido.status === 'entregue' && !pedido.avaliado;
}

/* ==========================================================================
   Avaliações de produtos
   ========================================================================== */
async function ndjAvaliacoesDoProduto(produtoId){
  const { data, error } = await ndjSupabase.from('avaliacoes').select('*').eq('produto_id', produtoId).order('criado_em', { ascending: false });
  if(error){ console.error('Erro ao carregar avaliações:', error); return []; }
  return data || [];
}
function ndjResumoAvaliacoes(avaliacoes){
  if(!avaliacoes || !avaliacoes.length) return { media: 0, total: 0 };
  const soma = avaliacoes.reduce((s, a) => s + a.nota, 0);
  return { media: Math.round((soma / avaliacoes.length) * 10) / 10, total: avaliacoes.length };
}
async function ndjCriarAvaliacao(avaliacao){
  const registro = {
    id: 'a' + Date.now().toString().slice(-9) + Math.floor(Math.random()*90+10),
    pedido_numero: avaliacao.pedidoNumero || null,
    produto_id: avaliacao.produtoId,
    nome_cliente: avaliacao.nomeCliente || 'Cliente NDJ 3D',
    nota: avaliacao.nota,
    comentario: avaliacao.comentario || ''
  };
  const { error } = await ndjSupabase.from('avaliacoes').insert(registro);
  if(error){ console.error('Erro ao enviar avaliação:', error); throw error; }
  return registro;
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
