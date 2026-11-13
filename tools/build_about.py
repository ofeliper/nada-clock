#!/usr/bin/env python3
"""Gera as páginas Sobre (pt/en/es) e o sitemap.xml a partir dos textos abaixo.

Uso:  python3 tools/build_about.py
As páginas são HTML estático (bom para SEO): sobre/index.html, about/index.html, acerca/index.html.
"""
import html, json, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
BASE = "https://ofeliper.github.io/nada-clock/"
REPO = "https://github.com/ofeliper/nada-clock"
VERSION = "0.9.0"

PAGES = {
    "pt": {"dir": "sobre", "lang": "pt-BR", "og_locale": "pt_BR", "label": "Português"},
    "en": {"dir": "about", "lang": "en", "og_locale": "en_US", "label": "English"},
    "es": {"dir": "acerca", "lang": "es", "og_locale": "es_ES", "label": "Español"},
}

T = {
"pt": {
  "title": "NADA Clock — relógio de mesa para celular, sem anúncios",
  "description": "Transforme seu iPhone ou Android num relógio de mesa minimalista: tela sempre ligada, nada por cima do relógio, grátis e sem cadastro. Digital ou analógico, com timer, cronômetro e pomodoro.",
  "skip": "Pular para o conteúdo",
  "open": "Abrir o relógio", "howto": "Como instalar",
  "h1": "Seu celular como relógio de mesa.<br>Sem anúncios.",
  "lead": "O <strong>NADA Clock</strong> (<em>No Ads, Display Always</em>) é um relógio de mesa minimalista para iPhone e Android. A tela fica ligada e nada aparece por cima do relógio. Grátis, sem cadastro e sem passar pela loja de apps.",
  "hero_alt": "NADA Clock na horizontal: 10:09:30 em verde sobre fundo preto, com dia, data e temperatura acima",
  "why_h": "Por que ele existe",
  "why": ["Os apps de relógio de mesa que encontrei tinham anúncios e, em algum momento, o anúncio aparecia justamente por cima do relógio.",
          "O NADA Clock nasceu para ser o contrário: só o tempo na tela. É um projeto pessoal, de código aberto, feito para uso próprio e compartilhado com quem quiser usar."],
  "install_h": "Como instalar",
  "install_intro": "Não precisa de App Store nem de Play Store. Você adiciona o relógio à tela de início pelo navegador e ele passa a abrir como um app: em tela cheia e funcionando offline.",
  "ios_h": "iPhone (Safari)",
  "ios": ["Abra <a href=\"{base}\">{base_short}</a> no <strong>Safari</strong>.",
          "Toque em <strong>Compartilhar</strong> (o quadrado com a seta para cima).",
          "Escolha <strong>Adicionar à Tela de Início</strong> e confirme.",
          "Abra o NADA Clock pelo ícone. A tela fica ligada enquanto o relógio estiver aberto (iOS 18.4 ou mais recente)."],
  "android_h": "Android (Chrome)",
  "android": ["Abra <a href=\"{base}\">{base_short}</a> no <strong>Chrome</strong>.",
              "Toque no menu <strong>⋮</strong> e escolha <strong>Instalar app</strong> (ou <em>Adicionar à tela inicial</em>).",
              "Abra o NADA Clock pelo ícone."],
  "tips": ["<strong>Rotação travada?</strong> Toque na tela e use o botão de girar na barra do topo para ver o relógio na horizontal.",
           "<strong>Bateria:</strong> com a tela sempre ligada, o ideal é deixar o celular no carregador."],
  "features_h": "O que ele faz",
  "features": [
    ("Digital ou analógico", "Fonte arredondada, LED de 7 segmentos ou plaquinhas que viram (flip). Formato 12 h ou 24 h e segundos opcionais. Um toque troca entre digital e analógico."),
    ("Tela sempre ligada", "Brilho ajustado deslizando o dedo para cima e para baixo. Modo noturno por horário, com vermelho escuro e brilho reduzido."),
    ("Mostrador do seu jeito", "Onze posições ao redor do relógio para data, temperatura, outro fuso, fase da lua, nascer e pôr do sol, contagem regressiva ou texto livre. Arraste para reorganizar, salve presets e compartilhe por link ou QR code."),
    ("Clima", "Temperatura e condição do tempo (“22 °C, parcialmente nublado”), sensação térmica, máxima e mínima e chance de chuva."),
    ("Timer, cronômetro e pomodoro", "Vários timers ao mesmo tempo, com nome. Cronômetro com voltas. Pomodoro com ciclos de foco e pausas."),
    ("Feito para ficar na mesa", "Proteção contra burn-in, bloqueio de toques, horizontal forçada, modo espelho e sons opcionais de tic-tac e de hora cheia."),
  ],
  "more": "Funciona offline, em português, inglês e espanhol, e tem backup das configurações.",
  "gallery_h": "Veja como fica",
  "gallery": [
    ("clock-analog", "Analógico com números e marcas de minuto"),
    ("clock-flip", "Plaquinhas (flip) na cor âmbar"),
    ("clock-led", "LED de 7 segmentos na cor noturna"),
    ("custom", "Mostrador personalizado: lua, clima, outro fuso, sol e progresso do dia"),
    ("timers", "Vários timers com nome"),
    ("pomodoro", "Pomodoro"),
  ],
  "privacy_h": "Privacidade",
  "privacy": ["Sem anúncios, sem conta e sem rastreamento. Suas preferências ficam salvas só no seu aparelho.",
              "Serviços externos são usados apenas quando você ativa o recurso correspondente: <a href=\"https://open-meteo.com/\">Open-Meteo</a> (clima, licença CC BY 4.0, e busca de cidades) e <a href=\"https://www.geojs.io/\">GeoJS</a> (localização aproximada pelo endereço IP). A localização é arredondada (~1 km) e não sai do seu aparelho, exceto nessas consultas."],
  "faq_h": "Perguntas frequentes",
  "faq": [
    ("Preciso baixar na App Store ou na Play Store?", "Não. O NADA Clock é um web app (PWA): você o adiciona à tela de início pelo navegador e ele funciona como um app, em tela cheia e offline."),
    ("É grátis?", "Sim, sem anúncios e sem compras. O código é aberto, sob a licença MIT."),
    ("Por que a tela apaga no iPhone?", "Manter a tela ligada exige iOS 18.4 ou mais recente e que o relógio seja aberto pelo ícone da tela de início, não por uma aba do Safari."),
    ("O alarme toca com o app fechado?", "Não. Por ser um web app, o timer, o pomodoro e os sons só tocam com o relógio aberto na tela."),
    ("Por que a temperatura não aparece?", "Ela precisa de uma localização: GPS (com permissão), aproximada pela internet (sem permissão) ou uma cidade escolhida. Defina em Configurações → Localização."),
    ("Como atualizo para a versão mais nova?", "Em Configurações → Geral, toque em “Procurar atualização”. Quando sai uma versão nova, o próprio relógio também mostra um aviso."),
  ],
  "suggest_h": "Sugestões e problemas",
  "suggest": "Tem uma ideia ou encontrou um problema? Abra uma <em>issue</em> no GitHub (é preciso ter uma conta gratuita).",
  "btn_feature": "Sugerir melhoria", "btn_bug": "Relatar problema", "btn_code": "Ver o código",
  "footer": "Código aberto (MIT)",
  "lang_label": "Idioma",
},
"en": {
  "title": "NADA Clock — ad-free desk clock for your phone",
  "description": "Turn your iPhone or Android into a minimal desk clock: screen always on, nothing covering the time, free and no sign-up. Digital or analog, with timer, stopwatch and Pomodoro.",
  "skip": "Skip to content",
  "open": "Open the clock", "howto": "How to install",
  "h1": "Your phone as a desk clock.<br>No ads.",
  "lead": "<strong>NADA Clock</strong> (<em>No Ads, Display Always</em>) is a minimal desk clock for iPhone and Android. The screen stays on and nothing ever covers the time. Free, no sign-up, no app store.",
  "hero_alt": "NADA Clock in landscape: 10:09:30 in green on a black background, with day, date and temperature above",
  "why_h": "Why it exists",
  "why": ["The desk clock apps I found all had ads, and at some point the ad would show up right on top of the clock.",
          "NADA Clock was made to be the opposite: just the time on screen. It's a personal, open-source project, built for my own use and shared with anyone who wants it."],
  "install_h": "How to install",
  "install_intro": "No App Store or Play Store needed. You add the clock to your home screen from the browser and it opens like an app: full screen and working offline.",
  "ios_h": "iPhone (Safari)",
  "ios": ["Open <a href=\"{base}\">{base_short}</a> in <strong>Safari</strong>.",
          "Tap <strong>Share</strong> (the square with an up arrow).",
          "Choose <strong>Add to Home Screen</strong> and confirm.",
          "Open NADA Clock from its icon. The screen stays on while the clock is open (iOS 18.4 or later)."],
  "android_h": "Android (Chrome)",
  "android": ["Open <a href=\"{base}\">{base_short}</a> in <strong>Chrome</strong>.",
              "Tap the <strong>⋮</strong> menu and choose <strong>Install app</strong> (or <em>Add to Home screen</em>).",
              "Open NADA Clock from its icon."],
  "tips": ["<strong>Rotation locked?</strong> Tap the screen and use the rotate button in the top bar to see the clock in landscape.",
           "<strong>Battery:</strong> with the screen always on, it's best to keep your phone on the charger."],
  "features_h": "What it does",
  "features": [
    ("Digital or analog", "Rounded font, 7-segment LED or flip cards. 12- or 24-hour format, optional seconds. One tap switches between digital and analog."),
    ("Screen always on", "Swipe up and down to adjust brightness. Scheduled night mode with dark red and dimmed brightness."),
    ("A face your way", "Eleven positions around the clock for date, temperature, another time zone, moon phase, sunrise and sunset, countdown or free text. Drag to rearrange, save presets and share them by link or QR code."),
    ("Weather", "Temperature and condition (“72 °F, partly cloudy”), feels-like, today's high and low, and chance of rain."),
    ("Timer, stopwatch and Pomodoro", "Several named timers at once. Stopwatch with laps. Pomodoro with focus cycles and breaks."),
    ("Made for your desk", "Burn-in protection, touch lock, forced landscape, mirror mode and optional tick-tock and hourly chimes."),
  ],
  "more": "Works offline, in English, Portuguese and Spanish, and backs up your settings.",
  "gallery_h": "See it in action",
  "gallery": [
    ("clock-analog", "Analog with hour numbers and minute marks"),
    ("clock-flip", "Flip cards in amber"),
    ("clock-led", "7-segment LED in night red"),
    ("custom", "Custom face: moon, weather, another time zone, sun and day progress"),
    ("timers", "Several named timers"),
    ("pomodoro", "Pomodoro"),
  ],
  "privacy_h": "Privacy",
  "privacy": ["No ads, no account, no tracking. Your preferences are stored only on your device.",
              "External services are used only when you turn on the related feature: <a href=\"https://open-meteo.com/\">Open-Meteo</a> (weather, CC BY 4.0 license, and city search) and <a href=\"https://www.geojs.io/\">GeoJS</a> (approximate location from your IP address). Your location is rounded (~1 km) and never leaves your device except for those lookups."],
  "faq_h": "Frequently asked questions",
  "faq": [
    ("Do I need to download it from the App Store or Play Store?", "No. NADA Clock is a web app (PWA): you add it to your home screen from the browser and it works like an app, full screen and offline."),
    ("Is it free?", "Yes, with no ads and no purchases. The code is open source under the MIT license."),
    ("Why does my iPhone screen turn off?", "Keeping the screen on requires iOS 18.4 or later, and the clock must be opened from its home screen icon, not from a Safari tab."),
    ("Does the alarm ring with the app closed?", "No. As a web app, the timer, Pomodoro and sounds only play while the clock is open on screen."),
    ("Why isn't the temperature showing?", "It needs a location: GPS (with permission), approximate via the internet (no permission) or a city you choose. Set it in Settings → Location."),
    ("How do I update to the latest version?", "In Settings → General, tap “Check for updates”. When a new version comes out, the clock also shows a notice."),
  ],
  "suggest_h": "Suggestions and issues",
  "suggest": "Have an idea or found a problem? Open an <em>issue</em> on GitHub (a free GitHub account is required).",
  "btn_feature": "Suggest an improvement", "btn_bug": "Report a problem", "btn_code": "View the code",
  "footer": "Open source (MIT)",
  "lang_label": "Language",
},
"es": {
  "title": "NADA Clock — reloj de escritorio para el celular, sin anuncios",
  "description": "Convierte tu iPhone o Android en un reloj de escritorio minimalista: pantalla siempre encendida, nada encima de la hora, gratis y sin registro. Digital o analógico, con temporizador, cronómetro y pomodoro.",
  "skip": "Ir al contenido",
  "open": "Abrir el reloj", "howto": "Cómo instalarlo",
  "h1": "Tu celular como reloj de escritorio.<br>Sin anuncios.",
  "lead": "<strong>NADA Clock</strong> (<em>No Ads, Display Always</em>) es un reloj de escritorio minimalista para iPhone y Android. La pantalla queda encendida y nada aparece encima de la hora. Gratis, sin registro y sin pasar por la tienda de apps.",
  "hero_alt": "NADA Clock en horizontal: 10:09:30 en verde sobre fondo negro, con día, fecha y temperatura encima",
  "why_h": "Por qué existe",
  "why": ["Las apps de reloj de escritorio que encontré tenían anuncios y, en algún momento, el anuncio aparecía justo encima del reloj.",
          "NADA Clock nació para ser lo contrario: solo la hora en pantalla. Es un proyecto personal y de código abierto, hecho para uso propio y compartido con quien quiera usarlo."],
  "install_h": "Cómo instalarlo",
  "install_intro": "No necesitas App Store ni Play Store. Agregas el reloj a la pantalla de inicio desde el navegador y se abre como una app: a pantalla completa y sin conexión.",
  "ios_h": "iPhone (Safari)",
  "ios": ["Abre <a href=\"{base}\">{base_short}</a> en <strong>Safari</strong>.",
          "Toca <strong>Compartir</strong> (el cuadrado con la flecha hacia arriba).",
          "Elige <strong>Agregar a inicio</strong> y confirma.",
          "Abre NADA Clock desde el ícono. La pantalla queda encendida mientras el reloj esté abierto (iOS 18.4 o posterior)."],
  "android_h": "Android (Chrome)",
  "android": ["Abre <a href=\"{base}\">{base_short}</a> en <strong>Chrome</strong>.",
              "Toca el menú <strong>⋮</strong> y elige <strong>Instalar app</strong> (o <em>Agregar a la pantalla principal</em>).",
              "Abre NADA Clock desde el ícono."],
  "tips": ["<strong>¿Rotación bloqueada?</strong> Toca la pantalla y usa el botón de girar en la barra superior para ver el reloj en horizontal.",
           "<strong>Batería:</strong> con la pantalla siempre encendida, lo ideal es dejar el celular cargando."],
  "features_h": "Qué hace",
  "features": [
    ("Digital o analógico", "Fuente redondeada, LED de 7 segmentos o tarjetas que giran (flip). Formato de 12 o 24 horas y segundos opcionales. Un toque cambia entre digital y analógico."),
    ("Pantalla siempre encendida", "Ajusta el brillo deslizando el dedo hacia arriba y hacia abajo. Modo nocturno por horario, con rojo oscuro y brillo reducido."),
    ("Una esfera a tu manera", "Once posiciones alrededor del reloj para fecha, temperatura, otro huso horario, fase lunar, salida y puesta del sol, cuenta regresiva o texto libre. Arrastra para reorganizar, guarda diseños y compártelos por enlace o código QR."),
    ("Clima", "Temperatura y estado del tiempo (“22 °C, parcialmente nublado”), sensación térmica, máxima y mínima y probabilidad de lluvia."),
    ("Temporizador, cronómetro y pomodoro", "Varios temporizadores a la vez, con nombre. Cronómetro con vueltas. Pomodoro con ciclos de enfoque y descansos."),
    ("Hecho para el escritorio", "Protección contra quemado de pantalla, bloqueo de toques, horizontal forzada, modo espejo y sonidos opcionales de tic-tac y de hora en punto."),
  ],
  "more": "Funciona sin conexión, en español, portugués e inglés, y permite respaldar tus ajustes.",
  "gallery_h": "Así se ve",
  "gallery": [
    ("clock-analog", "Analógico con números y marcas de minutos"),
    ("clock-flip", "Tarjetas (flip) en color ámbar"),
    ("clock-led", "LED de 7 segmentos en color nocturno"),
    ("custom", "Esfera personalizada: luna, clima, otro huso horario, sol y progreso del día"),
    ("timers", "Varios temporizadores con nombre"),
    ("pomodoro", "Pomodoro"),
  ],
  "privacy_h": "Privacidad",
  "privacy": ["Sin anuncios, sin cuenta y sin rastreo. Tus preferencias se guardan solo en tu dispositivo.",
              "Los servicios externos se usan solo cuando activas la función correspondiente: <a href=\"https://open-meteo.com/\">Open-Meteo</a> (clima, licencia CC BY 4.0, y búsqueda de ciudades) y <a href=\"https://www.geojs.io/\">GeoJS</a> (ubicación aproximada por la dirección IP). La ubicación se redondea (~1 km) y no sale de tu dispositivo salvo en esas consultas."],
  "faq_h": "Preguntas frecuentes",
  "faq": [
    ("¿Tengo que descargarlo de la App Store o de Play Store?", "No. NADA Clock es una web app (PWA): la agregas a la pantalla de inicio desde el navegador y funciona como una app, a pantalla completa y sin conexión."),
    ("¿Es gratis?", "Sí, sin anuncios ni compras. El código es abierto, con licencia MIT."),
    ("¿Por qué se apaga la pantalla del iPhone?", "Mantener la pantalla encendida requiere iOS 18.4 o posterior y abrir el reloj desde el ícono de la pantalla de inicio, no desde una pestaña de Safari."),
    ("¿Suena la alarma con la app cerrada?", "No. Por ser una web app, el temporizador, el pomodoro y los sonidos solo suenan con el reloj abierto en pantalla."),
    ("¿Por qué no aparece la temperatura?", "Necesita una ubicación: GPS (con permiso), aproximada por internet (sin permiso) o una ciudad elegida. Defínela en Ajustes → Ubicación."),
    ("¿Cómo actualizo a la versión más reciente?", "En Ajustes → General, toca “Buscar actualización”. Cuando sale una versión nueva, el reloj también muestra un aviso."),
  ],
  "suggest_h": "Sugerencias y problemas",
  "suggest": "¿Tienes una idea o encontraste un problema? Abre un <em>issue</em> en GitHub (necesitas una cuenta gratuita).",
  "btn_feature": "Sugerir una mejora", "btn_bug": "Informar un problema", "btn_code": "Ver el código",
  "footer": "Código abierto (MIT)",
  "lang_label": "Idioma",
},
}

e = html.escape

def page(key):
    p, t = PAGES[key], T[key]
    url = BASE + p["dir"] + "/"
    base_short = BASE.replace("https://", "")
    alternates = "\n".join(
        f'  <link rel="alternate" hreflang="{PAGES[k]["lang"]}" href="{BASE}{PAGES[k]["dir"]}/">' for k in PAGES
    ) + f'\n  <link rel="alternate" hreflang="x-default" href="{BASE}{PAGES["en"]["dir"]}/">'
    ld = {
        "@context": "https://schema.org",
        "@type": "SoftwareApplication",
        "name": "NADA Clock",
        "alternateName": "No Ads, Display Always",
        "description": t["description"],
        "url": BASE,
        "image": f"{BASE}assets/og-{key}.png",
        "applicationCategory": "UtilitiesApplication",
        "operatingSystem": "iOS, Android, Web",
        "inLanguage": ["pt-BR", "en", "es"],
        "softwareVersion": VERSION,
        "license": "https://opensource.org/licenses/MIT",
        "isAccessibleForFree": True,
        "offers": {"@type": "Offer", "price": "0", "priceCurrency": "USD"},
        "codeRepository": REPO,
    }
    fill = lambda s: s.replace("{base}", BASE).replace("{base_short}", base_short)
    li = lambda items: "".join(f"<li>{fill(x)}</li>" for x in items)
    langs = " · ".join(
        f'<a href="../{PAGES[k]["dir"]}/" hreflang="{PAGES[k]["lang"]}" lang="{PAGES[k]["lang"]}"' + (' aria-current="page"' if k == key else "") + f'>{PAGES[k]["label"]}</a>'
        for k in PAGES
    )
    features = "".join(f'<li class="feature"><h3>{e(h)}</h3><p>{e(d)}</p></li>' for h, d in t["features"])
    PORTRAIT = ("clock-analog", "pomodoro")
    fig = lambda n, c, w, h: f'<figure class="shot"><img src="../assets/{key}/{n}.webp" alt="{e(c)}" width="{w}" height="{h}" loading="lazy" decoding="async"><figcaption>{e(c)}</figcaption></figure>'
    land = "".join(fig(n, c, 1280, 592) for n, c in t["gallery"] if n not in PORTRAIT)
    port = "".join(fig(n, c, 640, 1386) for n, c in t["gallery"] if n in PORTRAIT)
    gallery = f'<div class="gallery land">{land}</div><div class="gallery port">{port}</div>'
    faq = "".join(f"<details><summary>{e(q)}</summary><p>{e(a)}</p></details>" for q, a in t["faq"])
    return f"""<!doctype html>
<html lang="{p['lang']}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>{e(t['title'])}</title>
  <meta name="description" content="{e(t['description'])}">
  <link rel="canonical" href="{url}">
{alternates}
  <meta name="theme-color" content="#000000">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="NADA Clock">
  <meta property="og:title" content="{e(t['title'])}">
  <meta property="og:description" content="{e(t['description'])}">
  <meta property="og:url" content="{url}">
  <meta property="og:image" content="{BASE}assets/og-{key}.png">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:locale" content="{p['og_locale']}">
  <meta name="twitter:card" content="summary_large_image">
  <link rel="icon" type="image/png" sizes="192x192" href="../icons/icon-192.png">
  <link rel="apple-touch-icon" href="../icons/apple-touch-icon.png">
  <link rel="manifest" href="../manifest.webmanifest">
  <link rel="stylesheet" href="../css/about.css">
  <script type="application/ld+json">{json.dumps(ld, ensure_ascii=False)}</script>
</head>
<body>
  <a class="skip" href="#main">{e(t['skip'])}</a>
  <header class="top">
    <a class="brand" href="../"><img src="../icons/icon-192.png" alt="" width="32" height="32"><span>NADA Clock</span></a>
    <nav class="langs" aria-label="{e(t['lang_label'])}">{langs}</nav>
  </header>

  <main id="main">
    <section class="hero">
      <h1>{t['h1']}</h1>
      <p class="lead">{t['lead']}</p>
      <p class="ctas">
        <a class="btn primary" href="../">{e(t['open'])}</a>
        <a class="btn" href="#install">{e(t['howto'])}</a>
      </p>
      <figure class="hero-shot"><img src="../assets/{key}/clock-digital.webp" alt="{e(t['hero_alt'])}" width="1280" height="592"></figure>
    </section>

    <section>
      <h2>{e(t['why_h'])}</h2>
      {''.join(f'<p>{x}</p>' for x in t['why'])}
    </section>

    <section id="install">
      <h2>{e(t['install_h'])}</h2>
      <p>{t['install_intro']}</p>
      <div class="cols">
        <div class="card"><h3>{e(t['ios_h'])}</h3><ol>{li(t['ios'])}</ol></div>
        <div class="card"><h3>{e(t['android_h'])}</h3><ol>{li(t['android'])}</ol></div>
      </div>
      <ul class="tips">{li(t['tips'])}</ul>
    </section>

    <section>
      <h2>{e(t['features_h'])}</h2>
      <ul class="features">{features}</ul>
      <p class="more">{e(t['more'])}</p>
    </section>

    <section>
      <h2>{e(t['gallery_h'])}</h2>
      {gallery}
    </section>

    <section>
      <h2>{e(t['privacy_h'])}</h2>
      {''.join(f'<p>{x}</p>' for x in t['privacy'])}
    </section>

    <section>
      <h2>{e(t['faq_h'])}</h2>
      <div class="faq">{faq}</div>
    </section>

    <section id="feedback">
      <h2>{e(t['suggest_h'])}</h2>
      <p>{t['suggest']}</p>
      <p class="ctas">
        <a class="btn primary" href="{REPO}/issues/new?template=feature_request.yml">{e(t['btn_feature'])}</a>
        <a class="btn" href="{REPO}/issues/new?template=bug_report.yml">{e(t['btn_bug'])}</a>
        <a class="btn" href="{REPO}">{e(t['btn_code'])}</a>
      </p>
    </section>
  </main>

  <footer class="foot">
    <p><strong>NADA Clock</strong> · No Ads, Display Always · v{VERSION} · <a href="{REPO}">{e(t['footer'])}</a></p>
    <p class="langs">{langs}</p>
  </footer>
</body>
</html>
"""

def sitemap():
    urls = [("", "1.0")] + [(PAGES[k]["dir"] + "/", "0.8") for k in PAGES]
    alt = "".join(f'\n    <xhtml:link rel="alternate" hreflang="{PAGES[k]["lang"]}" href="{BASE}{PAGES[k]["dir"]}/"/>' for k in PAGES)
    items = []
    for path, prio in urls:
        extra = alt if path else ""
        items.append(f"  <url>\n    <loc>{BASE}{path}</loc>{extra}\n    <priority>{prio}</priority>\n  </url>")
    return ('<?xml version="1.0" encoding="UTF-8"?>\n'
            '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n'
            + "\n".join(items) + "\n</urlset>\n")

if __name__ == "__main__":
    for key, p in PAGES.items():
        out = ROOT / p["dir"] / "index.html"
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(page(key), encoding="utf-8")
        print("wrote", out.relative_to(ROOT))
    (ROOT / "sitemap.xml").write_text(sitemap(), encoding="utf-8")
    print("wrote sitemap.xml")
