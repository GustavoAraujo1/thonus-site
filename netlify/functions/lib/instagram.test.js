// Rodar: node --test netlify/functions/lib/instagram.test.js
// Testa a sequência de chamadas à API da Meta com um fetch falso.
const test = require('node:test');
const assert = require('node:assert');
const { publishToInstagram, getAccessToken, hashToken } = require('./instagram');

function fakeGraph({ statuses = ['IN_PROGRESS', 'FINISHED'], failOn } = {}) {
  const calls = [];
  let nextId = 100;
  const fetchFn = async (url, opts = {}) => {
    const u = new URL(url);
    const params = Object.fromEntries(opts.body ? new URLSearchParams(opts.body) : u.searchParams);
    const path = u.pathname.slice(1);
    calls.push({ method: opts.method || 'GET', path, params });
    const reply = (body, status = 200) => ({ ok: status < 400, status, json: async () => body });

    if (failOn && path.endsWith(failOn)) return reply({ error: { message: 'boom da Meta' } }, 400);
    if (path === 'me') return reply({ user_id: 'IG1' });
    if (path === 'IG1/media') return reply({ id: `C${nextId++}` });
    if (path === 'IG1/media_publish') return reply({ id: 'M1' });
    if (params.fields === 'status_code') return reply({ status_code: statuses.shift() || 'FINISHED' });
    if (params.fields === 'permalink') return reply({ permalink: 'https://instagram.com/p/X' });
    return reply({ error: { message: `rota inesperada ${path}` } }, 404);
  };
  return { calls, fetchFn };
}

const noSleep = async () => {};

test('carrossel: filhos na ordem, container CAROUSEL com legenda, espera FINISHED e publica', async () => {
  const { calls, fetchFn } = fakeGraph();
  const result = await publishToInstagram({ token: 't', imageUrls: ['u1', 'u2', 'u3'], caption: 'legenda', fetchFn, sleep: noSleep });

  assert.deepStrictEqual(result, { mediaId: 'M1', permalink: 'https://instagram.com/p/X' });
  const media = calls.filter((c) => c.path === 'IG1/media');
  assert.deepStrictEqual(media.slice(0, 3).map((c) => [c.params.image_url, c.params.is_carousel_item]), [['u1', 'true'], ['u2', 'true'], ['u3', 'true']]);
  assert.deepStrictEqual(media[3].params, { media_type: 'CAROUSEL', children: 'C100,C101,C102', caption: 'legenda', access_token: 't' });
  assert.strictEqual(calls.filter((c) => c.params.fields === 'status_code').length, 2);
  assert.strictEqual(calls.find((c) => c.path === 'IG1/media_publish').params.creation_id, 'C103');
});

test('1 imagem só vira post simples (carrossel exige 2+)', async () => {
  const { calls, fetchFn } = fakeGraph();
  await publishToInstagram({ token: 't', imageUrls: ['u1'], caption: 'c', fetchFn, sleep: noSleep });
  const media = calls.filter((c) => c.path === 'IG1/media');
  assert.strictEqual(media.length, 1);
  assert.strictEqual(media[0].params.is_carousel_item, undefined);
  assert.strictEqual(media[0].params.caption, 'c');
});

test('erro da Meta sobe com a mensagem dela e não publica', async () => {
  const { calls, fetchFn } = fakeGraph({ failOn: 'media_publish' });
  await assert.rejects(publishToInstagram({ token: 't', imageUrls: ['u1', 'u2'], caption: 'c', fetchFn, sleep: noSleep }), /boom da Meta/);
  assert.ok(!calls.some((c) => c.params.fields === 'permalink'));
});

test('container com ERROR aborta', async () => {
  const { fetchFn } = fakeGraph({ statuses: ['ERROR'] });
  await assert.rejects(publishToInstagram({ token: 't', imageUrls: ['u1', 'u2'], caption: 'c', fetchFn, sleep: noSleep }), /ERROR/);
});

test('token de imagem e sessão não valem um no lugar do outro', () => {
  process.env.PARTNER_SESSION_SECRET = 'segredo-de-teste';
  const auth = require('./auth');
  const media = auth.createMediaToken();
  const session = auth.createSessionToken();
  assert.ok(auth.verifyMediaToken(media));
  assert.ok(!auth.verifySessionToken(media));
  assert.ok(!auth.verifyMediaToken(session));
  assert.ok(!auth.verifyMediaToken(auth.createMediaToken(-1)), 'expirado');
  assert.ok(!auth.verifyMediaToken(undefined));
  delete process.env.PARTNER_SESSION_SECRET;
});

test('token: usa o renovado do Blobs, mas volta pro da variável se ela for trocada', async () => {
  const store = (saved) => ({ get: async () => saved });
  process.env.IG_ACCESS_TOKEN = 'env-A';
  assert.strictEqual(await getAccessToken(store({ accessToken: 'renovado', basedOn: hashToken('env-A') })), 'renovado');
  process.env.IG_ACCESS_TOKEN = 'env-B';
  assert.strictEqual(await getAccessToken(store({ accessToken: 'renovado', basedOn: hashToken('env-A') })), 'env-B');
  assert.strictEqual(await getAccessToken(store(null)), 'env-B');
  delete process.env.IG_ACCESS_TOKEN;
});
