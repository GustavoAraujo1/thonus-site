# Instagram — carrossel semi-automático a partir do blog

Reaproveita o agregador de notícias que já roda pro blog (`netlify/functions/fetch-news-background.js`)
pra gerar todo dia um carrossel pronto pra postar no Instagram manualmente. Não publica sozinho —
só gera as imagens + legenda; você revisa e sobe pelo app.

## Como funciona (pipeline)

1. **00h00 BRT** — `fetch-news-background.js` já roda hoje e atualiza as notícias do blog.
2. **00h15 BRT** — `generate-instagram-post.js` pega até as 5 notícias mais recentes e monta:
   - **1 slide por notícia**, usando a **imagem da própria notícia** (baixada da URL que já vem
     no RSS) como fundo, com título + fonte sobrepostos. Se a notícia não tiver imagem, ou o
     download falhar, esse slide cai num gradiente com as cores da marca.
   - **1 slide final de encerramento**, sempre com a mesma imagem institucional fixa
     (`instagram/assets/background.*`), **sem nenhum texto de notícia por cima** — só ela, como
     está.
   - Uma legenda pronta.
   Tudo isso é gravado no Netlify Blobs (store `instagram-posts`).
3. Você abre **`/instagram/painel.html`** no site publicado, revisa as imagens, baixa cada uma
   e copia a legenda com um clique. Sobe pro Instagram pelo app normalmente. Tem um botão
   **"gerar agora"** no painel pra disparar a geração na hora, sem esperar o horário do cron.

Se num dia o agregador trouxer menos de 5 notícias, o carrossel sai com o que tiver (nunca pula o dia).

## O que você precisa fazer

### 1. Manter a imagem institucional de encerramento

Coloque o arquivo definitivo em:

```
instagram/assets/background.jpg
```

(ou `.png`, se preferir). Recomendado: **1080 x 1350px** (proporção 4:5) — se vier em outra proporção,
a imagem é cortada pra preencher o quadro (`object-fit: cover`). Essa imagem aparece **só no último
slide do carrossel**, sem nenhuma sobreposição — pode ter texto/CTA própria "gravada" nela, já que
não briga com nada em cima.

Enquanto esse arquivo não existir, o carrossel simplesmente não tem slide de encerramento (só os
slides de notícia).

### 2. Ajustar o texto da legenda (opcional)

O template da legenda fica na função `buildCaption()` em
`netlify/functions/generate-instagram-post.js` — dá pra editar a introdução, a chamada final
e as hashtags diretamente ali.

### 3. Conferir o resultado

Depois do deploy, use o botão **"gerar agora"** no `/instagram/painel.html`, ou espere o cron
das 00h15 BRT.

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
