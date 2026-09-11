/* ==========================================================================
   NDJ 3D — Página de contato
   O formulário monta uma mensagem com os dados preenchidos e abre o
   WhatsApp (wa.me) já com o texto pronto para envio.
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('form-contato');
  if(!form) return;

  const NUMERO_WHATSAPP = '5546988372988'; // (46) 98837-2988, formato internacional

  form.addEventListener('submit', (e) => {
    e.preventDefault();

    const nome = document.getElementById('contato-nome').value.trim();
    const email = document.getElementById('contato-email').value.trim();
    const assunto = document.getElementById('contato-assunto').value.trim();
    const mensagem = document.getElementById('contato-mensagem').value.trim();

    const texto =
      `Olá! Meu nome é ${nome}.\n` +
      `E-mail: ${email}\n` +
      `Assunto: ${assunto}\n\n` +
      `Mensagem:\n${mensagem}`;

    const url = `https://wa.me/${NUMERO_WHATSAPP}?text=${encodeURIComponent(texto)}`;

    window.open(url, '_blank');

    document.getElementById('mensagem-envio-contato').style.display = 'block';
    form.reset();
    ndjMostrarAviso('Abrindo o WhatsApp para envio da mensagem...');
  });
});
