(() => {
  const Game = window.MC2D;
  const { BREATH_TOTAL } = Game.constants;
  const { createSlot, normalizeSlot } = Game.inventory;
  const { getArmorDefense } = Game.items;

  const ARMOR_SLOT_ORDER = ['head', 'chest', 'legs', 'feet'];

  function createArmorSlots() {
    return {
      head: createSlot(),
      chest: createSlot(),
      legs: createSlot(),
      feet: createSlot(),
    };
  }

  function ensureArmorSlots(player) {
    if (!player.armor || typeof player.armor !== 'object') player.armor = createArmorSlots();
    for (const slotId of ARMOR_SLOT_ORDER) {
      player.armor[slotId] = normalizeSlot(player.armor[slotId] || createSlot());
    }
    return player.armor;
  }

  function getArmorValue(state) {
    const armor = ensureArmorSlots(state.player);
    let total = 0;
    for (const slotId of ARMOR_SLOT_ORDER) {
      const slot = armor[slotId];
      if (slot && slot.id != null && slot.count > 0) total += getArmorDefense(slot.id);
    }
    return total;
  }

  function getDamageMultiplier(state) {
    return Math.max(0.32, 1 - getArmorValue(state) * 0.08);
  }

  function applyPlayerDamage(state, amount, options = {}) {
    if (!Number.isFinite(amount) || amount <= 0) return 0;
    if ((state.player.respawnInvuln || 0) > 0) return 0;
    const noDamage = !!(state.worldMeta && (state.worldMeta.mode === 'creative' || state.worldMeta.mode === 'spectator'));
    if (noDamage) return 0;
    const infiniteInventory = !!(state.worldMeta && state.worldMeta.mode === 'infinite_inventory');

    const ignoreArmor = !!options.ignoreArmor;
    const flash = options.flash ?? 0.18;
    const actual = ignoreArmor ? amount : amount * getDamageMultiplier(state);
    state.player.health = Math.max(0, state.player.health - actual);
    if (flash > 0) state.attackFlash = Math.max(state.attackFlash || 0, flash);
    if (state.player.health <= 0) {
      if (infiniteInventory) {
        state.player.health = 10;
        state.player.breath = BREATH_TOTAL;
        state.player.vx = 0;
        state.player.vy = 0;
        state.player.respawnInvuln = 1.25;
        state.attackFlash = Math.max(state.attackFlash || 0, 0.3);
      } else {
        state.gameOver = true;
      }
    }
    return actual;
  }

  Game.combat = {
    ARMOR_SLOT_ORDER,
    createArmorSlots,
    ensureArmorSlots,
    getArmorValue,
    getDamageMultiplier,
    applyPlayerDamage,
  };
})();
