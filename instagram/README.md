# Instagram — carrossel semi-automático a partir do blog

Reaproveita o agregador de notícias que já roda pro blog (`netlify/functions/fetch-news-background.js`)
pra gerar todo dia um carrossel pronto pra postar no Instagram manualmente. Não publica sozinho —
só gera as imagens + legenda; você revisa e sobe pelo app.

## Como funciona (pipeline)

1. **00h00 BRT** — `fetch-news-background.js` já roda hoje e atualiza as notícias do blog.
2. **00h15 BRT** — `generate-instagram-post.js` (novo) pega até as 5 notícias mais recentes,
   gera uma imagem 1080x1350 por notícia (fundo fixo + título sobreposto + fonte + logo) e uma
   legenda, e grava tudo no Netlify Blobs (store `instagram-posts`).
3. Você abre **`/instagram/painel.html`** no site publicado, revisa as imagens, baixa cada uma
   e copia a legenda com um clique. Sobe pro Instagram pelo app normalmente.

Se num dia o agregador trouxer menos de 5 notícias, o carrossel sai com o que tiver (nunca pula o dia).

## O que você precisa fazer

### 1. Trocar a imagem de fundo

Coloque o arquivo definitivo em:

```
instagram/assets/background.jpg
```

(ou `.png`, se preferir). Recomendado: **1080 x 1350px** (proporção 4:5) — se vier em outra proporção,
a imagem é cortada pra preencher o quadro (`object-fit: cover`), então evite fotos com elementos
importantes muito perto das bordas.

Enquanto esse arquivo não existir, a geração usa automaticamente um fundo com gradiente nas cores
da marca (`--color-primary` / `--color-dark` do `css/style.css`), só pra nunca travar o pipeline.

### 2. Ajustar o texto da legenda (opcional)

O template da legenda fica na função `buildCaption()` em
`netlify/functions/generate-instagram-post.js` — dá pra editar a introdução, a chamada final
e as hashtags diretamente ali.

### 3. Conferir o resultado

Depois do primeiro deploy, espere o cron rodar (ou dispare manualmente com
`netlify functions:invoke generate-instagram-post` via Netlify CLI) e acesse
`https://<seu-site>/instagram/painel.html`.

## Por que não publica direto no Instagram (v1)

Publicar via API exige: conta Business/Creator vinculada a uma Página do Facebook, um App no
Meta for Developers, e um **token que expira a cada 60 dias** — mais uma peça de manutenção
recorrente, no mesmo estilo do token do Netlify Blobs (ver `manutenção/renovacao-token-blobs.txt`).
Preferimos manter simples: gerar tudo pronto e você posta manualmente em 1 minuto. Se depois fizer
sentido automatizar a publicação, dá pra plugar a Graph API por cima dessa mesma geração de imagem,
sem jogar nada fora.

## Créditos das notícias

O nome da fonte aparece em cada card. O link original de cada notícia fica registrado nos
metadados gerados e é exibido no painel (`instagram/painel.html`) — não vai na legenda do
Instagram porque a plataforma não permite link clicável em legenda.

## Arquivos deste diretório

```
instagram/
├── README.md              este arquivo
├── painel.html             painel de revisão/download (sem link no menu do site, noindex)
├── assets/
│   ├── background.jpg      (você adiciona) imagem de fundo fixa dos cards
│   ├── fonts/               fontes usadas no card (mesmas do site: Barlow Condensed + Inter)
│   └── images/logo-white.png  cópia do logo (bundlada junto com a function via included_files)
└── output/                  pasta livre pra testes/exports manuais, se precisar
```
