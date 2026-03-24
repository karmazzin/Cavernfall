(() => {
  const Game = window.MC2D;
  const { BLOCK, BREAK_TIME } = Game.blocks;
  const { getItemDefinition, isTool } = Game.items;
  const TIER_ORDER = { wood: 0, stone: 1, iron: 2, diamond: 3 };

  function preferredToolForBlock(blockId) {
    if (blockId === BLOCK.STONE || blockId === BLOCK.COAL_ORE || blockId === BLOCK.IRON_ORE || blockId === BLOCK.GOLD_ORE || blockId === BLOCK.DIAMOND_ORE || blockId === BLOCK.BLACKSTONE || blockId === BLOCK.DEEPSTONE || blockId === BLOCK.DEEP_ORE || blockId === BLOCK.FURNACE || blockId === BLOCK.SANDSTONE) return 'pickaxe';
    if (blockId === BLOCK.WOOD || blockId === BLOCK.PLANK) return 'axe';
    if (blockId === BLOCK.DIRT || blockId === BLOCK.GRASS || blockId === BLOCK.SAND) return 'shovel';
    if (blockId === BLOCK.COBWEB) return 'sword';
    return null;
  }

  function requiredHarvestTier(blockId) {
    if (blockId === BLOCK.DIAMOND_ORE) return 'iron';
    return null;
  }

  function getBreakTime(blockId, toolId) {
    const base = BREAK_TIME[blockId] ?? Infinity;
    if (!Number.isFinite(base)) return base;
    const preferred = preferredToolForBlock(blockId);
    const requiredTier = requiredHarvestTier(blockId);
    if (!isTool(toolId)) return requiredTier ? Infinity : base;

    const tool = getItemDefinition(toolId);
    if (!preferred || tool.toolType !== preferred) return requiredTier ? Infinity : base;
    if (requiredTier && (TIER_ORDER[tool.tier] ?? -1) < TIER_ORDER[requiredTier]) return Infinity;

    if (tool.toolType === 'sword') {
      if (tool.tier === 'diamond') return base * 0.0625;
      if (tool.tier === 'iron') return base * 0.125;
      return tool.tier === 'stone' ? base * 0.25 : base * 0.5;
    }
    if (tool.tier === 'diamond') return base * 0.0625;
    if (tool.tier === 'iron') return base * 0.125;
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
