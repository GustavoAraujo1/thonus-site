/* ==========================================================
   THONUS Engenharia — Gerador de posts para Instagram
   Netlify Scheduled Background Function (roda 03:15 UTC, 15min
   depois do fetch-news-background — ver netlify.toml).

   Pega até 5 notícias mais recentes já agregadas pelo blog
   (Blobs store "news", mesma fonte que o blog.html usa) e monta
   um carrossel 1080x1350:
     - 1 slide por notícia, usando a IMAGEM DA PRÓPRIA NOTÍCIA
       (baixada da URL que já vem no RSS) como fundo, com o
       título sobreposto;
     - 1 slide final de encerramento, usando SEMPRE a mesma
       imagem institucional fixa (instagram/assets/background.*),
       sem nenhum texto de notícia por cima — só ela, como está.
   Grava tudo no Blobs store "instagram-posts". O painel em
   instagram/painel.html lê esse resultado via get-instagram-post.js
   / get-instagram-image.js pra revisão e download manual (v1 não
   publica sozinho — ver instagram/README.md para o porquê).
   ========================================================== */

const fs = require('fs');
const path = require('path');
const { getStore } = require('@netlify/blobs');

const SLIDE_WIDTH = 1080;
const SLIDE_HEIGHT = 1350;
const MAX_NEWS_SLIDES = 5;
const NEWS_IMAGE_FETCH_TIMEOUT_MS = 8000;

const COLOR_PRIMARY = '#1e8fd5';
const COLOR_DARK = '#1a1d20';
const SITE_URL = 'thonrus.com.br/blog.html';

// included_files no netlify.toml copia essa pasta pro bundle da function
// mantendo o caminho relativo à raiz do repo — por isso o ../../ aqui.
const ASSETS_DIR = path.join(__dirname, '..', '..', 'instagram', 'assets');

function readAsset(...parts) {
  try {
    return fs.readFileSync(path.join(ASSETS_DIR, ...parts));
  } catch {
    return null;
  }
}

function loadFonts() {
  const barlowBold = readAsset('fonts', 'BarlowCondensed-Bold.ttf');
  const interRegular = readAsset('fonts', 'Inter-Regular.woff');
  const interBold = readAsset('fonts', 'Inter-Bold.woff');

  const fonts = [];
  if (barlowBold) fonts.push({ name: 'BarlowCondensed', data: barlowBold, weight: 700, style: 'normal' });
  if (interRegular) fonts.push({ name: 'Inter', data: interRegular, weight: 400, style: 'normal' });
  if (interBold) fonts.push({ name: 'Inter', data: interBold, weight: 700, style: 'normal' });
  return fonts;
}

// Imagem institucional fixa — usada só no slide de encerramento (o último
// do carrossel), sem nenhuma sobreposição de texto de notícia.
function loadClosingImageDataUri() {
  const jpg = readAsset('background.jpg');
  if (jpg) return `data:image/jpeg;base64,${jpg.toString('base64')}`;
  const png = readAsset('background.png');
  if (png) return `data:image/png;base64,${png.toString('base64')}`;
  return null;
}

function loadLogoDataUri() {
  const logo = readAsset('images', 'logo-white.png');
  return logo ? `data:image/png;base64,${logo.toString('base64')}` : null;
}

// Baixa a imagem da própria notícia (URL do RSS) e devolve como data URI,
// pra poder ser embutida direto no SVG sem depender de acesso externo na
// hora de renderizar. Se não tiver imagem, ou o download falhar/demorar
// demais, devolve null — o slide cai no gradiente de marca (ver
// buildNewsSlideNode).
async function fetchNewsImageDataUri(url) {
  if (!url) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), NEWS_IMAGE_FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'THONUSBot/1.0 (+https://thonrus.com.br)' }
    });
    if (!res.ok) return null;

    const contentType = res.headers.get('content-type') || '';
    if (!contentType.startsWith('image/')) return null;

    const buffer = Buffer.from(await res.arrayBuffer());
    return `data:${contentType};base64,${buffer.toString('base64')}`;
  } catch (err) {
    console.warn(`[generate-instagram-post] Falha ao baixar imagem da notícia (${url}): ${err.message}`);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

// Helper tipo hyperscript — satori aceita árvores de nó simples
// (sem precisar de React/JSX): { type, props: { style, children } }.
function h(type, props, ...children) {
  const flat = children
    .flat(Infinity)
    .filter((c) => c !== null && c !== undefined && c !== false);
  return {
    type,
    props: {
      ...props,
      children: flat.length === 1 ? flat[0] : flat
    }
  };
}

function buildNewsSlideNode(item, index, total, { imageDataUri, logoDataUri }) {
  const fontTitleSize = item.title.length > 100 ? 46 : item.title.length > 70 ? 54 : 64;

  return h(
    'div',
    {
      style: {
        width: `${SLIDE_WIDTH}px`,
        height: `${SLIDE_HEIGHT}px`,
        display: 'flex',
        position: 'relative',
        backgroundColor: COLOR_DARK,
        fontFamily: 'Inter',
        ...(imageDataUri
          ? {}
          : { backgroundImage: `linear-gradient(160deg, ${COLOR_PRIMARY} 0%, ${COLOR_DARK} 100%)` })
      }
    },
    imageDataUri &&
      h('img', {
        src: imageDataUri,
        style: {
          position: 'absolute',
          top: 0,
          left: 0,
          width: `${SLIDE_WIDTH}px`,
          height: `${SLIDE_HEIGHT}px`,
          objectFit: 'cover'
        }
      }),
    h('div', {
      style: {
        position: 'absolute',
        top: 0,
        left: 0,
        width: `${SLIDE_WIDTH}px`,
        height: `${SLIDE_HEIGHT}px`,
        display: 'flex',
        backgroundImage:
          'linear-gradient(to top, rgba(10,12,14,0.92) 0%, rgba(10,12,14,0.55) 40%, rgba(10,12,14,0.05) 68%)'
      }
    }),
    h(
      'div',
      {
        style: {
          position: 'absolute',
          top: 0,
          left: 0,
          width: `${SLIDE_WIDTH}px`,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '56px 64px 0'
        }
      },
      logoDataUri
        ? h('img', { src: logoDataUri, style: { height: '48px' } })
        : h(
            'div',
            {
              style: {
                display: 'flex',
                fontFamily: 'BarlowCondensed',
                fontSize: '34px',
                fontWeight: 700,
                color: '#fff',
                letterSpacing: '2px'
              }
            },
            'THONUS'
          ),
      h(
        'div',
        {
          style: {
            display: 'flex',
            alignItems: 'center',
            padding: '8px 22px',
            borderRadius: '999px',
            backgroundColor: 'rgba(255,255,255,0.14)',
            color: '#fff',
            fontSize: '24px',
            fontFamily: 'Inter',
            fontWeight: 700
          }
        },
        `${index + 1}/${total}`
      )
    ),
    h(
      'div',
      {
        style: {
          position: 'absolute',
          left: 0,
          bottom: 0,
          width: `${SLIDE_WIDTH}px`,
          display: 'flex',
          flexDirection: 'column',
          gap: '24px',
          padding: '0 64px 72px'
        }
      },
      h(
        'div',
        {
          style: {
            display: 'flex',
            alignSelf: 'flex-start',
            padding: '10px 26px',
            borderRadius: '999px',
            backgroundColor: COLOR_PRIMARY,
            color: '#fff',
            fontSize: '26px',
            fontFamily: 'Inter',
            fontWeight: 700,
            letterSpacing: '0.5px'
          }
        },
        item.source.toUpperCase()
      ),
      h(
        'div',
        {
          style: {
            display: 'flex',
            fontFamily: 'BarlowCondensed',
            fontWeight: 700,
            color: '#fff',
            fontSize: `${fontTitleSize}px`,
            lineHeight: 1.15,
            letterSpacing: '-1px'
          }
        },
        item.title
      ),
      h(
        'div',
        {
          style: {
            display: 'flex',
            fontFamily: 'Inter',
            fontSize: '22px',
            color: 'rgba(255,255,255,0.75)'
          }
        },
        SITE_URL
      )
    )
  );
}

// Slide de encerramento: só a imagem institucional, sem nenhuma
// sobreposição — nem título, nem selo, nem logo, nem contador.
function buildClosingSlideNode(imageDataUri) {
  return h(
    'div',
    {
      style: {
        width: `${SLIDE_WIDTH}px`,
        height: `${SLIDE_HEIGHT}px`,
        display: 'flex',
        position: 'relative'
      }
    },
    h('img', {
      src: imageDataUri,
      style: {
        width: `${SLIDE_WIDTH}px`,
        height: `${SLIDE_HEIGHT}px`,
        objectFit: 'cover'
      }
    })
  );
}

async function renderSlidePng(node, fonts, satoriFn, Resvg) {
  const svg = await satoriFn(node, { width: SLIDE_WIDTH, height: SLIDE_HEIGHT, fonts });
  const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: SLIDE_WIDTH } });
  return resvg.render().asPng();
}

function numberEmoji(n) {
  const map = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣'];
  return map[n - 1] || `${n}.`;
}

function buildCaption(items) {
  const lines = items.map((item, i) => `${numberEmoji(i + 1)} ${item.title} (${item.source})`);
  return [
    '📰 Resumo do dia — Engenharia, Construção & Energia',
    '',
    ...lines,
    '',
    `Matérias completas com o link de origem: ${SITE_URL}`,
    '',
    '#Engenharia #Construção #BIM #EngenhariaCivil #Goiânia #ProjetosDeEngenharia'
  ].join('\n');
}

// Lógica principal, exportada à parte pra poder ser chamada tanto pelo
// cron (exports.handler abaixo) quanto pelo endpoint manual
// (netlify/functions/trigger-instagram-post.js — botão "gerar agora"
// do instagram/painel.html).
async function runGeneration() {
  // satori/@resvg-js podem publicar como ESM — import() dinâmico funciona
  // pra CJS e ESM, então evita depender do formato exato do pacote.
  const satoriModule = await import('satori');
  const satoriFn = satoriModule.default || satoriModule;
  const resvgModule = await import('@resvg/resvg-js');
  const Resvg = resvgModule.Resvg || resvgModule.default.Resvg;

  const fonts = loadFonts();
  if (!fonts.length) {
    console.error('[generate-instagram-post] Nenhuma fonte encontrada em instagram/assets/fonts — abortando.');
    return { ok: false, reason: 'missing-fonts' };
  }

  const newsStore = getStore({
    name: 'news',
    siteID: process.env.BLOBS_SITE_ID,
    token: process.env.BLOBS_TOKEN
  });
  const news = await newsStore.get('latest.json', { type: 'json' });
  const items = (news && Array.isArray(news.items) ? news.items : []).slice(0, MAX_NEWS_SLIDES);

  if (!items.length) {
    console.log('[generate-instagram-post] Sem notícias disponíveis hoje — nada gerado.');
    return { ok: false, reason: 'no-news' };
  }

  const closingImageDataUri = loadClosingImageDataUri();
  const logoDataUri = loadLogoDataUri();
  const totalSlides = items.length + (closingImageDataUri ? 1 : 0);

  const postStore = getStore({
    name: 'instagram-posts',
    siteID: process.env.BLOBS_SITE_ID,
    token: process.env.BLOBS_TOKEN
  });

  // Baixa as imagens das notícias em paralelo — cada uma tem timeout
  // próprio, então isso não vira uma soma sequencial de espera.
  const newsImageDataUris = await Promise.all(items.map((item) => fetchNewsImageDataUri(item.image)));

  const slides = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const node = buildNewsSlideNode(item, i, totalSlides, {
      imageDataUri: newsImageDataUris[i],
      logoDataUri
    });
    const png = await renderSlidePng(node, fonts, satoriFn, Resvg);
    await postStore.set(`slide-${i + 1}.png`, new Blob([png]));
    slides.push({ index: i + 1, type: 'news', title: item.title, source: item.source, url: item.link });
  }

  if (closingImageDataUri) {
    const closingIndex = items.length + 1;
    const node = buildClosingSlideNode(closingImageDataUri);
    const png = await renderSlidePng(node, fonts, satoriFn, Resvg);
    await postStore.set(`slide-${closingIndex}.png`, new Blob([png]));
    slides.push({ index: closingIndex, type: 'closing' });
  }

  const generatedAt = new Date().toISOString();
  await postStore.setJSON('latest.json', {
    generatedAt,
    totalSlides: slides.length,
    caption: buildCaption(items),
    slides
  });

  console.log(`[generate-instagram-post] ${slides.length} slide(s) gerado(s) a partir de ${items.length} notícia(s) do dia.`);
  return { ok: true, generatedAt, totalSlides: slides.length };
}

exports.runGeneration = runGeneration;

exports.handler = async () => {
  await runGeneration();
};
