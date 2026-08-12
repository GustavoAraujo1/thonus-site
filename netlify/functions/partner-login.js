/* ==========================================================
   THONUS Engenharia — Área do parceiro (login)
   Confere usuário/senha contra PARTNER_USER / PARTNER_PASSWORD
   (variáveis de ambiente na Netlify) e, se corretos, devolve um
   cookie de sessão assinado (ver lib/auth.js). Usado pelo
   formulário em instagram/login.html.
   ========================================================== */

const { createSessionToken, buildSessionCookie, timingSafeStringEqual, SESSION_MAX_AGE_SECONDS } = require('./lib/auth');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Método não permitido — use POST.' };
  }

  const expectedUser = process.env.PARTNER_USER;
  const expectedPassword = process.env.PARTNER_PASSWORD;

  if (!expectedUser || !expectedPassword) {
    console.error('[partner-login] PARTNER_USER/PARTNER_PASSWORD não configurados nas variáveis de ambiente.');
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: false, reason: 'not-configured' })
    };
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: false, reason: 'bad-request' })
    };
  }

  const userOk = timingSafeStringEqual(body.username || '', expectedUser);
  const passOk = timingSafeStringEqual(body.password || '', expectedPassword);

  if (!userOk || !passOk) {
    return {
      statusCode: 401,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: false, reason: 'invalid-credentials' })
    };
  }

  const token = createSessionToken();
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': buildSessionCookie(token, SESSION_MAX_AGE_SECONDS)
    },
    body: JSON.stringify({ ok: true })
  };
};
