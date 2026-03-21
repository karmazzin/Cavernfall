(() => {
  const Game = window.MC2D;
  const { BLOCK, BREAK_TIME } = Game.blocks;
  const { getItemDefinition, isTool } = Game.items;

  function preferredToolForBlock(blockId) {
    if (blockId === BLOCK.STONE) return 'pickaxe';
    if (blockId === BLOCK.WOOD || blockId === BLOCK.PLANK) return 'axe';
    if (blockId === BLOCK.DIRT || blockId === BLOCK.GRASS) return 'shovel';
    if (blockId === BLOCK.COBWEB) return 'sword';
    return null;
  }

  function getBreakTime(blockId, toolId) {
    const base = BREAK_TIME[blockId] ?? Infinity;
    if (!Number.isFinite(base)) return base;
    if (!isTool(toolId)) return base;

    const tool = getItemDefinition(toolId);
    const preferred = preferredToolForBlock(blockId);
    if (!preferred || tool.toolType !== preferred) return base;

    if (tool.toolType === 'sword') return tool.tier === 'stone' ? base * 0.18 : base * 0.32;
    if (tool.tier === 'stone') return base * 0.4;
    if (tool.tier === 'wood') return base * 0.65;
    return base;
  }

  function getAttackDamage(toolId) {
    if (!isTool(toolId)) return 1;
    return getItemDefinition(toolId).attackDamage || 1;
  }

  Game.tools = { getBreakTime, getAttackDamage };
})();
