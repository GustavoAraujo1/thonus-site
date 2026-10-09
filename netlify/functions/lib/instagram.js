/* ==========================================================
   THONUS Engenharia — Publicação no Instagram (API oficial)
   "Instagram API with Instagram Login" (graph.instagram.com).
   Usado por publish-instagram-post.js (botão "publicar" do
   painel) e refresh-instagram-token.js (renovação semanal).

   Fluxo da Meta pra carrossel: 1 container por imagem
   (is_carousel_item) → 1 container CAROUSEL com os filhos →
   espera ficar FINISHED → media_publish. A Meta baixa cada
   imagem pela URL, então elas precisam estar públicas e em JPEG.
   ========================================================== */

const crypto = require('crypto');

const GRAPH_URL = 'https://graph.instagram.com';
const TOKEN_KEY = 'token.json';
const STATUS_POLL_ATTEMPTS = 10;
const STATUS_POLL_INTERVAL_MS = 2000;

function hashToken(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex').slice(0, 16);
}

// O token renovado fica no Blobs (refresh-instagram-token.js). Se o
// IG_ACCESS_TOKEN da Netlify for trocado à mão (ex.: token novo depois de
// expirar), o hash muda e o da variável volta a valer — senão o Blobs
// ficaria preso num token morto.
async function getAccessToken(authStore) {
  const envToken = process.env.IG_ACCESS_TOKEN;
  const saved = await authStore.get(TOKEN_KEY, { type: 'json' });
  if (saved && saved.accessToken && (!envToken || saved.basedOn === hashToken(envToken))) {
    return saved.accessToken;
  }
  return envToken || null;
}

async function refreshAccessToken(authStore, fetchFn = fetch) {
  const current = await getAccessToken(authStore);
  if (!current) return { ok: false, reason: 'missing-token' };

  const url = `${GRAPH_URL}/refresh_access_token?grant_type=ig_refresh_token&access_token=${encodeURIComponent(current)}`;
  const res = await fetchFn(url);
  const json = await res.json();
  if (!res.ok || !json.access_token) {
    return { ok: false, reason: 'refresh-failed', message: (json.error && json.error.message) || `HTTP ${res.status}` };
  }

  const expiresAt = new Date(Date.now() + (json.expires_in || 0) * 1000).toISOString();
  const saved = await authStore.get(TOKEN_KEY, { type: 'json' });
  const envToken = process.env.IG_ACCESS_TOKEN;
  await authStore.setJSON(TOKEN_KEY, {
    accessToken: json.access_token,
    refreshedAt: new Date().toISOString(),
    expiresAt,
    // mantém a "origem" da cadeia de renovação; ver getAccessToken
    basedOn: saved && saved.basedOn && envToken && saved.basedOn === hashToken(envToken)
      ? saved.basedOn
      : hashToken(envToken || current)
  });
  return { ok: true, expiresAt };
}

function createGraphClient(token, fetchFn = fetch) {
  return async function graph(method, path, params = {}) {
    const query = new URLSearchParams({ ...params, access_token: token });
    const res = method === 'GET'
      ? await fetchFn(`${GRAPH_URL}/${path}?${query}`)
      : await fetchFn(`${GRAPH_URL}/${path}`, { method: 'POST', body: query });
    const json = await res.json();
    if (!res.ok || json.error) {
      throw new Error((json.error && json.error.message) || `HTTP ${res.status} em ${path}`);
    }
    return json;
  };
}

async function waitUntilFinished(graph, containerId, sleep) {
  for (let i = 0; i < STATUS_POLL_ATTEMPTS; i++) {
    const { status_code: status } = await graph('GET', containerId, { fields: 'status_code' });
    if (status === 'FINISHED') return;
    if (status === 'ERROR' || status === 'EXPIRED') throw new Error(`Container ${containerId} com status ${status}.`);
    await sleep(STATUS_POLL_INTERVAL_MS);
  }
  throw new Error(`Container ${containerId} não ficou pronto a tempo.`);
}

// imageUrls na ordem do carrossel. Com 1 imagem só vira post simples
// (a Meta exige no mínimo 2 itens num carrossel).
async function publishToInstagram({ token, imageUrls, caption, fetchFn = fetch, sleep = (ms) => new Promise((r) => setTimeout(r, ms)) }) {
  if (!imageUrls.length) throw new Error('Nenhuma imagem pra publicar.');
  if (imageUrls.length > 10) throw new Error('Carrossel aceita no máximo 10 imagens.');

  const graph = createGraphClient(token, fetchFn);
  const { user_id: igId } = await graph('GET', 'me', { fields: 'user_id' });

  let containerId;
  if (imageUrls.length === 1) {
    ({ id: containerId } = await graph('POST', `${igId}/media`, { image_url: imageUrls[0], caption }));
  } else {
    // Promise.all preserva a ordem do array, então a ordem dos slides se mantém.
    const children = await Promise.all(
      imageUrls.map((url) => graph('POST', `${igId}/media`, { image_url: url, is_carousel_item: 'true' }))
    );
    ({ id: containerId } = await graph('POST', `${igId}/media`, {
      media_type: 'CAROUSEL',
      children: children.map((c) => c.id).join(','),
      caption
    }));
  }

  await waitUntilFinished(graph, containerId, sleep);
  const { id: mediaId } = await graph('POST', `${igId}/media_publish`, { creation_id: containerId });
  const { permalink } = await graph('GET', mediaId, { fields: 'permalink' });
  return { mediaId, permalink };
}

module.exports = { getAccessToken, refreshAccessToken, publishToInstagram, hashToken };
