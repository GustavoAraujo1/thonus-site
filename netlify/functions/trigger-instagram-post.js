/* ==========================================================
   THONUS Engenharia — Gerador de posts para Instagram
   Function HTTP comum (não agendada, invocável diretamente):
   dispara a geração do carrossel do dia sob demanda, sem
   esperar o cron das 00h15 BRT. Usada pelo botão "gerar agora"
   do instagram/painel.html.
   Protegida por login — ver netlify/functions/lib/auth.js.
   ========================================================== */

const { runGeneration } = require('./generate-instagram-post');
const { isAuthenticated } = require('./lib/auth');

exports.handler = async (event) => {
  if (!isAuthenticated(event)) {
    return { statusCode: 401, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ok: false, reason: 'unauthorized' }) };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Método não permitido — use POST.' };
  }

  try {
    const result = await runGeneration();
    return {
      statusCode: result.ok ? 200 : 422,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(result)
    };
  } catch (err) {
    console.error('[trigger-instagram-post] erro:', err);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: false, reason: 'error', message: err.message })
    };
  }
};
