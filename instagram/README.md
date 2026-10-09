# Instagram — carrossel automático a partir do blog, publicado com 1 clique

Reaproveita o agregador de notícias que já roda pro blog (`netlify/functions/fetch-news-background.js`)
pra gerar todo dia um carrossel. Você revisa no painel e aperta **"publicar no instagram"** — o site
publica no @projeto_thonrus pela API oficial da Meta. Nada vai ao ar sem esse clique.

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
   Tudo isso é gravado no Netlify Blobs (store `instagram-posts`), em **JPEG** (único formato
   que a API de publicação aceita). Se `NTFY_TOPIC` estiver configurado, chega um aviso no celular.
3. Você entra pelo link **"sou parceiro"** no menu do site (ao lado de "seja parceiro" — é o
   disfarce), faz login e cai direto no painel. Lá revisa as imagens, ajusta a legenda se quiser
   e aperta **"publicar no instagram"** (`publish-instagram-post.js`). O painel mostra o link do
   post depois. Baixar/copiar continua lá, pra postar manualmente se preferir. Tem um botão
   **"gerar agora"** pra disparar a geração na hora, sem esperar o cron.
4. **Toda segunda 03:00 BRT** — `refresh-instagram-token.js` renova o token da Meta (vale 60 dias
   e só pode ser renovado enquanto válido; semanal nunca deixa expirar). O token renovado fica no
   Blobs (store `instagram-auth`).

Se num dia o agregador trouxer menos de 5 notícias, o carrossel sai com o que tiver (nunca pula o dia).

## Login (obrigatório antes de usar)

O painel e as functions que ele usa (`get-instagram-post`, `get-instagram-image`,
`trigger-instagram-post`, `publish-instagram-post`) só respondem com uma sessão válida — sem isso, é tudo `401`. A sessão
vem de um cookie assinado (HMAC), sem banco de dados (ver `netlify/functions/lib/auth.js`).

**Antes de usar pela primeira vez, configure 3 variáveis de ambiente no painel da Netlify**
(Site settings → Environment variables):

| Variável                 | O que é                                                             |
|---------------------------|----------------------------------------------------------------------|
| `PARTNER_USER`             | usuário de login que você escolher                                   |
| `PARTNER_PASSWORD`         | senha de login que você escolher                                     |
| `PARTNER_SESSION_SECRET`   | uma string aleatória longa, só pra assinar o cookie (não é login)    |

Sem essas 3 variáveis configuradas, o login sempre falha (`not-configured`). A sessão dura 7 dias
(`SESSION_MAX_AGE_SECONDS` em `lib/auth.js`) — depois disso, pede login de novo.

**Fluxo:** menu → "sou parceiro" → `instagram/login.html` → login correto → redireciona pra
`instagram/painel.html`. Botão "sair" no painel limpa a sessão.

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

## Publicação pela API (configurar uma vez)

Usa a "Instagram API with Instagram Login" — não precisa de Página do Facebook, só da conta
@projeto_thonrus como **Comercial** (já é).

1. Em [developers.facebook.com](https://developers.facebook.com/apps) → **Criar app** → caso de uso
   **"Gerenciar mensagens e conteúdo no Instagram"** → tipo **Empresa**.
2. No app: **Instagram → Configuração da API com login do Instagram → Gerar tokens de acesso →
   Adicionar conta**, entre com o @projeto_thonrus e aceite as permissões
   (`instagram_business_basic`, `instagram_business_content_publish`). Se o Instagram pedir, aceite o
   convite de testador em *Configurações → Apps e sites*. Copie o token gerado (é o de 60 dias).
   O app pode ficar em modo **Desenvolvimento** — ele só publica na própria conta.
3. Na Netlify → *Site settings → Environment variables*:

   | Variável          | O que é                                                                   |
   |-------------------|---------------------------------------------------------------------------|
   | `IG_ACCESS_TOKEN` | o token do passo 2 (só o inicial — a renovação semanal cuida do resto)     |
   | `NTFY_TOPIC`      | opcional: nome longo e aleatório; instale o app **ntfy** e assine esse tópico pra receber o aviso diário |

4. Faça um deploy, abra o painel, **gerar agora** → **publicar no instagram**.

**Se um dia der erro de token** (ex.: a renovação falhou por mais de 60 dias): gere um token novo
no passo 2 e troque o `IG_ACCESS_TOKEN` na Netlify — o código percebe a troca e passa a usar o novo.

**Como a Meta baixa as imagens:** o painel é protegido por login, então na hora de publicar o site
gera um token curto (1h) que libera só as imagens dos slides (`?t=` em `/api/instagram/image`).
Esse token não serve como login (ver `createMediaToken` em `netlify/functions/lib/auth.js`).

**Teste da lógica de publicação** (sem chamar a Meta): `node --test netlify/functions/lib/instagram.test.js`

## Créditos das notícias

O nome da fonte aparece em cada card. O link original de cada notícia fica registrado nos
metadados gerados e é exibido no painel (`instagram/painel.html`) — não vai na legenda do
Instagram porque a plataforma não permite link clicável em legenda.

## Arquivos deste diretório

```
instagram/
├── README.md              este arquivo
├── login.html              tela de login ("sou parceiro" no menu), noindex
├── painel.html             painel de revisão/download, protegido por sessão, noindex
├── assets/
│   ├── background.jpg      (você adiciona) imagem do slide de encerramento
│   ├── fonts/               fontes usadas no card (mesmas do site: Barlow Condensed + Inter)
│   └── images/logo-white.png  cópia do logo (bundlada junto com a function via included_files)
└── output/                  pasta livre pra testes/exports manuais, se precisar
```

Lógica de login: `netlify/functions/lib/auth.js` (sessão), `partner-login.js`, `partner-check.js`,
`partner-logout.js`.
