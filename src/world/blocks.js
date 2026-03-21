(() => {
  const Game = window.MC2D;

  const BLOCK = {
    AIR: 0,
    GRASS: 1,
    DIRT: 2,
    STONE: 3,
    WOOD: 4,
    LEAF: 5,
    WATER: 6,
    LAVA: 7,
    BEDROCK: 8,
  };

  const BLOCK_COLORS = {
    [BLOCK.GRASS]: '#4caf50',
    [BLOCK.DIRT]: '#8d5a35',
    [BLOCK.STONE]: '#888',
    [BLOCK.WOOD]: '#7b4f28',
    [BLOCK.LEAF]: '#2e8b57',
    [BLOCK.WATER]: '#3d7bff',
    [BLOCK.LAVA]: '#ff6b00',
    [BLOCK.BEDROCK]: '#222',
  };

  const BREAK_TIME = {
    [BLOCK.GRASS]: 1,
    [BLOCK.DIRT]: 1,
    [BLOCK.WOOD]: 2,
    [BLOCK.LEAF]: 1,
    [BLOCK.STONE]: 4,
    [BLOCK.BEDROCK]: Infinity,
    [BLOCK.WATER]: Infinity,
    [BLOCK.LAVA]: Infinity,
  };

  const PLACEABLE = new Set([BLOCK.GRASS, BLOCK.DIRT, BLOCK.STONE, BLOCK.WOOD, BLOCK.LEAF]);

  Game.blocks = { BLOCK, BLOCK_COLORS, BREAK_TIME, PLACEABLE };
})();
