(() => {
  const Game = window.MC2D;

  Game.constants = {
    TILE: 16,
    VIEW_ZOOM: 1.2,
    WORLD_W: 840,
    WORLD_H: 128,
    SURFACE_BASE: 28,
    UPPER_CAVE_START: 36,
    UPPER_CAVE_END: 68,
    DWARF_START: 69,
    DWARF_END: 98,
    DEEP_START: 99,
    GRAVITY: 1500,
    PLAYER_SPEED: 210,
    JUMP_SPEED: 520,
    SWIM_SPEED: 200,
    ANIMAL_SPAWN_ATTEMPTS: 180,
    MAX_ZOMBIES: 10,
    HOTBAR_SIZE: 9,
    STACK_LIMIT: 99,
    BREATH_MAX: 10,
    BREATH_CELL_SECONDS: 3,
    DAY: 120,
    SUNSET: 10,
    NIGHT: 60,
    SUNRISE: 10,
  };

  Game.constants.BREATH_TOTAL = Game.constants.BREATH_MAX * Game.constants.BREATH_CELL_SECONDS;
  Game.constants.CYCLE = Game.constants.DAY + Game.constants.SUNSET + Game.constants.NIGHT + Game.constants.SUNRISE;
})();
