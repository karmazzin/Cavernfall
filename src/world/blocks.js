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
    PLANK: 9,
    COBWEB: 10,
    COAL_ORE: 11,
    TORCH: 12,
    FURNACE: 13,
    BLACKSTONE: 14,
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
    [BLOCK.PLANK]: '#b8824d',
    [BLOCK.COBWEB]: '#d8dde5',
    [BLOCK.COAL_ORE]: '#727272',
    [BLOCK.TORCH]: '#7b4f28',
    [BLOCK.FURNACE]: '#666',
    [BLOCK.BLACKSTONE]: '#2f2f35',
  };

  const BREAK_TIME = {
    [BLOCK.GRASS]: 1,
    [BLOCK.DIRT]: 1,
    [BLOCK.WOOD]: 2,
    [BLOCK.PLANK]: 1.6,
    [BLOCK.LEAF]: 1,
    [BLOCK.COBWEB]: 0.7,
    [BLOCK.STONE]: 4,
    [BLOCK.COAL_ORE]: 4,
    [BLOCK.BLACKSTONE]: 5,
    [BLOCK.TORCH]: 0.2,
    [BLOCK.FURNACE]: 4.5,
    [BLOCK.BEDROCK]: Infinity,
    [BLOCK.WATER]: Infinity,
    [BLOCK.LAVA]: Infinity,
  };

  const PLACEABLE = new Set([
    BLOCK.GRASS,
    BLOCK.DIRT,
    BLOCK.STONE,
    BLOCK.WOOD,
    BLOCK.LEAF,
    BLOCK.PLANK,
    BLOCK.BLACKSTONE,
    BLOCK.TORCH,
    BLOCK.FURNACE,
  ]);

  Game.blocks = { BLOCK, BLOCK_COLORS, BREAK_TIME, PLACEABLE };
})();
