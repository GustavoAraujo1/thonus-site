/* ==========================================================
   THONUS Engenharia — Renovação do token do Instagram
   Netlify Scheduled Function (toda segunda, ver netlify.toml).
   O token de longa duração da Meta vale 60 dias e pode ser
   renovado enquanto estiver válido — renovando toda semana,
   ele nunca chega a expirar. O token novo fica no Blobs
   ("instagram-auth"); IG_ACCESS_TOKEN na Netlify é só o inicial.
   ========================================================== */

const { getStore } = require('@netlify/blobs');
const { refreshAccessToken } = require('./lib/instagram');

exports.handler = async () => {
  const authStore = getStore({
    name: 'instagram-auth',
    siteID: process.env.BLOBS_SITE_ID,
    token: process.env.BLOBS_TOKEN
  });
  const result = await refreshAccessToken(authStore);
  if (result.ok) {
    console.log(`[refresh-instagram-token] token renovado, vale até ${result.expiresAt}.`);
  } else {
    console.error(`[refresh-instagram-token] falhou (${result.reason}): ${result.message || ''}`);
  }
};
