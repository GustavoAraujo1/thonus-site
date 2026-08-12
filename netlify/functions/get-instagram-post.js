/* ==========================================================
   THONUS Engenharia — Gerador de posts para Instagram
   Function HTTP simples: devolve os metadados (legenda + lista
   de slides) gravados pela generate-instagram-post.js no
   Netlify Blobs. Lido pelo instagram/painel.html.
   ========================================================== */

const { getStore } = require('@netlify/blobs');

exports.handler = async () => {
  const store = getStore({
    name: 'instagram-posts',
    siteID: process.env.BLOBS_SITE_ID,
    token: process.env.BLOBS_TOKEN
  });
  const data = await store.get('latest.json', { type: 'json' });

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=300'
    },
    body: JSON.stringify(data || { generatedAt: null, totalSlides: 0, caption: '', slides: [] })
  };
};
