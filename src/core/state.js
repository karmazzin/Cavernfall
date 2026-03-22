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
      health: 10,
      satiety: 100,
      food: 0,
      selectedSlot: 0,
      inventory: Array.from({ length: 27 }, () => createSlot()),
      hotbar: Array.from({ length: HOTBAR_SIZE }, () => createSlot()),
      breath: BREATH_TOTAL,
      inWater: false,
      underwater: false,
      stepSoundTimer: 0,
      swimSoundTimer: 0,
      lavaSoundTimer: 0,
      fallDistance: 0,
    };
  }

  function createGameState() {
    return {
      world: createGrid(),
      biomeAt: Array(WORLD_W).fill('plains'),
      surfaceAt: Array(WORLD_W).fill(SURFACE_BASE),
      animals: [],
      zombies: [],
      spiders: [],
      foods: [],
      furnaces: {},
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
        grid: Array.from({ length: 9 }, () => createSlot()),
        cursor: createSlot(),
        result: null,
      },
      pause: {
        open: false,
        confirmRestart: false,
        statusText: '',
      },
    };
  }

  Game.state = { createGameState };
})();
