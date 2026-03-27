(() => {
  const Game = window.MC2D;
  const { BLOCK } = Game.blocks;
  const { ITEM, getItemDefinition, getMaxDurability } = Game.items;
  const { createItemStack } = Game.inventory;

  function isCreativeMode(state) {
    return !!(state.worldMeta && (state.worldMeta.mode === 'creative' || state.worldMeta.mode === 'infinite_inventory'));
  }

  function getCreativeEntries() {
    const entries = [];
    for (const blockId of Object.values(BLOCK)) {
      if (blockId === BLOCK.AIR || blockId === BLOCK.BEDROCK) continue;
      const def = getItemDefinition(blockId);
      if (!def) continue;
      entries.push(createItemStack(blockId, def.stackLimit > 1 ? def.stackLimit : 1));
    }

    for (const itemId of Object.values(ITEM)) {
      const def = getItemDefinition(itemId);
      if (!def) continue;
      const durability = getMaxDurability(itemId) || null;
      entries.push(createItemStack(itemId, def.stackLimit > 1 ? def.stackLimit : 1, durability));
    }

    return entries;
  }

  Game.creativeInventory = { isCreativeMode, getCreativeEntries };
})();
