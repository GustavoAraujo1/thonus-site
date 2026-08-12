/* ==========================================================
   THONUS Engenharia — Gerador de posts para Instagram
   Function HTTP simples: devolve o PNG de um slide específico
   (?slide=1..N) gravado pela generate-instagram-post.js no
   Netlify Blobs. Lido pelo instagram/painel.html.
   Protegida por login — ver netlify/functions/lib/auth.js.
   ========================================================== */

const { getStore } = require('@netlify/blobs');
const { isAuthenticated } = require('./lib/auth');

exports.handler = async (event) => {
  if (!isAuthenticated(event)) {
    return { statusCode: 401, body: 'Não autorizado.' };
  }

  const slide = parseInt((event.queryStringParameters || {}).slide, 10);
  if (!Number.isInteger(slide) || slide < 1) {
    return { statusCode: 400, body: 'Parâmetro "slide" inválido.' };
  }

  const store = getStore({
    name: 'instagram-posts',
    siteID: process.env.BLOBS_SITE_ID,
    token: process.env.BLOBS_TOKEN
  });
  const data = await store.get(`slide-${slide}.png`, { type: 'arrayBuffer' });

  if (!data) {
    return { statusCode: 404, body: 'Slide não encontrado.' };
  }

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'private, no-store'
    },
    isBase64Encoded: true,
    body: Buffer.from(data).toString('base64')
  };
};
