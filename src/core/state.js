(() => {
  const Game = window.MC2D;
  const { WORLD_W, SURFACE_BASE, TILE, HOTBAR_SIZE, BREATH_TOTAL } = Game.constants;
  const { createGrid } = Game.world;

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
      hunger: 100,
      food: 0,
      totalZombieHits: 0,
      selectedSlot: 0,
      hotbar: Array.from({ length: HOTBAR_SIZE }, () => ({ id: null, count: 0 })),
      breath: BREATH_TOTAL,
      inWater: false,
      underwater: false,
    };
  }

  function createGameState() {
    return {
      world: createGrid(),
      biomeAt: Array(WORLD_W).fill('plains'),
      surfaceAt: Array(WORLD_W).fill(SURFACE_BASE),
      animals: [],
      zombies: [],
      foods: [],
      player: createPlayer(),
      gameOver: false,
      cycleTime: 0,
      hungerTick: 0,
      starvingTick: 0,
      zombieSpawnTick: 0,
      attackFlash: 0,
      fluidTick: 0,
      breaking: null,
    };
  }

  Game.state = { createGameState };
})();
