/* ==========================================================
   THONUS Engenharia — Área do parceiro (login)
   Diz se o visitante já tem uma sessão válida. Usado por
   instagram/login.html (pra pular direto pro painel se já
   estiver logado) e instagram/painel.html (pra redirecionar
   pro login se a sessão expirar).
   ========================================================== */

const { isAuthenticated } = require('./lib/auth');

exports.handler = async (event) => {
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ authenticated: isAuthenticated(event) })
  };
};
