/* ==========================================================
   THONUS Engenharia — Área do parceiro (login)
   Limpa o cookie de sessão. Usado pelo botão "sair" do
   instagram/painel.html.
   ========================================================== */

const { buildClearCookie } = require('./lib/auth');

exports.handler = async () => {
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': buildClearCookie()
    },
    body: JSON.stringify({ ok: true })
  };
};
