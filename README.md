# NADA Clock

**No Ads, Display Always** — um relógio de mesa minimalista e sem anúncios para iPhone e Android.

Funciona como um app instalado na Tela de Início (PWA): tela cheia, tela sempre ligada, funciona offline.

## Funcionalidades (v0.1.0)

- Mostrador **Minimalista**: `HH:MM:SS` em 24h, fundo preto (ideal para OLED)
- 5 cores: Terminal (verde), Âmbar, Neve, Gelo, Noturno
- Linha discreta com dia da semana, data e temperatura (opcionais)
- **Tela sempre ligada** (Wake Lock)
- **Brilho**: deslize para cima/baixo na tela
- **Toque** mostra o botão de configurações, que some sozinho em ~3 s
- **Modo noturno** automático por horário (cor vermelha escura)
- **Proteção contra burn-in**: o relógio se move alguns pixels a cada minuto
- **Temperatura** (opcional) via [Open-Meteo](https://open-meteo.com), com °C/°F e horário da última atualização
- Idiomas: **Português (Brasil)** e **English (US)**, com detecção automática
- Formatos de data: automático, DD/MM/AAAA, MM/DD/AAAA, ISO, por extenso, com escolha do separador

## Publicar no GitHub Pages

1. No GitHub, crie um repositório **público** chamado `nada-clock`.
2. Clique em **Add file → Upload files** e arraste **o conteúdo** desta pasta (o `index.html` precisa ficar na raiz do repositório, não dentro de uma subpasta). Clique em **Commit changes**.
3. Vá em **Settings → Pages**. Em *Build and deployment*, escolha **Deploy from a branch**, branch **main**, pasta **/ (root)** e clique em **Save**.
4. Em 1–2 minutos o site fica no ar em `https://SEU-USUARIO.github.io/nada-clock/`.

## Instalar no iPhone

1. Abra o endereço no **Safari**.
2. Toque em **Compartilhar → Adicionar à Tela de Início**.
3. Abra pelo ícone da Tela de Início (é assim que a tela sempre ligada funciona no iPhone, iOS 18.4+).
4. Desative o bloqueio de rotação na Central de Controle para usar na horizontal.

## Instalar no Android

Abra o endereço no Chrome → menu ⋮ → **Instalar app** (ou *Adicionar à tela inicial*).

## Publicar uma nova versão

Ao alterar arquivos, aumente `CACHE_VERSION` em `sw.js` (ex.: `nada-clock-v0.1.1`) e `VERSION` em `js/settings.js`. Assim os aparelhos baixam os arquivos novos.

## Estrutura

```
index.html              página principal
manifest.webmanifest    dados para instalar como app
sw.js                   service worker (offline)
css/style.css           visual e paletas
js/app.js               início, gestos, brilho, wake lock, burn-in, modo noturno
js/faces.js             motor da grade 3x3 e componentes (relógio, linha de informações)
js/settings.js          painel de configurações
js/weather.js           temperatura (Open-Meteo)
js/store.js             preferências salvas no aparelho
js/i18n.js              idiomas e formatação de datas
js/i18n/pt-BR.js        textos em português
js/i18n/en-US.js        textos em inglês
icons/                  ícones do app
```

## Testar no computador

```bash
python3 -m http.server 8000
# abra http://localhost:8000
```

## Roadmap

- [x] Relógio Minimalista
- [ ] Relógio Customizado (grade 3x3 com componentes e placeholders, 6ª paleta clara)
- [ ] Timer e Cronômetro
- [ ] Pomodoro

## Privacidade

Sem anúncios, sem rastreamento, sem conta. As preferências e a localização aproximada (para a temperatura) ficam salvas só no seu aparelho.
