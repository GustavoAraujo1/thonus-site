/* ==========================================================
   THONUS Engenharia — Gerador de posts para Instagram
   Function HTTP simples: devolve o PNG de um slide específico
   (?slide=1..5) gravado pela generate-instagram-post.js no
   Netlify Blobs. Lido pelo instagram/painel.html.
   ========================================================== */

const { getStore } = require('@netlify/blobs');

exports.handler = async (event) => {
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
      'Cache-Control': 'public, max-age=300'
    },
    isBase64Encoded: true,
    body: Buffer.from(data).toString('base64')
  };
};
