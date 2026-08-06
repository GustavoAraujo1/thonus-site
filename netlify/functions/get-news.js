/* ==========================================================
   THONUS Engenharia — Agregador de notícias do blog
   Function HTTP simples: devolve o último resultado gravado
   pela fetch-news-background.js no Netlify Blobs.
   ========================================================== */

const { getStore } = require('@netlify/blobs');

exports.handler = async () => {
  // Configuração explícita (ver fetch-news-background.js para o motivo)
  const store = getStore({
    name: 'news',
    siteID: process.env.BLOBS_SITE_ID,
    token: process.env.BLOBS_TOKEN
  });
  const data = await store.get('latest.json', { type: 'json' });

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=3600'
    },
    body: JSON.stringify(data || { generatedAt: null, items: [], sourceStatus: [] })
  };
};
