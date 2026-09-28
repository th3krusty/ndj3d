/* ==========================================================================
   NDJ 3D — Checkout
   Passo a passo: dados do cliente → frete (ou combinar local) → cria o
   pedido no Supabase → chama a Edge Function "criar-preferencia-mp", que
   cria a cobrança no Mercado Pago e devolve o link de pagamento. O
   cliente é redirecionado para lá e, ao concluir, volta para
   pedido.html?pedido=NUMERO. A confirmação final do pagamento chega pela
   Function "webhook-mp" — ver supabase/functions e o README.
   ========================================================================== */

let ndjOpcaoFreteEscolhida = null;
let ndjFreteCalculado = null;

document.addEventListener('DOMContentLoaded', async () => {
  await ndjCarregarDadosIniciais();

  const itens = ndjLerCarrinho();
  if(!itens.length){
    window.location.href = 'carrinho.html';
    return;
  }

  try {
    ndjCupomCheckout = JSON.parse(sessionStorage.getItem('ndj_cupom_aplicado') || 'null');
  } catch (e) {
    ndjCupomCheckout = null;
  }

  ndjRenderizarResumoCheckout();

  document.getElementById('btn-calcular-frete-checkout').addEventListener('click', ndjCalcularFreteCheckout);
  document.getElementById('check-combinar-local').addEventListener('change', ndjAlternarCombinarLocal);
  document.getElementById('texto-regiao-local').textContent = NDJ_CONFIG.regiaoLocal;
  document.getElementById('form-checkout').addEventListener('submit', ndjConfirmarPedido);

  const campoCpf = document.getElementById('campo-cpf-cliente');
  campoCpf.addEventListener('input', () => {
    campoCpf.value = ndjFormatarCpf(campoCpf.value);
  });
  campoCpf.addEventListener('blur', () => ndjChecarCupomPrimeiraCompra());
});

let ndjCupomCheckout = null;

/* Se o cupom aplicado no carrinho for "só primeira compra", confere pelo
   CPF (assim que o cliente preenche esse campo) se ele já tem algum
   pedido anterior. Se já tiver, o cupom é removido do total e um aviso
   explica o motivo — sem travar o resto do formulário. */
async function ndjChecarCupomPrimeiraCompra(){
  const aviso = document.getElementById('aviso-cupom-checkout');

  if(!ndjCupomCheckout || !ndjCupomCheckout.primeira_compra_apenas){
    aviso.style.display = 'none';
    return true;
  }

  const cpf = document.getElementById('campo-cpf-cliente').value;
  if(!ndjCpfValido(cpf)){
    // CPF ainda incompleto/incorreto — não dá pra checar ainda, deixa o
    // required do campo cuidar disso na hora de enviar o formulário.
    return true;
  }

  const jaComprou = await ndjClienteJaComprou(cpf);
  if(jaComprou){
    ndjCupomCheckout = null;
    sessionStorage.removeItem('ndj_cupom_aplicado');
    aviso.textContent = 'Esse cupom é válido só na primeira compra, e já identificamos um pedido anterior com esse CPF — o desconto foi removido do total.';
    aviso.style.display = 'block';
    ndjRenderizarResumoCheckout();
    return false;
  }

  aviso.style.display = 'none';
  return true;
}

function ndjRenderizarResumoCheckout(){
  const itens = ndjLerCarrinho();
  const subtotal = ndjSubtotalCarrinho(itens);
  const desconto = ndjCupomCheckout ? ndjCalcularDescontoCupom(ndjCupomCheckout, subtotal) : 0;

  document.getElementById('resumo-itens-checkout').innerHTML = itens.map(item => `
    <div style="display:flex; justify-content:space-between; gap:10px; font-size:13px; margin-bottom:8px;">
      <span>${item.quantidade}x ${item.nome}${item.cor ? ' (' + item.cor + ')' : ''}</span>
      <span>${ndjFormatarMoeda(item.precoUnitario * item.quantidade)}</span>
    </div>
  `).join('');

  document.getElementById('checkout-subtotal').textContent = ndjFormatarMoeda(subtotal);
  const linhaDesconto = document.getElementById('linha-checkout-desconto');
  if(desconto > 0){
    linhaDesconto.style.display = 'flex';
    document.getElementById('checkout-desconto').textContent = '- ' + ndjFormatarMoeda(desconto);
  } else {
    linhaDesconto.style.display = 'none';
  }

  ndjAtualizarTotalCheckout();
}

function ndjAtualizarTotalCheckout(){
  const itens = ndjLerCarrinho();
  const subtotal = ndjSubtotalCarrinho(itens);
  const desconto = ndjCupomCheckout ? ndjCalcularDescontoCupom(ndjCupomCheckout, subtotal) : 0;
  const frete = ndjOpcaoFreteEscolhida ? ndjOpcaoFreteEscolhida.valor : 0;
  const total = Math.max(0, subtotal - desconto + frete);

  document.getElementById('checkout-frete').textContent = ndjOpcaoFreteEscolhida
    ? (ndjOpcaoFreteEscolhida.valor > 0 ? ndjFormatarMoeda(ndjOpcaoFreteEscolhida.valor) : 'Grátis (combinado)')
    : 'Calcule ao lado';
  document.getElementById('checkout-total').textContent = ndjFormatarMoeda(total);
}

async function ndjCalcularFreteCheckout(){
  const cep = document.getElementById('campo-cep-checkout').value;
  const alvo = document.getElementById('opcoes-frete-checkout');
  const digitos = (cep || '').replace(/\D/g, '');

  if(digitos.length !== 8){
    alvo.innerHTML = '<p style="color:var(--erro); font-size:13px;">Digite um CEP válido (8 números).</p>';
    return;
  }

  const botao = document.getElementById('btn-calcular-frete-checkout');
  botao.disabled = true;
  const textoOriginalBotao = botao.textContent;
  botao.textContent = 'Calculando...';
  alvo.innerHTML = '<p style="font-size:13px; color:var(--tinta-suave);">Calculando frete...</p>';

  const itensParaFrete = ndjLerCarrinho().map(item => {
    const produto = ndjBuscarProduto(item.produtoId);
    return {
      nome: item.nome,
      pesoKg: produto ? produto.pesoKg : 0.3,
      preco: item.precoUnitario,
      quantidade: item.quantidade
    };
  });

  const opcoes = await ndjCalcularFrete(cep, itensParaFrete);
  botao.disabled = false;
  botao.textContent = textoOriginalBotao;

  if(!opcoes || opcoes.erro){
    alvo.innerHTML = `<p style="color:var(--erro); font-size:13px;">${(opcoes && opcoes.erro) || 'Digite um CEP válido (8 números).'}</p>`;
    return;
  }
  if(!opcoes.length){
    alvo.innerHTML = '<p style="color:var(--erro); font-size:13px;">Nenhuma opção de frete encontrada para esse CEP.</p>';
    return;
  }

  alvo.innerHTML = `
    <div class="calculo-frete">
      <label class="titulo-opcao" style="display:block; margin-bottom:8px; font-weight:600;">Escolha o frete</label>
      <div class="resultado-frete">
        ${opcoes.map((op, i) => `
          <label class="opcao-frete" style="cursor:pointer;">
            <span><input type="radio" name="opcao-frete" value="${i}" ${i===0?'checked':''}> ${op.nome} — até ${op.prazoDias} dias úteis</span>
            <span>${ndjFormatarMoeda(op.valor)}</span>
          </label>
        `).join('')}
      </div>
    </div>
  `;

  alvo.querySelectorAll('input[name=opcao-frete]').forEach(r => {
    r.addEventListener('change', () => {
      ndjOpcaoFreteEscolhida = Object.assign({ nome: opcoes[r.value].nome }, opcoes[r.value]);
      ndjAtualizarTotalCheckout();
    });
  });
  ndjOpcaoFreteEscolhida = Object.assign({ nome: opcoes[0].nome }, opcoes[0]);
  ndjAtualizarTotalCheckout();
}

function ndjAlternarCombinarLocal(e){
  const combinando = e.target.checked;
  document.getElementById('campo-cep-checkout').disabled = combinando;
  document.getElementById('btn-calcular-frete-checkout').disabled = combinando;
  document.getElementById('opcoes-frete-checkout').style.display = combinando ? 'none' : 'block';

  if(combinando){
    ndjOpcaoFreteEscolhida = { nome: 'Combinado via WhatsApp', valor: 0, prazoDias: 0 };
  } else {
    ndjOpcaoFreteEscolhida = null;
  }
  ndjAtualizarTotalCheckout();
}

async function ndjConfirmarPedido(e){
  e.preventDefault();

  const cpf = document.getElementById('campo-cpf-cliente').value;
  if(!ndjCpfValido(cpf)){
    ndjMostrarAviso('Digite um CPF válido antes de continuar.', 'erro');
    return;
  }

  const combinarLocal = document.getElementById('check-combinar-local').checked;
  if(!ndjOpcaoFreteEscolhida){
    ndjMostrarAviso('Calcule o frete (ou marque "combinar local") antes de continuar.', 'erro');
    return;
  }

  // Confere de novo (agora com o CPF final) se o cupom de primeira compra
  // ainda vale — evita passar batido se o cliente trocou o CPF depois do
  // primeiro check ou nunca tirou o foco do campo.
  const cupomAindaValido = await ndjChecarCupomPrimeiraCompra();
  if(!cupomAindaValido){
    ndjMostrarAviso('O cupom aplicado não é mais válido para esse CPF — confira o novo total antes de continuar.', 'erro');
    return;
  }

  const itens = ndjLerCarrinho();
  const subtotal = ndjSubtotalCarrinho(itens);
  const desconto = ndjCupomCheckout ? ndjCalcularDescontoCupom(ndjCupomCheckout, subtotal) : 0;
  const frete = ndjOpcaoFreteEscolhida.valor;
  const total = Math.max(0, subtotal - desconto + frete);

  const cliente = {
    nome: document.getElementById('campo-nome-cliente').value.trim(),
    email: document.getElementById('campo-email-cliente').value.trim(),
    cpf: cpf.replace(/\D/g, ''),
    telefone: document.getElementById('campo-telefone-cliente').value.trim(),
    cep: document.getElementById('campo-cep-checkout').value.trim(),
    endereco: document.getElementById('campo-endereco-cliente').value.trim(),
    cidade: document.getElementById('campo-cidade-cliente').value.trim(),
    estado: document.getElementById('campo-estado-cliente').value.trim().toUpperCase()
  };

  const botao = document.getElementById('btn-confirmar-pedido');
  botao.disabled = true;
  botao.textContent = 'Processando...';

  try {
    const pedido = await ndjCriarPedido({
      cliente,
      itens,
      subtotal,
      desconto,
      cupomCodigo: ndjCupomCheckout ? ndjCupomCheckout.codigo : null,
      frete,
      freteNome: ndjOpcaoFreteEscolhida.nome,
      total,
      combinarLocal
    });

    let data, respostaFuncaoOk, corpoErro;
    try {
      const respostaFuncao = await fetch(`${SUPABASE_URL}/functions/v1/criar-preferencia-mp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify({
          pedidoNumero: pedido.numero,
          itens,
          frete,
          desconto,
          total,
          cliente
        })
      });
      respostaFuncaoOk = respostaFuncao.ok;
      const texto = await respostaFuncao.text();
      try { data = JSON.parse(texto); } catch(e){ data = null; corpoErro = texto; }
      console.log('Resposta da função criar-preferencia-mp:', respostaFuncao.status, texto);
    } catch (erroRede) {
      throw new Error('Não foi possível conectar ao servidor de pagamento: ' + erroRede.message);
    }

    if(!respostaFuncaoOk || !data || !data.init_point){
      const mensagem = (data && data.error) || corpoErro || ('Não foi possível iniciar o pagamento. Resposta da função: ' + JSON.stringify(data));
      throw new Error(mensagem);
    }

    ndjEsvaziarCarrinho();
    sessionStorage.removeItem('ndj_cupom_aplicado');
    window.location.href = data.init_point;
  } catch (err) {
    console.error(err);
    ndjMostrarAviso('Não foi possível ir para o pagamento: ' + err.message, 'erro');
    botao.disabled = false;
    botao.textContent = 'Ir para pagamento';
  }
}
