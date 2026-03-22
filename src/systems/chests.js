(() => {
  const Game = window.MC2D;
  const { TILE } = Game.constants;
  const { BLOCK } = Game.blocks;
  const { ITEM } = Game.items;
  const { createSlot, createItemStack, normalizeSlot } = Game.inventory;
  const { getBlock } = Game.world;

  function chestKey(tx, ty) {
    return `${tx},${ty}`;
  }

  function createChestState(ownerSettlementId = null) {
    return {
      slots: Array.from({ length: 12 }, () => createSlot()),
      ownerSettlementId,
    };
  }

  function ensureChestMap(state) {
    if (!state.chests) state.chests = {};
    return state.chests;
  }

  function ensureChestAt(state, tx, ty, ownerSettlementId = null) {
    const chests = ensureChestMap(state);
    const key = chestKey(tx, ty);
    if (!chests[key]) chests[key] = createChestState(ownerSettlementId);
    if (ownerSettlementId && !chests[key].ownerSettlementId) chests[key].ownerSettlementId = ownerSettlementId;
    return chests[key];
  }

  function getChestAt(state, tx, ty) {
    return ensureChestMap(state)[chestKey(tx, ty)] || null;
  }

  function removeChestAt(state, tx, ty) {
    const chests = ensureChestMap(state);
    const key = chestKey(tx, ty);
    const chest = chests[key] || null;
    delete chests[key];
    return chest;
  }

  function fillChestLoot(chest) {
    const loot = [
      createItemStack(BLOCK.TORCH, Math.floor(2 + Math.random() * 5)),
      createItemStack(ITEM.COAL, Math.floor(1 + Math.random() * 4)),
      createItemStack(BLOCK.PLANK, Math.floor(4 + Math.random() * 8)),
      createItemStack(BLOCK.STONE, Math.floor(8 + Math.random() * 14)),
    ];
    if (Math.random() < 0.55) loot.push(createItemStack(ITEM.RAW_GOLD, Math.floor(1 + Math.random() * 3)));
    if (Math.random() < 0.45) loot.push(createItemStack(ITEM.GOLD_INGOT, 1));
    if (Math.random() < 0.5) loot.push(createItemStack(ITEM.DEEP_CRYSTAL, Math.floor(1 + Math.random() * 2)));
    if (Math.random() < 0.4) loot.push(createItemStack(BLOCK.LADDER, Math.floor(4 + Math.random() * 8)));
    for (let i = 0; i < chest.slots.length; i += 1) {
      const source = loot[i] || createSlot();
      chest.slots[i] = normalizeSlot({ id: source.id ?? null, count: source.count ?? 0, durability: source.durability ?? null });
    }
  }

  function getNearestChest(state, maxDistanceTiles = 5) {
    const chests = ensureChestMap(state);
    const px = state.player.x + state.player.w / 2;
    const py = state.player.y + state.player.h / 2;
    let best = null;
    let bestDist = maxDistanceTiles * TILE;
    for (const key of Object.keys(chests)) {
      const [tx, ty] = key.split(',').map(Number);
      if (getBlock(state, tx, ty) !== BLOCK.CHEST) continue;
      const cx = tx * TILE + TILE / 2;
      const cy = ty * TILE + TILE / 2;
      const dist = Math.hypot(cx - px, cy - py);
      if (dist <= bestDist) {
        bestDist = dist;
        best = { key, tx, ty, chest: chests[key] };
      }
    }
    return best;
  }

  Game.chestSystem = { chestKey, createChestState, ensureChestAt, getChestAt, removeChestAt, fillChestLoot, getNearestChest };
})();
