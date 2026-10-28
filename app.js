/**
 * Pokédex 8-Bit — Full-Viewport Foldable Edition for iPhone Duo / Safari
 *
 * Implements W3C / Safari Foldable Web APIs:
 * 1. Device Posture API (`navigator.devicePosture.type` & `change` event)
 * 2. Viewport Segments API (`window.visualViewport.segments`)
 * 3. CSS Media Queries (`(horizontal-viewport-segments: 2)`, `(vertical-viewport-segments: 2)`, `(device-posture: folded)`)
 * 4. PokéAPI v2 (`https://pokeapi.co/api/v2/`) with 8-Bit Sprites
 */

const POKEAPI_BASE = 'https://pokeapi.co/api/v2';
const MAX_POKEMON_ID = 1025;

const TYPE_META = {
  normal:   { es: 'NORMAL',    color: '#A8A77A' },
  fire:     { es: 'FUEGO',     color: '#EE8130' },
  water:    { es: 'AGUA',      color: '#6390F0' },
  electric: { es: 'ELÉCTRICO', color: '#F7D02C' },
  grass:    { es: 'PLANTA',    color: '#7AC74C' },
  ice:      { es: 'HIELO',     color: '#96D9D6' },
  fighting: { es: 'LUCHA',     color: '#C22E28' },
  poison:   { es: 'VENENO',    color: '#A33EA1' },
  ground:   { es: 'TIERRA',    color: '#E2BF65' },
  flying:   { es: 'VOLADOR',   color: '#A98FF3' },
  psychic:  { es: 'PSÍQUICO',  color: '#F95587' },
  bug:      { es: 'BICHO',     color: '#A6B91A' },
  rock:     { es: 'ROCA',      color: '#B6A136' },
  ghost:    { es: 'FANTASMA',  color: '#735797' },
  dragon:   { es: 'DRAGÓN',    color: '#6F35FC' },
  dark:     { es: 'SINIESTRO', color: '#705746' },
  steel:    { es: 'ACERO',     color: '#B7B7CE' },
  fairy:    { es: 'HADA',      color: '#D685AD' },
};

const STAT_META = {
  'hp':              { label: 'PS',      color: '#ef4444' },
  'attack':          { label: 'ATAQUE',  color: '#f97316' },
  'defense':         { label: 'DEFENSA', color: '#eab308' },
  'special-attack':  { label: 'AT.ESP',  color: '#38bdf8' },
  'special-defense': { label: 'DF.ESP',  color: '#4ade80' },
  'speed':           { label: 'VELOC.',  color: '#f472b6' },
};

const PALETTES = ['mode-color', 'mode-dmg', 'mode-pocket'];
const GEMINI_KEY_STORAGE = 'pokedex_gemini_api_key';

const state = {
  currentId: 1,
  pokemonData: null,
  speciesData: null,
  isBackSprite: false,
  isShiny: false,
  useRetro8BitEra: true,
  paletteIndex: 0,
  scanlines: true,
  soundEnabled: true,
  cache: new Map(),
  foldMode: 'unfolded',
  lastAiReport: null,
};

// ================= SAFARI / W3C FOLDABLE & POSTURE DETECTOR =================
class FoldableDetector {
  constructor() {
    this.mqHorizSegments = window.matchMedia('(horizontal-viewport-segments: 2)');
    this.mqVertSegments = window.matchMedia('(vertical-viewport-segments: 2)');
    this.mqSpanVert = window.matchMedia('(spanning: single-fold-vertical)');
    this.mqSpanHoriz = window.matchMedia('(spanning: single-fold-horizontal)');
    this.mqPostureFolded = window.matchMedia('(device-posture: folded)');
  }

  init() {
    const evaluate = () => this.evaluateFoldState();

    if ('devicePosture' in navigator && navigator.devicePosture) {
      navigator.devicePosture.addEventListener('change', evaluate);
    }

    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', evaluate);
    }
    window.addEventListener('resize', evaluate);
    window.addEventListener('orientationchange', evaluate);

    [
      this.mqHorizSegments,
      this.mqVertSegments,
      this.mqSpanVert,
      this.mqSpanHoriz,
      this.mqPostureFolded,
    ].forEach((mq) => {
      if (mq && mq.addEventListener) {
        mq.addEventListener('change', evaluate);
      }
    });

    this.evaluateFoldState();
  }

  evaluateFoldState() {
    const root = document.documentElement;
    const segments = window.visualViewport?.segments || window.screen?.segments || null;
    const postureType = navigator.devicePosture?.type || null;

    if (Array.isArray(segments) && segments.length >= 2) {
      const seg0 = segments[0];
      const seg1 = segments[1];

      if (seg1.left >= seg0.right) {
        const hingeGap = Math.max(22, seg1.left - seg0.right);
        root.style.setProperty('--left-segment-width', `${seg0.width}px`);
        root.style.setProperty('--hinge-size', `${hingeGap}px`);
        root.style.setProperty('--right-segment-width', `${seg1.width}px`);
        this.applyFoldMode('unfolded');
        return;
      }

      if (seg1.top >= seg0.bottom) {
        const hingeGap = Math.max(18, seg1.top - seg0.bottom);
        root.style.setProperty('--top-segment-height', `${seg0.height}px`);
        root.style.setProperty('--hinge-size', `${hingeGap}px`);
        root.style.setProperty('--bottom-segment-height', `${seg1.height}px`);
        this.applyFoldMode('clamshell');
        return;
      }
    }

    if (this.mqHorizSegments.matches || this.mqSpanVert.matches) {
      this.applyFoldMode('unfolded');
      return;
    }

    if (this.mqVertSegments.matches || this.mqSpanHoriz.matches) {
      this.applyFoldMode('clamshell');
      return;
    }

    if (postureType === 'folded' || this.mqPostureFolded.matches) {
      const isPortrait = window.innerHeight > window.innerWidth;
      this.applyFoldMode(isPortrait ? 'clamshell' : 'unfolded');
      return;
    }

    root.style.removeProperty('--left-segment-width');
    root.style.removeProperty('--right-segment-width');
    root.style.removeProperty('--hinge-size');

    if (window.innerWidth < 760) {
      this.applyFoldMode('folded');
    } else {
      this.applyFoldMode('unfolded');
    }
  }

  applyFoldMode(mode) {
    const prevMode = state.foldMode;
    state.foldMode = mode;
    document.body.classList.remove(
      'fold-state-unfolded',
      'fold-state-folded',
      'fold-state-clamshell'
    );
    document.body.classList.add(`fold-state-${mode}`);

    if (mode === 'folded') {
      document.body.classList.remove('cover-unlatched', 'drawer-open');
    } else {
      document.body.classList.remove('drawer-open');
      if (prevMode === 'folded') {
        retroAudio.playPokedexLoadedJingle();
      }
    }
  }
}

const foldableDetector = new FoldableDetector();

// ================= 8-BIT SYNTHESIZER (WEB AUDIO API) =================
class RetroAudio {
  constructor() {
    this.ctx = null;
    this.cryAudio = null;
  }

  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) this.ctx = new AudioCtx();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  beep(freq = 660, duration = 0.055, type = 'square', vol = 0.05) {
    if (!state.soundEnabled) return;
    try {
      this.init();
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
      gain.gain.setValueAtTime(vol, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + duration);
    } catch (_) {}
  }

  playButtonBlip() {
    this.beep(784, 0.04, 'square', 0.045);
  }

  playPokedexLoadedJingle() {
    if (!state.soundEnabled) return;
    this.beep(523.25, 0.045, 'square', 0.045);
    setTimeout(() => this.beep(659.25, 0.045, 'square', 0.045), 50);
    setTimeout(() => this.beep(783.99, 0.065, 'square', 0.045), 100);
  }

  playPokemonCry(pokemon) {
    if (!pokemon) return;
    const lens = document.getElementById('main-blue-lens');
    const spriteEl = document.getElementById('pokemon-sprite');

    spriteEl.classList.remove('bounce-anim');
    void spriteEl.offsetWidth;
    spriteEl.classList.add('bounce-anim');

    const cryUrl = pokemon.cries?.legacy || pokemon.cries?.latest;
    if (cryUrl && state.soundEnabled) {
      if (this.cryAudio) this.cryAudio.pause();
      this.cryAudio = new Audio(cryUrl);
      this.cryAudio.volume = 0.45;
      lens.classList.add('speaking');
      this.cryAudio.onended = () => lens.classList.remove('speaking');
      this.cryAudio.onerror = () => {
        lens.classList.remove('speaking');
        this.playPokedexLoadedJingle();
      };
      this.cryAudio.play().catch(() => {
        lens.classList.remove('speaking');
        this.playPokedexLoadedJingle();
      });
    } else {
      this.playPokedexLoadedJingle();
    }
  }
}

const retroAudio = new RetroAudio();

// ================= 8-BIT SPRITE RESOLVER =================
function resolve8BitSprite(pokemon) {
  if (!pokemon || !pokemon.sprites) return { url: '' };

  const s = pokemon.sprites;
  const v = s.versions || {};
  const gen1 = v['generation-i']?.['yellow'] || v['generation-i']?.['red-blue'];
  const gen2 = v['generation-ii']?.['crystal'] || v['generation-ii']?.['gold'];
  const gen5 = v['generation-v']?.['black-white']?.animated;

  const side = state.isBackSprite ? 'back' : 'front';

  if (state.useRetro8BitEra) {
    if (state.isShiny && gen2) {
      const url = gen2[`${side}_shiny_transparent`] || gen2[`${side}_shiny`];
      if (url) return { url };
    }
    if (!state.isShiny && gen2) {
      const url = gen2[`${side}_transparent`] || gen2[`${side}_default`];
      if (url) return { url };
    }
    if (!state.isShiny && gen1) {
      const url = gen1[`${side}_transparent`] || gen1[`${side}_default`];
      if (url) return { url };
    }
  }

  if (!state.useRetro8BitEra && gen5) {
    const key = state.isShiny ? `${side}_shiny` : `${side}_default`;
    if (gen5[key]) return { url: gen5[key] };
  }

  const primaryKey = state.isShiny ? `${side}_shiny` : `${side}_default`;
  const fallbackKey = state.isShiny ? 'front_shiny' : 'front_default';
  const url =
    s[primaryKey] ||
    s[fallbackKey] ||
    s.front_default ||
    `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${pokemon.id}.png`;

  return { url };
}

// ================= POKEAPI CLIENT =================
async function fetchJsonWithCache(url) {
  if (state.cache.has(url)) return state.cache.get(url);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`PokéAPI HTTP ${res.status}`);
  const data = await res.json();
  state.cache.set(url, data);
  return data;
}

async function loadPokemon(idOrName) {
  const query = String(idOrName).trim().toLowerCase();
  if (!query) return;

  setLoadingState(true);

  try {
    const pokemon = await fetchJsonWithCache(`${POKEAPI_BASE}/pokemon/${query}`);
    state.currentId = pokemon.id;
    state.pokemonData = pokemon;

    const species = await fetchJsonWithCache(pokemon.species.url);
    state.speciesData = species;

    renderPrimaryWing(pokemon, species);
    renderSecondaryInfo(pokemon, species);
    renderSecondaryStats(pokemon);
    renderSecondaryMoves(pokemon);

    loadEvolutionChain(species.evolution_chain?.url, pokemon.id);
    loadTypeDefenses(pokemon.types);

    retroAudio.playPokedexLoadedJingle();
  } catch (err) {
    console.error('Error PokéAPI:', err);
    document.getElementById('pokemon-description').textContent =
      `No se encontró "${idOrName}". Intenta con otro nombre o #ID (1 - 1025).`;
  } finally {
    setLoadingState(false);
  }
}

function setLoadingState(isLoading) {
  const spinner = document.getElementById('loading-spinner');
  const spriteImg = document.getElementById('pokemon-sprite');
  if (isLoading) {
    spinner.classList.remove('hidden');
    spriteImg.style.opacity = '0.25';
  } else {
    spinner.classList.add('hidden');
    spriteImg.style.opacity = '1';
  }
}

// ================= RENDER FUNCTIONS =================
function renderPrimaryWing(pokemon) {
  const formattedId = `#${String(pokemon.id).padStart(3, '0')}`;
  const upperName = pokemon.name.toUpperCase();

  document.getElementById('pokemon-number').textContent = formattedId;
  document.getElementById('pokemon-name').textContent = upperName;

  // Update Left Wing Green Sub-Screen
  const greenId = document.getElementById('green-lcd-id');
  const greenName = document.getElementById('green-lcd-name');
  if (greenId) greenId.textContent = formattedId;
  if (greenName) greenName.textContent = upperName;

  // Types badges inside visor
  const typesContainer = document.getElementById('pokemon-types');
  typesContainer.innerHTML = '';
  pokemon.types.forEach((t) => {
    const typeName = t.type.name;
    const meta = TYPE_META[typeName] || { es: typeName.toUpperCase(), color: '#64748b' };
    const badge = document.createElement('span');
    badge.className = 'type-badge';
    badge.style.backgroundColor = meta.color;
    badge.textContent = meta.es;
    typesContainer.appendChild(badge);
  });

  updateSpriteView();
}

function updateSpriteView() {
  if (!state.pokemonData) return;
  const spriteImg = document.getElementById('pokemon-sprite');
  const shinyIndicator = document.getElementById('shiny-indicator');

  const { url } = resolve8BitSprite(state.pokemonData);
  spriteImg.src = url;
  spriteImg.alt = state.pokemonData.name;
  shinyIndicator.classList.toggle('hidden', !state.isShiny);
}

function renderSecondaryInfo(pokemon, species) {
  const genusObj =
    species?.genera?.find((g) => g.language.name === 'es') ||
    species?.genera?.find((g) => g.language.name === 'en');
  document.getElementById('pokemon-genus').textContent = genusObj
    ? genusObj.genus
    : 'Pokémon Registrado';

  const esEntry = species?.flavor_text_entries?.find((e) => e.language.name === 'es');
  const enEntry = species?.flavor_text_entries?.find((e) => e.language.name === 'en');
  const chosenEntry = esEntry || enEntry;

  const cleanText = chosenEntry
    ? chosenEntry.flavor_text.replace(/[\f\n\r]+/g, ' ')
    : 'Sin descripción disponible en la Pokédex.';
  document.getElementById('pokemon-description').textContent = cleanText;

  // Update Bottom Two Dark Mini-Screens
  document.getElementById('pokemon-height').textContent = `${(pokemon.height / 10).toFixed(1)}m`;
  document.getElementById('pokemon-weight').textContent = `${(pokemon.weight / 10).toFixed(1)}kg`;
  document.getElementById('pokemon-exp').textContent = pokemon.base_experience ?? '--';
  document.getElementById('pokemon-capture').textContent = species?.capture_rate ?? '--';

  // Abilities view
  const abilitiesEl = document.getElementById('pokemon-abilities');
  abilitiesEl.innerHTML = '';
  pokemon.abilities.forEach((a) => {
    const pill = document.createElement('div');
    pill.className = 'ability-pill';
    pill.style.backgroundColor = a.is_hidden ? '#7c2d12' : '#1e3a8a';
    pill.textContent = `${a.ability.name.replace(/-/g, ' ').toUpperCase()}${a.is_hidden ? ' (OCULTA)' : ''}`;
    abilitiesEl.appendChild(pill);
  });
}

async function loadEvolutionChain(chainUrl, currentPokemonId) {
  const container = document.getElementById('evolution-chain');
  if (!chainUrl) {
    container.innerHTML = '<span>Sin cadena evolutiva</span>';
    return;
  }

  try {
    const chainData = await fetchJsonWithCache(chainUrl);
    const stages = [];

    function traverse(node) {
      if (!node) return;
      const urlParts = node.species.url.split('/').filter(Boolean);
      const id = Number(urlParts[urlParts.length - 1]);
      stages.push({ id, name: node.species.name });
      if (node.evolves_to?.length) {
        node.evolves_to.forEach((child) => traverse(child));
      }
    }

    traverse(chainData.chain);
    container.innerHTML = '';

    stages.forEach((stage, idx) => {
      const nodeEl = document.createElement('div');
      nodeEl.className = `evo-node ${stage.id === currentPokemonId ? 'current-evo' : ''}`;
      const spriteUrl = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/versions/generation-ii/crystal/${stage.id}.png`;
      const fallbackUrl = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${stage.id}.png`;

      nodeEl.innerHTML = `
        <img class="evo-sprite" src="${spriteUrl}" onerror="this.onerror=null;this.src='${fallbackUrl}';" alt="${stage.name}" />
        <span class="evo-name">#${String(stage.id).padStart(3, '0')} ${stage.name}</span>
      `;
      nodeEl.addEventListener('click', () => {
        retroAudio.playButtonBlip();
        loadPokemon(stage.id);
      });
      container.appendChild(nodeEl);

      if (idx < stages.length - 1) {
        const arrow = document.createElement('span');
        arrow.className = 'evo-arrow';
        arrow.textContent = '▶';
        container.appendChild(arrow);
      }
    });
  } catch (_) {
    container.innerHTML = '<span>No disponible</span>';
  }
}

function renderSecondaryStats(pokemon) {
  const barsContainer = document.getElementById('stats-bars');
  barsContainer.innerHTML = '';

  pokemon.stats.forEach((s) => {
    const val = s.base_stat;
    const meta = STAT_META[s.stat.name] || { label: s.stat.name.toUpperCase(), color: '#38bdf8' };
    const pct = Math.min(100, Math.round((val / 200) * 100));

    const row = document.createElement('div');
    row.className = 'stat-row';
    row.innerHTML = `
      <span class="stat-name">${meta.label}</span>
      <span class="stat-num">${val}</span>
      <div class="stat-bar-track">
        <div class="stat-bar-fill" style="width: ${pct}%; color: ${meta.color};"></div>
      </div>
    `;
    barsContainer.appendChild(row);
  });
}

async function loadTypeDefenses(types) {
  const container = document.getElementById('type-defenses');
  container.innerHTML = '<span>Calculando...</span>';

  try {
    const multipliers = {};
    Object.keys(TYPE_META).forEach((t) => (multipliers[t] = 1));

    for (const tObj of types) {
      const typeData = await fetchJsonWithCache(tObj.type.url);
      const rel = typeData.damage_relations;
      rel.double_damage_from.forEach((d) => (multipliers[d.name] *= 2));
      rel.half_damage_from.forEach((d) => (multipliers[d.name] *= 0.5));
      rel.no_damage_from.forEach((d) => (multipliers[d.name] *= 0));
    }

    container.innerHTML = '';
    Object.entries(multipliers)
      .filter(([, mult]) => mult !== 1)
      .sort((a, b) => b[1] - a[1])
      .forEach(([typeName, mult]) => {
        const meta = TYPE_META[typeName] || { es: typeName.toUpperCase(), color: '#475569' };
        const pill = document.createElement('div');
        pill.className = 'defense-pill';
        pill.style.backgroundColor = meta.color;
        const multLabel = mult === 0.5 ? '½x' : mult === 0.25 ? '¼x' : `${mult}x`;
        pill.innerHTML = `<span>${meta.es}</span> <strong>${multLabel}</strong>`;
        container.appendChild(pill);
      });
  } catch (_) {
    container.innerHTML = '';
  }
}

function renderSecondaryMoves(pokemon) {
  const movesContainer = document.getElementById('moves-list');
  movesContainer.innerHTML = '';

  const levelUpMoves = pokemon.moves
    .map((m) => {
      const detail = m.version_group_details.find(
        (d) => d.move_learn_method.name === 'level-up'
      );
      return detail
        ? { name: m.move.name.replace(/-/g, ' '), level: detail.level_learned_at }
        : null;
    })
    .filter(Boolean)
    .sort((a, b) => a.level - b.level)
    .slice(0, 24);

  levelUpMoves.forEach((mv) => {
    const item = document.createElement('div');
    item.className = 'move-item';
    item.innerHTML = `
      <span class="move-name">${mv.name}</span>
      <span class="move-lvl">NV. ${mv.level}</span>
    `;
    movesContainer.appendChild(item);
  });
}

function speakPokedexEntry(customPrefix = '') {
  if (!('speechSynthesis' in window) || !state.pokemonData) return;

  window.speechSynthesis.cancel();
  const lens = document.getElementById('main-blue-lens');
  const name = state.pokemonData.name;
  const genus = document.getElementById('pokemon-genus').textContent;
  const desc = document.getElementById('pokemon-description').textContent;

  const fullText = customPrefix
    ? `${name}. ${customPrefix} ${genus}. ${desc}`
    : `${name}. ${genus}. ${desc}`;

  const utterance = new SpeechSynthesisUtterance(fullText);
  utterance.lang = 'es-ES';
  utterance.rate = 1.02;
  utterance.pitch = 0.95;

  utterance.onstart = () => lens.classList.add('speaking');
  utterance.onend = () => lens.classList.remove('speaking');
  utterance.onerror = () => lens.classList.remove('speaking');

  window.speechSynthesis.speak(utterance);
}

// ================= POKÉDEX CAMERA SCANNER + GEMINI VISION API =================
class PokedexCameraScanner {
  constructor() {
    this.stream = null;
    this.facingMode = 'environment';
    this.isActive = false;
    this.pendingBase64 = null;
  }

  getApiKey() {
    return (localStorage.getItem(GEMINI_KEY_STORAGE) || '').trim();
  }

  updateKeyBadge() {
    const chip = document.getElementById('btn-api-key');
    if (!chip) return;
    const hasKey = Boolean(this.getApiKey());
    chip.classList.toggle('configured', hasKey);
    chip.textContent = hasKey ? '🔑 IA OK' : '🔑 IA';
  }

  openApiKeyModal() {
    retroAudio.playButtonBlip();
    const modal = document.getElementById('api-key-modal');
    const input = document.getElementById('gemini-key-input');
    input.value = this.getApiKey();
    modal.classList.remove('hidden');
    setTimeout(() => input.focus(), 50);
  }

  closeApiKeyModal() {
    document.getElementById('api-key-modal').classList.add('hidden');
  }

  saveApiKey() {
    const input = document.getElementById('gemini-key-input');
    const val = input.value.trim();
    if (val) {
      localStorage.setItem(GEMINI_KEY_STORAGE, val);
    } else {
      localStorage.removeItem(GEMINI_KEY_STORAGE);
    }
    this.updateKeyBadge();
    this.closeApiKeyModal();
    retroAudio.playPokedexLoadedJingle();

    if (this.pendingBase64 && val) {
      const b64 = this.pendingBase64;
      this.pendingBase64 = null;
      this.analyzeWithGemini(b64);
    }
  }

  async openScanner() {
    retroAudio.playButtonBlip();
    const layer = document.getElementById('camera-scanner-layer');
    const video = document.getElementById('camera-video');
    const preview = document.getElementById('camera-captured-preview');

    preview.classList.add('hidden');
    layer.classList.remove('hidden');
    this.isActive = true;

    await this.startStream(video);
  }

  async startStream(videoEl) {
    this.stopStream();
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      // Fallback for non-HTTPS local LAN testing on iOS Safari: trigger native camera input
      document.getElementById('file-camera-fallback').click();
      return;
    }

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: this.facingMode },
          width: { ideal: 720 },
          height: { ideal: 720 },
        },
        audio: false,
      });
      videoEl.srcObject = this.stream;
      await videoEl.play();
    } catch (err) {
      console.warn('getUserMedia no disponible o permiso denegado, abriendo cámara nativa:', err);
      document.getElementById('file-camera-fallback').click();
    }
  }

  stopStream() {
    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop());
      this.stream = null;
    }
  }

  closeScanner() {
    retroAudio.playButtonBlip();
    this.stopStream();
    this.isActive = false;
    document.getElementById('camera-scanner-layer').classList.add('hidden');
    document.getElementById('laser-scan-beam').classList.add('hidden');
  }

  async flipCamera() {
    retroAudio.playButtonBlip();
    this.facingMode = this.facingMode === 'environment' ? 'user' : 'environment';
    const video = document.getElementById('camera-video');
    await this.startStream(video);
  }

  captureFromVideo() {
    retroAudio.playButtonBlip();
    const video = document.getElementById('camera-video');
    if (!video.srcObject || !video.videoWidth) {
      document.getElementById('file-camera-fallback').click();
      return;
    }

    const canvas = document.getElementById('camera-canvas');
    const maxDim = 640;
    const scale = Math.min(1, maxDim / Math.max(video.videoWidth, video.videoHeight));
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);

    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
    this.showPreviewAndAnalyze(dataUrl);
  }

  handleFileUpload(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.getElementById('camera-canvas');
        const maxDim = 640;
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
        this.showPreviewAndAnalyze(dataUrl);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  showPreviewAndAnalyze(dataUrl) {
    const preview = document.getElementById('camera-captured-preview');
    preview.src = dataUrl;
    preview.classList.remove('hidden');

    const base64Data = dataUrl.split(',')[1];
    const apiKey = this.getApiKey();
    if (!apiKey) {
      this.pendingBase64 = base64Data;
      this.openApiKeyModal();
      return;
    }

    this.analyzeWithGemini(base64Data);
  }

  async analyzeWithGemini(base64Jpeg) {
    const apiKey = this.getApiKey();
    const beam = document.getElementById('laser-scan-beam');
    const shutterBtn = document.getElementById('btn-cam-capture');

    beam.classList.remove('hidden');
    shutterBtn.disabled = true;
    shutterBtn.textContent = '📡 ANALIZANDO...';
    retroAudio.beep(880, 0.08, 'square', 0.05);

    const prompt = `Actúa como la inteligencia artificial de una Pokédex real de Kanto.
Observa la imagen capturada por la cámara:
1. Si aparece un Pokémon (juguete, carta, peluche, dibujo, pantalla), identifícalo con precisión.
2. Si aparece un animal real, mascota, persona, planta u objeto cotidiano, compáralo con el Pokémon oficial (ID 1 al 1025) que más se le parezca física o conceptualmente.

Devuelve ÚNICAMENTE un objeto JSON válido con este formato exacto:
{
  "pokemonId": <número entero entre 1 y 1025>,
  "pokemonName": "<nombre en inglés minúsculas para PokéAPI>",
  "isExactPokemon": <true si era un Pokémon real en la foto, false si fue una comparación con un objeto/ser real>,
  "reportEs": "<breve reporte estilo Pokédex en español (máximo 22 palabras) explicando qué detectó la cámara y por qué corresponde a este Pokémon>"
}`;

    try {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`;
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: prompt },
                {
                  inline_data: {
                    mime_type: 'image/jpeg',
                    data: base64Jpeg,
                  },
                },
              ],
            },
          ],
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.2,
          },
        }),
      });

      if (!response.ok) {
        const errBody = await response.text();
        throw new Error(`Gemini API HTTP ${response.status}: ${errBody}`);
      }

      const json = await response.json();
      const rawText = json.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
      const parsed = JSON.parse(rawText);

      const targetPokemon = parsed.pokemonId || parsed.pokemonName || 25;
      const reportEs =
        parsed.reportEs || 'Espécimen identificado mediante escaneo óptico Pokédex.';

      // Close scanner overlay & load matched Pokémon from PokéAPI
      this.closeScanner();
      await loadPokemon(targetPokemon);

      // Show AI Scan Report on the Right Screen
      const banner = document.getElementById('ai-scan-banner');
      const reportEl = document.getElementById('ai-scan-report');
      if (banner && reportEl) {
        reportEl.textContent = reportEs;
        banner.classList.remove('hidden');
      }

      // Speak the scan result + Pokédex entry
      speakPokedexEntry(reportEs);
    } catch (err) {
      console.error('Error en escaneo Gemini Vision:', err);
      alert(
        'No se pudo analizar la imagen con Gemini API. Verifica tu API Key (botón 🔑 IA) o tu conexión.'
      );
    } finally {
      beam.classList.add('hidden');
      shutterBtn.disabled = false;
      shutterBtn.textContent = '📸 ESCANEAR';
    }
  }
}

const cameraScanner = new PokedexCameraScanner();

function stepPokemon(delta) {
  retroAudio.playButtonBlip();
  document.getElementById('ai-scan-banner')?.classList.add('hidden');
  let nextId = state.currentId + delta;
  if (nextId < 1) nextId = MAX_POKEMON_ID;
  if (nextId > MAX_POKEMON_ID) nextId = 1;
  loadPokemon(nextId);
}

function cyclePalette() {
  retroAudio.playButtonBlip();
  const crt = document.getElementById('crt-screen');
  PALETTES.forEach((cls) => crt.classList.remove(cls));
  state.paletteIndex = (state.paletteIndex + 1) % PALETTES.length;
  crt.classList.add(PALETTES[state.paletteIndex]);
}

function toggleShiny() {
  retroAudio.playButtonBlip();
  state.isShiny = !state.isShiny;
  updateSpriteView();
}

function initEventListeners() {
  // D-Pad & 2 White Buttons (◀ / ▶)
  document.getElementById('dpad-left').addEventListener('click', () => stepPokemon(-1));
  document.getElementById('dpad-right').addEventListener('click', () => stepPokemon(1));
  document.getElementById('dpad-up').addEventListener('click', () => stepPokemon(-10));
  document.getElementById('dpad-down').addEventListener('click', () => stepPokemon(10));
  document.getElementById('btn-prev-footer').addEventListener('click', () => stepPokemon(-1));
  document.getElementById('btn-next-footer').addEventListener('click', () => stepPokemon(1));

  // Left Wing Controls
  document.getElementById('btn-a').addEventListener('click', () =>
    retroAudio.playPokemonCry(state.pokemonData)
  );
  document.getElementById('pokemon-sprite').addEventListener('click', () =>
    retroAudio.playPokemonCry(state.pokemonData)
  );
  document.getElementById('btn-tts').addEventListener('click', () => {
    retroAudio.playButtonBlip();
    speakPokedexEntry();
  });

  document.getElementById('btn-flip-sprite').addEventListener('click', () => {
    retroAudio.playButtonBlip();
    state.isBackSprite = !state.isBackSprite;
    updateSpriteView();
  });

  document.getElementById('btn-shiny').addEventListener('click', toggleShiny);
  document.getElementById('green-sub-screen').addEventListener('click', cyclePalette);

  // Right Wing 10 Blue Keypad Buttons (5x2 Grid)
  document.querySelectorAll('.blue-key[data-view]').forEach((keyBtn) => {
    keyBtn.addEventListener('click', () => {
      retroAudio.playButtonBlip();
      document.querySelectorAll('.blue-key[data-view]').forEach((b) => b.classList.remove('active'));
      document.querySelectorAll('.rms-view').forEach((v) => v.classList.remove('active'));

      keyBtn.classList.add('active');
      const targetView = document.getElementById(keyBtn.dataset.view);
      if (targetView) targetView.classList.add('active');

      const titleEl = document.getElementById('rms-mode-title');
      if (titleEl && keyBtn.dataset.title) {
        titleEl.textContent = keyBtn.dataset.title;
      }
    });
  });

  // Action Blue Keys (Row 2)
  document.getElementById('key-scan').addEventListener('click', () => {
    cameraScanner.openScanner();
  });
  document.getElementById('key-voice').addEventListener('click', () => {
    retroAudio.playButtonBlip();
    speakPokedexEntry();
  });
  document.getElementById('key-shiny').addEventListener('click', toggleShiny);
  document.getElementById('key-random').addEventListener('click', () => {
    retroAudio.playButtonBlip();
    document.getElementById('ai-scan-banner')?.classList.add('hidden');
    const randomId = Math.floor(Math.random() * MAX_POKEMON_ID) + 1;
    loadPokemon(randomId);
  });

  // Camera Scanner Controls & Top Blue Lens Trigger
  document.getElementById('btn-lens-camera').addEventListener('click', () => {
    if (cameraScanner.isActive) {
      cameraScanner.closeScanner();
    } else {
      cameraScanner.openScanner();
    }
  });
  document.getElementById('btn-cam-close').addEventListener('click', () => {
    cameraScanner.closeScanner();
  });
  document.getElementById('btn-cam-flip').addEventListener('click', () => {
    cameraScanner.flipCamera();
  });
  document.getElementById('btn-cam-capture').addEventListener('click', () => {
    cameraScanner.captureFromVideo();
  });
  document.getElementById('file-camera-fallback').addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (file) {
      document.getElementById('camera-scanner-layer').classList.remove('hidden');
      cameraScanner.isActive = true;
      cameraScanner.handleFileUpload(file);
    }
    e.target.value = '';
  });

  // Gemini API Key Modal Controls
  document.getElementById('btn-api-key').addEventListener('click', () => {
    cameraScanner.openApiKeyModal();
  });
  document.getElementById('btn-close-modal').addEventListener('click', () => {
    cameraScanner.closeApiKeyModal();
  });
  document.getElementById('btn-save-key').addEventListener('click', () => {
    cameraScanner.saveApiKey();
  });
  document.getElementById('btn-clear-key').addEventListener('click', () => {
    document.getElementById('gemini-key-input').value = '';
    cameraScanner.saveApiKey();
  });

  // Right Wing Thin Dark Bars & Round Yellow Lamp
  document.getElementById('btn-gb-filter').addEventListener('click', cyclePalette);

  document.getElementById('btn-scanlines').addEventListener('click', () => {
    retroAudio.playButtonBlip();
    state.scanlines = !state.scanlines;
    document.getElementById('crt-screen').classList.toggle('scanlines-on', state.scanlines);
  });

  document.getElementById('btn-era-sprite').addEventListener('click', () => {
    retroAudio.playButtonBlip();
    state.useRetro8BitEra = !state.useRetro8BitEra;
    updateSpriteView();
  });

  // Exterior Closed Cover Yellow Triangular Latch Button
  const unlatchBtn = document.getElementById('btn-unlatch-cover');
  if (unlatchBtn) {
    unlatchBtn.addEventListener('click', () => {
      document.body.classList.add('cover-unlatched');
      retroAudio.playPokedexLoadedJingle();
    });
  }

  // Folded 1-Screen Drawer Open/Close
  document.getElementById('btn-folded-drawer-toggle').addEventListener('click', () => {
    retroAudio.playButtonBlip();
    document.body.classList.toggle('drawer-open');
  });

  document.getElementById('folded-sheet-close').addEventListener('click', () => {
    retroAudio.playButtonBlip();
    document.body.classList.remove('drawer-open');
  });

  // Search Input inside the Right Main Screen
  const searchInput = document.getElementById('search-input');
  const clearBtn = document.getElementById('btn-clear-search');

  searchInput.addEventListener('input', (e) => {
    clearBtn.classList.toggle('hidden', !e.target.value);
  });

  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && searchInput.value.trim()) {
      retroAudio.playButtonBlip();
      loadPokemon(searchInput.value.trim());
      searchInput.blur();
    }
  });

  clearBtn.addEventListener('click', () => {
    searchInput.value = '';
    clearBtn.classList.add('hidden');
  });

  // Keyboard Navigation
  window.addEventListener('keydown', (e) => {
    if (document.activeElement === searchInput) return;
    if (e.key === 'ArrowRight') stepPokemon(1);
    else if (e.key === 'ArrowLeft') stepPokemon(-1);
    else if (e.key === 'ArrowUp') {
      e.preventDefault();
      stepPokemon(-10);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      stepPokemon(10);
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  foldableDetector.init();
  cameraScanner.updateKeyBadge();
  initEventListeners();
  loadPokemon(1);
});
