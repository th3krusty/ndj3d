/* ==========================================================================
   NDJ 3D — Página de contato
   O formulário abaixo apenas simula o envio (mostra confirmação na tela).
   Para receber as mensagens de verdade, ligue este formulário a um serviço
   de e-mail (ex.: Formspree, EmailJS) ou a um backend próprio.
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('form-contato');
  if(!form) return;
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    document.getElementById('mensagem-envio-contato').style.display = 'block';
    form.reset();
    ndjMostrarAviso('Mensagem enviada! Retornaremos em breve.');
  });
});
