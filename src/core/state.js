(() => {
  const Game = window.MC2D;
  const { WORLD_W, SURFACE_BASE, TILE, HOTBAR_SIZE, BREATH_TOTAL } = Game.constants;
  const { createGrid } = Game.world;
  const { createSlot } = Game.inventory;

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
      breath: BREATH_TOTAL,
      inWater: false,
      underwater: false,
      onLadder: false,
      creativeFlight: false,
      stepSoundTimer: 0,
      swimSoundTimer: 0,
      lavaSoundTimer: 0,
      fallDistance: 0,
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
        statusText: '',
        fullscreenLabel: 'Полный экран',
      },
      ui: {
        controlMode: 'desktop',
        fps: 0,
        fpsFrames: 0,
        fpsAccum: 0,
      },
    };
  }

  Game.state = { createGameState };
})();
