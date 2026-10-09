/* ==========================================================
   THONUS Engenharia — Área do parceiro (login)
   Sessão simples baseada em cookie assinado (HMAC), sem banco
   de dados: o token carrega só a data de expiração + uma
   assinatura verificável com PARTNER_SESSION_SECRET (variável
   de ambiente na Netlify). Usado por partner-login.js,
   partner-check.js, partner-logout.js e pelas functions do
   Instagram (get-instagram-post.js, get-instagram-image.js,
   trigger-instagram-post.js).
   ========================================================== */

const crypto = require('crypto');

const SESSION_COOKIE_NAME = 'thonus_partner_session';
const SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60; // 7 dias

function getSecret() {
  const secret = process.env.PARTNER_SESSION_SECRET;
  if (!secret) throw new Error('PARTNER_SESSION_SECRET não configurado nas variáveis de ambiente.');
  return secret;
}

function createSessionToken(maxAgeSeconds = SESSION_MAX_AGE_SECONDS) {
  const payload = String(Date.now() + maxAgeSeconds * 1000);
  const sig = crypto.createHmac('sha256', getSecret()).update(payload).digest('hex');
  return Buffer.from(`${payload}.${sig}`).toString('base64url');
}

function verifySessionToken(token) {
  try {
    const [payload, sig] = Buffer.from(token, 'base64url').toString('utf8').split('.');
    if (!payload || !sig) return false;

    const expectedSig = crypto.createHmac('sha256', getSecret()).update(payload).digest('hex');
    const sigBuf = Buffer.from(sig, 'hex');
    const expectedBuf = Buffer.from(expectedSig, 'hex');
    if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) return false;

    return Number(payload) > Date.now();
  } catch {
    return false;
  }
}

// Token curto só pras imagens dos slides: na hora de publicar, a Meta baixa
// cada slide direto do nosso servidor, sem cookie. O prefixo "media:" faz
// esse token não valer como sessão (Number("media:...") é NaN) e a sessão
// não valer aqui — se ele vazar num log da Meta, abre só as imagens, por 1h.
const MEDIA_TOKEN_PREFIX = 'media:';

function createMediaToken(maxAgeSeconds = 60 * 60) {
  const payload = `${MEDIA_TOKEN_PREFIX}${Date.now() + maxAgeSeconds * 1000}`;
  const sig = crypto.createHmac('sha256', getSecret()).update(payload).digest('hex');
  return Buffer.from(`${payload}.${sig}`).toString('base64url');
}

function verifyMediaToken(token) {
  try {
    const [payload, sig] = Buffer.from(String(token), 'base64url').toString('utf8').split('.');
    if (!payload || !sig || !payload.startsWith(MEDIA_TOKEN_PREFIX)) return false;

    const expectedSig = crypto.createHmac('sha256', getSecret()).update(payload).digest('hex');
    const sigBuf = Buffer.from(sig, 'hex');
    const expectedBuf = Buffer.from(expectedSig, 'hex');
    if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) return false;

    return Number(payload.slice(MEDIA_TOKEN_PREFIX.length)) > Date.now();
  } catch {
    return false;
  }
}

function timingSafeStringEqual(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function parseCookies(header) {
  const out = {};
  if (!header) return out;
  header.split(';').forEach((pair) => {
    const idx = pair.indexOf('=');
    if (idx === -1) return;
    out[pair.slice(0, idx).trim()] = decodeURIComponent(pair.slice(idx + 1).trim());
  });
  return out;
}

function isAuthenticated(event) {
  const cookies = parseCookies((event.headers && (event.headers.cookie || event.headers.Cookie)) || '');
  const token = cookies[SESSION_COOKIE_NAME];
  return Boolean(token && verifySessionToken(token));
}

function buildSessionCookie(token, maxAgeSeconds = SESSION_MAX_AGE_SECONDS) {
  return `${SESSION_COOKIE_NAME}=${token}; Path=/; Max-Age=${maxAgeSeconds}; HttpOnly; Secure; SameSite=Lax`;
}

function buildClearCookie() {
  return `${SESSION_COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`;
}

module.exports = {
  SESSION_MAX_AGE_SECONDS,
  createSessionToken,
  verifySessionToken,
  createMediaToken,
  verifyMediaToken,
  timingSafeStringEqual,
  isAuthenticated,
  buildSessionCookie,
  buildClearCookie
};
