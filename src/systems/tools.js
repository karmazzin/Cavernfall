(() => {
  const Game = window.MC2D;
  const { BLOCK, BREAK_TIME } = Game.blocks;
  const { getItemDefinition, isTool } = Game.items;

  function preferredToolForBlock(blockId) {
    if (blockId === BLOCK.STONE || blockId === BLOCK.COAL_ORE || blockId === BLOCK.GOLD_ORE || blockId === BLOCK.BLACKSTONE || blockId === BLOCK.FURNACE) return 'pickaxe';
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

    if (tool.toolType === 'sword') return tool.tier === 'stone' ? base * 0.25 : base * 0.5;
    if (tool.tier === 'stone') return base * 0.25;
    if (tool.tier === 'wood') return base * 0.5;
    return base;
  }

  function getAttackDamage(toolId) {
    if (!isTool(toolId)) return 1;
    return getItemDefinition(toolId).attackDamage || 1;
  }

  Game.tools = { getBreakTime, getAttackDamage };
})();
