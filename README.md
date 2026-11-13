# NADA Clock

**No Ads, Display Always** — um relógio de mesa minimalista e sem anúncios para iPhone e Android.

Funciona como um app instalado na Tela de Início (PWA): tela cheia, tela sempre ligada, funciona offline.

## Funcionalidades (v0.8.3)

- Quatro abas: **Relógio**, **Timer**, **Cronômetro** e **Pomodoro** — troque pela barra do topo (aparece com um toque) ou deslizando para o lado
- **Timer**: vários ao mesmo tempo, com nome (ex.: "macarrão", "forno")
- **Pomodoro**: foco, pausa curta e pausa longa a cada N focos, com durações configuráveis e início automático opcional
- Troca rápida **digital ⇄ analógico** pelo botão na barra do topo
- **Timer**: ajuste de horas/minutos/segundos (segure para repetir), atalhos (1–60 min), pausa, +1 min e alarme; continua certo em segundo plano
- **Cronômetro**: voltas (parcial e total), pausa e zerar; o estado fica salvo
- Relógio **digital** (12/24h, segundos, dois-pontos piscando, 6 fontes incluindo **LED de 7 segmentos**, estilo **plaquinha/flip**) ou **analógico** — as opções valem para os dois mostradores
- **Barra de controle** (aparece com um toque): girar, **mostradores** (Minimalista digital, Minimalista analógico, Customizado, Interativo), editar a tela, abas, bloquear e configurações
- **Menu circular**: segure a tela (em qualquer aba e mostrador) e um anel de opções abre em volta do dedo
  - Rápido: sem soltar, deslize na direção da opção e solte. Calmo: solte no meio e toque na opção; o ✕ fecha
  - Com o menu aberto (modo calmo): segure fora dele e o menu vem até o dedo no modo rápido; ou encoste no centro e arraste
  - No modo rápido, pare um instante sobre uma opção com › e o submenu abre ali mesmo, sem soltar
  - Editar item (só no Interativo), Mostradores ›, Ferramentas › (Relógio, Timer, Cronômetro, Pomodoro), Brilho › (anel de girar), Noturno › (Programado, Ligado agora, Desligado agora), Bloquear, Girar, Ajustes
  - "Ligado agora" vale até o fim do horário noturno; "Desligado agora", até o próximo início
- Mostrador **Minimalista** (digital ou analógico): relógio + dia e data (acima ou abaixo, coladinhos no relógio)
- Mostrador **Customizado**: 11 posições (bordas de cima e de baixo, logo acima/abaixo do relógio e laterais)
  - Arraste uma posição sobre outra para trocar — inclusive o relógio, que pode ir para qualquer lugar
  - Componentes: dia + data, dia da semana, data, temperatura, outro fuso, progresso (dia/semana/mês/ano), fase da lua, nascer/pôr do sol, contagem até uma data, texto livre
  - **Presets**: salve e reaplique layouts
  - Texto livre com placeholders: `{HH} {hh} {mm} {ss} {ampm} {weekday} {wd} {day} {month} {monthName} {mon} {year} {date} {temp} {weather} {feels} {tmax} {tmin} {humidity} {rain}`
  - Cores personalizadas: fundo, principal e uma cor para horas, minutos e segundos
- Mostrador **Interativo (beta)**, o padrão: monte a tela à mão, direto no relógio
  - Na edição, a tela aparece reduzida e as opções ficam numa gaveta ao lado (deitado) ou embaixo (em pé), sem cobrir nada
  - Toque no lápis da barra (ou em Configurações → Editar a tela), ou segure um elemento e escolha **Editar item** no menu circular
  - **＋ Adicionar** qualquer componente (inclusive mais de um relógio) e arraste para onde quiser
  - "Ímã": o elemento gruda no centro, nas margens e no alinhamento dos outros, com linhas-guia
  - Cada elemento tem tamanho (barra, −/+ ou pinça com dois dedos), cor, opacidade, alinhamento e fonte próprios, além das opções do tipo (fuso, texto, relógio digital/analógico…)
  - Duplicar, trazer para a frente, remover; setas do teclado movem, Delete remove
  - Layouts separados para a tela deitada e em pé; **Padrão** volta ao layout inicial
- 7 paletas: **Sistema** (padrão; segue o modo claro/escuro do aparelho), Terminal, Âmbar, Neve, Gelo, Noturno e Papel (clara)
- **Restaurar padrão** nas configurações
- **Backup**: exportar e importar todas as configurações (arquivo JSON, sem a localização)
- **Compartilhar presets** por link ou QR code (o layout vai codificado no próprio link, sem servidor)
- **Bloqueio de toques**: cadeado na barra; toque e segure para desbloquear
- **Modo espelho** (reflexo no vidro / HUD de carro)
- **Modo noturno**: cor vermelha opcional e brilho reduzido no horário escolhido
- **Ícone do tempo** junto da temperatura
- **Forçar horizontal**: gira o app mesmo com a rotação do aparelho travada (botão na barra do topo), com transição e escolha do lado da câmera; os seletores das configurações giram junto
- **Sons**: a cada segundo (tic-tac), minuto, hora (com opção de repetir conforme a hora) e personalizado (a cada X minutos ou no minuto X), com volume e silêncio no modo noturno
- Relógio analógico com números das horas e/ou dos minutos, marcas de cada minuto e ponteiro de segundos deslizante
- Fonte arredondada como padrão
- Menu de configurações claro ou escuro (automático acompanha o relógio)
- Linha discreta com dia da semana, data e temperatura (opcionais)
- **Tela sempre ligada** (Wake Lock)
- **Brilho**: deslize para cima/baixo na tela
- **Toque** mostra a barra de controle (girar, abas, configurações), que some sozinha em ~3 s
- **Procurar atualização** nas configurações (e aviso automático quando sai versão nova)
- **Modo noturno** automático por horário (cor vermelha escura)
- **Proteção contra burn-in**: o relógio se move alguns pixels a cada minuto
- **Localização** em três modos: precisa (GPS, com permissão), aproximada pela internet (IP, sem permissão, via [GeoJS](https://www.geojs.io/)) ou cidade escolhida (busca do [Open-Meteo](https://open-meteo.com/en/docs/geocoding-api))
- **Temperatura** (opcional) via [Open-Meteo](https://open-meteo.com) (CC BY 4.0), com °C/°F, **condição do tempo** ("17°C, chuva forte") e horário da última atualização
  - No Customizado: sensação térmica, máxima/mínima do dia, umidade, chance de chuva e vento
  - Placeholders: `{weather} {feels} {tmax} {tmin} {humidity} {rain}`
- **Nascer/pôr do sol** calculado no próprio aparelho
- Idiomas: **Português (Brasil)**, **English (US)** e **Español**, com detecção automática
- Páginas **Sobre** com instruções de instalação e perguntas frequentes: [Português](https://ofeliper.github.io/nada-clock/sobre/) · [English](https://ofeliper.github.io/nada-clock/about/) · [Español](https://ofeliper.github.io/nada-clock/acerca/)
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
4. Para usar na horizontal com a rotação travada, toque na tela e use o botão de girar na barra do topo.

## Instalar no Android

Abra o endereço no Chrome → menu ⋮ → **Instalar app** (ou *Adicionar à tela inicial*).

## Publicar uma nova versão

Ao alterar arquivos, aumente `CACHE_VERSION` em `sw.js` (ex.: `nada-clock-v0.7.1`) e `VERSION` em `js/settings.js`. Assim os aparelhos baixam os arquivos novos.

## Estrutura

```
index.html              página principal
manifest.webmanifest    dados para instalar como app
sw.js                   service worker (offline)
css/style.css           visual e paletas
js/app.js               início, gestos, brilho, wake lock, burn-in, modo noturno
js/faces.js             motor da grade 3x3 (Minimalista e Customizado)
js/free.js              mostrador Interativo: elementos livres e editor na tela
js/radial.js            menu circular (segurar a tela)
js/components.js        componentes (relógios, data, fuso, progresso, lua, contagem, texto)
js/tokens.js            placeholders do texto livre
js/themes.js            paletas e modo Sistema
js/sound.js             sons sintetizados (Web Audio)
js/timer.js             abas Timer e Cronômetro
js/picker.js            seletor próprio (substitui o select nativo)
js/update.js            atualizações do app (service worker)
js/pomodoro.js          aba Pomodoro
js/location.js          localização (GPS, IP ou cidade)
js/share.js             backup e compartilhamento de presets (link e QR code)
js/vendor/qrcode.js     gerador de QR code (qrcode-generator, MIT, Kazuhiko Arase)
js/i18n/es.js           textos em espanhol
sobre/ about/ acerca/   páginas Sobre (HTML estático, geradas por tools/build_about.py)
css/about.css           visual das páginas Sobre
assets/                 prints e imagens de prévia (Open Graph)
sitemap.xml             mapa do site para buscadores
.github/ISSUE_TEMPLATE/ modelos de sugestão e de problema
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
- [x] Relógio Customizado (grade 3x3 com componentes e placeholders, paleta clara, Sistema)
- [x] Timer e Cronômetro
- [x] Localização sem permissão (aproximada por IP ou escolha da cidade)
- [x] Vários presets salvos no Customizado
- [x] Nascer/pôr do sol
- [x] Pomodoro
- [x] Mostrador Interativo (beta): editor na tela com arrastar e soltar
- [ ] Métricas anônimas (ex.: GoatCounter) e domínio próprio — adiados
- [ ] Análise (adiada): app nativo com widget / Live Activity (Dynamic Island) para Timer e Pomodoro

## Sugestões e problemas

Abra uma [issue](https://github.com/ofeliper/nada-clock/issues/new/choose) — há modelos para **sugestão de melhoria** e **relato de problema**.

## Páginas Sobre e SEO

As páginas `sobre/`, `about/` e `acerca/` são geradas a partir dos textos em `tools/build_about.py`:

```bash
python3 tools/build_about.py
```

Depois de publicar, cadastre o site no [Google Search Console](https://search.google.com/search-console) e envie `https://ofeliper.github.io/nada-clock/sitemap.xml`.

## Privacidade e serviços externos

Sem anúncios, sem rastreamento, sem conta. As preferências e a localização (arredondada, ~1 km) ficam salvas só no seu aparelho.
Serviços usados apenas quando você ativa os recursos correspondentes:

- [Open-Meteo](https://open-meteo.com/) — temperatura (CC BY 4.0) e busca de cidades
- [GeoJS](https://www.geojs.io/) — localização aproximada pelo IP
