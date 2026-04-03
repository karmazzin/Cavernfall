(() => {
  const Game = window.MC2D;
  const { WORLD_W, SURFACE_BASE, TILE, HOTBAR_SIZE, BREATH_TOTAL } = Game.constants;
  const { createGrid } = Game.world;
  const { createSlot } = Game.inventory;
  const { createArmorSlots } = Game.combat;
  const DIMENSION_KEYS = [
    'world',
    'biomeAt',
    'climateAt',
    'surfaceAt',
    'animals',
    'zombies',
    'spiders',
    'fireGuards',
    'humans',
    'dwarves',
    'humanSettlements',
    'dwarfColony',
    'foods',
    'chests',
    'furnaces',
    'doors',
    'fireCaves',
    'firePyramid',
    'fireBoss',
    'fireKing',
    'fireDungeon',
    'friendlyFireKing',
    'fireWorldMeta',
    'zombieSpawnTick',
    'zombieCaveSpawnTick',
    'spiderSpawnTick',
    'spiderCaveSpawnTick',
    'fluidTick',
  ];

  function createPlayer() {
    return {
      x: 20 * TILE,
      y: 0,
      w: 12,
      h: 24,
      vx: 0,
      vy: 0,
      onGround: false,
      facing: 1,
      health: 10,
      satiety: 100,
      food: 0,
      selectedSlot: 0,
      inventory: Array.from({ length: 27 }, () => createSlot()),
      hotbar: Array.from({ length: HOTBAR_SIZE }, () => createSlot()),
      armor: createArmorSlots(),
      breath: BREATH_TOTAL,
      inWater: false,
      underwater: false,
      onLadder: false,
      creativeFlight: false,
      sprinting: false,
      portalCooldown: 0,
      stepSoundTimer: 0,
      swimSoundTimer: 0,
      lavaSoundTimer: 0,
      fallDistance: 0,
      respawnInvuln: 0,
    };
  }

  function createGameState(worldMeta = null) {
    return {
      worldMeta: {
        id: worldMeta && worldMeta.id ? worldMeta.id : null,
        name: worldMeta && worldMeta.name ? worldMeta.name : 'Новый мир',
        seed: worldMeta && worldMeta.seed ? worldMeta.seed : '',
        mode: worldMeta && worldMeta.mode ? worldMeta.mode : 'survival',
        createdAt: worldMeta && worldMeta.createdAt ? worldMeta.createdAt : Date.now(),
        updatedAt: worldMeta && worldMeta.updatedAt ? worldMeta.updatedAt : Date.now(),
      },
      world: createGrid(),
      biomeAt: Array(WORLD_W).fill('plains'),
      climateAt: Array(WORLD_W).fill('temperate'),
      surfaceAt: Array(WORLD_W).fill(SURFACE_BASE),
      animals: [],
      zombies: [],
      spiders: [],
      fireGuards: [],
      humans: [],
      dwarves: [],
      humanSettlements: {
        villages: [],
        nodes: [],
        edges: [],
      },
      dwarfColony: {
        homes: [],
        stockpiles: [],
        halls: [],
        shafts: [],
        worksites: [],
        nodes: [],
        edges: [],
        settlements: [],
      },
      foods: [],
      chests: {},
      furnaces: {},
      doors: {},
      fireCaves: {
        region: null,
        shrine: null,
      },
      firePyramid: null,
      fireBoss: null,
      fireKing: null,
      fireDungeon: null,
      friendlyFireKing: null,
      fireWorldMeta: null,
      dimensions: {
        overworld: null,
        fire: null,
      },
      activeDimension: 'overworld',
      portalLinks: {
        fireGate: null,
      },
      player: createPlayer(),
      gameOver: false,
      cycleTime: 0,
      satietyTick: 0,
      starvationTick: 0,
      regenTick: 0,
      zombieSpawnTick: 0,
      zombieCaveSpawnTick: 0,
      spiderSpawnTick: 0,
      spiderCaveSpawnTick: 0,
      attackFlash: 0,
      fluidTick: 0,
      friendshipAmuletTick: 0,
      autosaveTick: 0,
      breaking: null,
      crafting: {
        open: false,
        tab: 'craft',
        grid: Array.from({ length: 9 }, () => createSlot()),
        cursor: createSlot(),
        result: null,
        chestOpenKey: null,
        tradeSettlementId: null,
        tradeHumanId: null,
        tradeStatus: '',
      },
      pause: {
        open: false,
        confirmRestart: false,
        showControls: false,
        showModePicker: false,
        statusText: '',
        fullscreenLabel: 'Полный экран',
      },
      ui: {
        controlMode: 'desktop',
        fps: 0,
        fpsFrames: 0,
        fpsAccum: 0,
        noticeText: '',
        noticeTimer: 0,
      },
    };
  }

  function captureDimensionState(state) {
    const bundle = {};
    for (const key of DIMENSION_KEYS) bundle[key] = state[key];
    return bundle;
  }

  function applyDimensionState(state, bundle) {
    if (!bundle) return;
    for (const key of DIMENSION_KEYS) state[key] = bundle[key];
  }

  function ensureDimensions(state) {
    if (!state.dimensions || typeof state.dimensions !== 'object') {
      state.dimensions = { overworld: null, fire: null };
    }
    if (!state.dimensions.overworld) state.dimensions.overworld = captureDimensionState(state);
    if (!state.activeDimension) state.activeDimension = 'overworld';
    if (!state.portalLinks || typeof state.portalLinks !== 'object') state.portalLinks = { fireGate: null };
    if (!('fireGate' in state.portalLinks)) state.portalLinks.fireGate = null;
  }

  function syncActiveDimension(state) {
    ensureDimensions(state);
    state.dimensions[state.activeDimension] = captureDimensionState(state);
  }

  function switchDimension(state, name) {
    ensureDimensions(state);
    if (!state.dimensions[name]) return false;
    state.dimensions[state.activeDimension] = captureDimensionState(state);
    state.activeDimension = name;
    applyDimensionState(state, state.dimensions[name]);
    state.breaking = null;
    if (state.crafting) {
      state.crafting.chestOpenKey = null;
      state.crafting.tradeSettlementId = null;
      state.crafting.tradeHumanId = null;
      state.crafting.tradeStatus = '';
    }
    return true;
  }

  Game.state = { createGameState, captureDimensionState, applyDimensionState, ensureDimensions, syncActiveDimension, switchDimension, DIMENSION_KEYS };
})();
