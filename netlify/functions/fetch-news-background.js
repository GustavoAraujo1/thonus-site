/* ==========================================================
   THONUS Engenharia — Agregador de notícias do blog
   Netlify Scheduled Background Function (roda 00:00 BRT — ver netlify.toml)

   Busca os feeds RSS abaixo, normaliza os itens mais recentes e
   grava o resultado no Netlify Blobs (store "news", key "latest.json").
   O blog.html lê esse resultado através da function get-news.js.
   ========================================================== */

const Parser = require('rss-parser');
const { getStore } = require('@netlify/blobs');

const MAX_ITEMS_PER_SOURCE = 6;
const MAX_TOTAL_ITEMS = 12;
const FETCH_TIMEOUT_MS = 10000;
const EXCERPT_MAX_LENGTH = 160;

const SOURCES = [
  { name: 'Portal Engenharia', url: 'https://portalengenharia.com.br/feed/' },
  { name: 'Mundo da Elétrica', url: 'https://mundodaeletrica.com.br/feed/' },
  { name: 'Automação Industrial', url: 'https://automacaoindustrial.info/feed/' },
  { name: 'Poder360 · Energia', url: 'https://www.poder360.com.br/poder-energia/feed/' },
  // Grupo Pini — a checagem do ambiente de pesquisa teve conexão recusada nas 3 (mesmo IP),
  // possivelmente bloqueio geográfico/anti-bot local. URLs seguem o padrão WordPress padrão
  // mas não foram confirmadas. Falha aqui é silenciosa: se não funcionar, a fonte simplesmente
  // não contribui naquele dia (ver sourceStatus nos logs para diagnóstico).
  { name: 'Téchne', url: 'https://techne.pini.com.br/feed/' },
  { name: 'AU — Arquitetura e Urbanismo', url: 'https://au.pini.com.br/feed/' },
  { name: 'Construção Mercado', url: 'https://construcaomercado.pini.com.br/feed/' }
];

const parser = new Parser({
  timeout: FETCH_TIMEOUT_MS,
  customFields: {
    item: [['media:content', 'mediaContent', { keepArray: false }]]
  }
});

function truncate(text, maxLength) {
  if (!text) return '';
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= maxLength) return clean;
  return clean.slice(0, maxLength - 1).trimEnd() + '…';
}

function extractImage(item) {
  if (item.enclosure && item.enclosure.url) return item.enclosure.url;
  if (item.mediaContent && item.mediaContent.$ && item.mediaContent.$.url) {
    return item.mediaContent.$.url;
  }
  const html = item.content || item.summary || '';
  const match = html.match(/<img[^>]+src="([^">]+)"/i);
  return match ? match[1] : null;
}

async function fetchSource(source) {
  const feed = await parser.parseURL(source.url);
  const items = (feed.items || [])
    .slice(0, MAX_ITEMS_PER_SOURCE)
    .map((item) => ({
      title: (item.title || '').trim(),
      link: item.link,
      source: source.name,
      excerpt: truncate(item.contentSnippet || item.summary, EXCERPT_MAX_LENGTH),
      image: extractImage(item),
      publishedAt: item.isoDate || item.pubDate || null
    }))
    .filter((item) => item.title && item.link);

  return { name: source.name, count: items.length, items };
}

exports.handler = async () => {
  const results = await Promise.allSettled(SOURCES.map(fetchSource));

  const allItems = [];
  const sourceStatus = [];

  results.forEach((result, index) => {
    const source = SOURCES[index];
    if (result.status === 'fulfilled') {
      sourceStatus.push({ name: source.name, ok: true, count: result.value.count });
      allItems.push(...result.value.items);
    } else {
      sourceStatus.push({
        name: source.name,
        ok: false,
        count: 0,
        error: result.reason instanceof Error ? result.reason.message : String(result.reason)
      });
    }
  });

  allItems.sort((a, b) => {
    const dateA = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
    const dateB = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
    return dateB - dateA;
  });

  const payload = {
    generatedAt: new Date().toISOString(),
    items: allItems.slice(0, MAX_TOTAL_ITEMS),
    sourceStatus
  };

  // getStore('news') automático não funciona de forma confiável em Background
  // Functions / disparo manual (o Netlify não injeta o contexto de site+token
  // nesses casos) — por isso a configuração explícita via env vars abaixo.
  const store = getStore({
    name: 'news',
    siteID: process.env.BLOBS_SITE_ID,
    token: process.env.BLOBS_TOKEN
  });
  await store.setJSON('latest.json', payload);

  console.log(
    `[fetch-news] ${payload.items.length} itens salvos de ${sourceStatus.filter((s) => s.ok).length}/${sourceStatus.length} fontes.`,
    JSON.stringify(sourceStatus)
  );
};
