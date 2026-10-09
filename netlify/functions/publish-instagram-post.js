/* ==========================================================
   THONUS Engenharia — Gerador de posts para Instagram
   Function HTTP (POST): publica o carrossel do dia no
   @projeto_thonrus pela API oficial. É o "aprovar" do painel —
   nada vai pro Instagram sem alguém logado clicar no botão.
   Corpo opcional: { "caption": "..." } (legenda editada no painel).
   Protegida por login — ver netlify/functions/lib/auth.js.
   ========================================================== */

const { getStore } = require('@netlify/blobs');
const { isAuthenticated, createMediaToken } = require('./lib/auth');
const { getAccessToken, publishToInstagram } = require('./lib/instagram');

const MAX_CAPTION_LENGTH = 2200; // limite do Instagram

function json(statusCode, body) {
  return { statusCode, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
}

function blobStore(name) {
  return getStore({ name, siteID: process.env.BLOBS_SITE_ID, token: process.env.BLOBS_TOKEN });
}

exports.handler = async (event) => {
  if (!isAuthenticated(event)) return json(401, { ok: false, reason: 'unauthorized' });
  if (event.httpMethod !== 'POST') return json(405, { ok: false, reason: 'method-not-allowed' });

  const postStore = blobStore('instagram-posts');
  const post = await postStore.get('latest.json', { type: 'json' });
  if (!post || !post.totalSlides) return json(422, { ok: false, reason: 'no-post' });
  if (post.published) return json(409, { ok: false, reason: 'already-published', permalink: post.published.permalink });

  const token = await getAccessToken(blobStore('instagram-auth'));
  if (!token) return json(500, { ok: false, reason: 'missing-token' });

  let caption = post.caption;
  try {
    const body = JSON.parse(event.body || '{}');
    if (typeof body.caption === 'string' && body.caption.trim()) caption = body.caption.trim();
  } catch {
    // corpo inválido: segue com a legenda gerada
  }
  if (caption.length > MAX_CAPTION_LENGTH) return json(422, { ok: false, reason: 'caption-too-long' });

  const siteUrl = process.env.URL || 'https://thonrus.com.br';
  const mediaToken = createMediaToken();
  const imageUrls = post.slides.map((s) => `${siteUrl}/api/instagram/image?slide=${s.index}&t=${mediaToken}`);

  try {
    const { mediaId, permalink } = await publishToInstagram({ token, imageUrls, caption });
    const published = { at: new Date().toISOString(), mediaId, permalink };
    await postStore.setJSON('latest.json', { ...post, caption, published });
    return json(200, { ok: true, ...published });
  } catch (err) {
    console.error('[publish-instagram-post] erro:', err);
    return json(502, { ok: false, reason: 'instagram-error', message: err.message });
  }
};
