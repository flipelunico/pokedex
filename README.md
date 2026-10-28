# 📕 Pokédex 8-Bit — iPhone Duo Foldable Edition

Aplicación web interactiva de una **Pokédex clásica de Kanto** diseñada a pantalla completa (`100dvw × 100dvh`) para dispositivos plegables como el **iPhone Duo** en Safari, utilizando **sprites 8-bit** y datos en tiempo real desde **PokéAPI v2**.

🌐 **Demo en vivo (GitHub Pages):** [**https://flipelunico.github.io/pokedex/**](https://flipelunico.github.io/pokedex/)

---

## ✨ Características Principales

### 1. Diseño Fiel a la Pokédex Clásica de Kanto (Cerrada y Abierta)
- **Modo Cerrado (Tapa Exterior)**:
  - Cuando el dispositivo plegable está cerrado (1 pantalla), muestra la **tapa roja clásica de la Pokédex de Kanto** con su lente azul superior, 3 LEDs de estado (rojo, amarillo y verde), corte diagonal escalonado en vector (`SVG`), pestillo triangular amarillo (`▶`), ranura inferior y cilindro de bisagra lateral.
  - Al desplegar físicamente el dispositivo (o al tocar el triángulo amarillo `▶`), la tapa se abre con una transición 3D (`perspective(1800px) rotateY(...)`) y reproduce el *jingle* 8-bit de encendido.
- **Ala Izquierda (Visor Principal y Controles)**:
  - Marco gris clásico con esquina inferior izquierda recortada, 2 puntos superiores, botón rojo de lectura por voz y rejilla de parlante.
  - **Pantalla Matriz CRT 8-Bit**: Muestra el `#ID`, nombre, tipos y sprite 8-bit del Pokémon con líneas de escaneo CRT y 3 paletas intercambiables (**Color Arcade**, **Game Boy DMG Verde** y **Game Boy Pocket**).
  - **Controles Inferiores**: Botón circular oscuro (reproducir grito), barras delgadas roja (Shiny) y azul (girar Frente/Espalda), pantalla secundaria verde con `#ID` y nombre, y cruceta direccional **D-Pad** (`◀`, `▶`, `▲ -10`, `▼ +10`).
- **Ala Derecha (Terminal de Datos PokéAPI)**:
  - **Pantalla Oscura Principal**: Buscador integrado por nombre o `#ID` y visualización dinámica de datos de PokéAPI.
  - **Teclado de 10 Botones Azules (`5×2`)**:
    - `INFO`: Género del Pokémon y descripción oficial en español desde PokéAPI.
    - `STATS`: Barras segmentadas estilo 8-bit (`PS`, `ATAQUE`, `DEFENSA`, `AT.ESP`, `DF.ESP`, `VELOC.`).
    - `EVOL`: Cadena evolutiva interactiva con sprites 8-bit (toca cualquier etapa para cargarla).
    - `TIPOS`: Cálculo automático de debilidades y resistencias (`2x`, `4x`, `½x`, `¼x`, `0x`).
    - `MOVS`: Lista de ataques aprendidos por nivel.
    - `HAB`: Habilidades normales y ocultas.
    - `GRITO`: Reproduce el grito oficial del Pokémon (`cries.legacy` / `cries.latest`).
    - `VOZ`: Lee en voz alta la entrada de la Pokédex en español usando `SpeechSynthesis` mientras ilumina el lente azul.
    - `SHINY`: Alterna la versión variocolor (*Shiny*) en 8-bit.
    - `AZAR`: Carga un Pokémon aleatorio entre `#001` y `#1025`.
  - **Controles Centrales e Inferiores**:
    - 2 botones blancos (`◀` / `▶`) para avanzar o retroceder de Pokémon.
    - 2 barras oscuras delgadas (cambio de paleta Game Boy y filtro de líneas CRT) + botón circular amarillo (alternar era de sprite 8-bit).
    - 2 mini-pantallas oscuras inferiores con `ALT / PESO` y `EXP / CAPTURA`.

---

## 📱 APIs Nativas para Dispositivos Plegables (Safari / WebKit / W3C)

La aplicación detecta automáticamente si el **iPhone Duo** está abierto o cerrado mediante la clase `FoldableDetector` en `app.js` y reglas CSS nativas en `styles.css`:

1. **Viewport Segments API (`window.visualViewport.segments` & CSS Environment Variables)**:
   - Detecta cuando la ventana se extiende a través de 2 pantallas físicas (`segments.length >= 2`).
   - Calcula dinámicamente el ancho de cada pantalla (`seg0.width`, `seg1.width`) y el grosor exacto de la bisagra física (`seg1.left - seg0.right`) para alinear el cilindro central de la Pokédex exactamente sobre el pliegue físico sin ocultar contenido.
   - Implementa `@media (horizontal-viewport-segments: 2)` y `@media (vertical-viewport-segments: 2)` junto con `env(viewport-segment-width 0 0)`, `env(viewport-segment-left 1 0)` y `env(viewport-segment-right 0 0)`.
2. **Device Posture API (`navigator.devicePosture`)**:
   - Escucha el evento `navigator.devicePosture.addEventListener('change', ...)` y evalúa `navigator.devicePosture.type` (`'continuous'` vs `'folded'`) además de `@media (device-posture: folded)`.
3. **Soporte para Safe Areas de iOS**:
   - Utiliza `viewport-fit=cover` y las variables `env(safe-area-inset-top)`, `env(safe-area-inset-bottom)`, `env(safe-area-inset-left)` y `env(safe-area-inset-right)` para adaptarse a pantalla completa como Web App en Safari.

---

## 👾 Resolución de Sprites 8-Bit y Audio Retro (PokéAPI v2)

- **Endpoint Principal**: `https://pokeapi.co/api/v2/pokemon/{idOrName}`
- **Endpoint de Especie e Idioma Español**: `https://pokeapi.co/api/v2/pokemon-species/{id}`
- **Endpoint de Cadena Evolutiva**: `https://pokeapi.co/api/v2/evolution-chain/{id}`
- **Endpoint de Efectividad de Tipos**: `https://pokeapi.co/api/v2/type/{type}`
- **Prioridad de Sprites 8-Bit (`resolve8BitSprite`)**:
  - Prioriza los sprites auténticos de 8 bits de Game Boy (`versions['generation-ii'].crystal`, `versions['generation-i'].yellow` / `red-blue`) con fondos transparentes y renderizado `image-rendering: pixelated`, haciendo *fallback* automático a los sprites pixel-art de PokéAPI para las generaciones posteriores hasta el `#1025`.
- **Sintetizador 8-Bit (`RetroAudio`)**:
  - Genera efectos de sonido de onda cuadrada (`square` oscillator) en tiempo real con **Web Audio API** para cada pulsación de botón y para el *jingle* de carga de la Pokédex, sin depender de archivos de audio externos.

---

## 🗂️ Estructura del Proyecto

```text
pokedex/
├── index.html   # Estructura semántica de la tapa cerrada y las dos alas de la Pokédex abierta
├── styles.css   # Layout plegable (CSS Grid + Viewport Segments), vectores SVG y estética Kanto
├── app.js       # Detector de postura/pliegue, cliente PokéAPI con caché, audio 8-bit y voz TTS
└── README.md    # Documentación técnica de la implementación
```

---

## 🚀 Ejecución Local

No requiere compilación ni dependencias externas:

```bash
git clone https://github.com/flipelunico/pokedex.git
cd pokedex
python3 -m http.server 8080
```

Luego abre `http://localhost:8080` en tu navegador o visita directamente [**https://flipelunico.github.io/pokedex/**](https://flipelunico.github.io/pokedex/).
