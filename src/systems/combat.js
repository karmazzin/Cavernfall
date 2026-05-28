(() => {
  const Game = window.MC2D;
  const { BREATH_TOTAL, TILE } = Game.constants;
  const { BLOCK } = Game.blocks;
  const { createSlot, normalizeSlot } = Game.inventory;
  const { getBlock } = Game.world;
  const { ITEM, getArmorDefense, getArmorBonusHealth } = Game.items;

  const ARMOR_SLOT_ORDER = ['head', 'chest', 'legs', 'feet'];
  const FRIENDSHIP_ARMOR_BY_SLOT = {
    head: ITEM.FRIENDSHIP_HELMET,
    chest: ITEM.FRIENDSHIP_CHESTPLATE,
    legs: ITEM.FRIENDSHIP_LEGGINGS,
    feet: ITEM.FRIENDSHIP_BOOTS,
  };
  const STEAM_ARMOR_BY_SLOT = {
    head: ITEM.STEAM_HELMET,
    chest: ITEM.STEAM_CHESTPLATE,
    legs: ITEM.STEAM_LEGGINGS,
    feet: ITEM.STEAM_BOOTS,
  };
  const INVISIBLE_ARMOR_BY_SLOT = {
    head: ITEM.INVISIBLE_HELMET,
    chest: ITEM.INVISIBLE_CHESTPLATE,
    legs: ITEM.INVISIBLE_LEGGINGS,
    feet: ITEM.INVISIBLE_BOOTS,
  };

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

  function getArmorHealthBonus(state) {
    const armor = ensureArmorSlots(state.player);
    let total = 0;
    for (const slotId of ARMOR_SLOT_ORDER) {
      const slot = armor[slotId];
      if (slot && slot.id != null && slot.count > 0) total += getArmorBonusHealth(slot.id);
    }
    return total;
  }

  function getMaxHealth(state) {
    return 10 + getArmorHealthBonus(state);
  }

  function clampPlayerHealthToMax(state) {
    const maxHealth = getMaxHealth(state);
    state.player.health = Math.min(state.player.health, maxHealth);
    return maxHealth;
  }

  function hasFullFriendshipArmor(state) {
    const armor = ensureArmorSlots(state.player);
    for (const slotId of ARMOR_SLOT_ORDER) {
      const slot = armor[slotId];
      if (!slot || slot.count <= 0 || slot.id !== FRIENDSHIP_ARMOR_BY_SLOT[slotId]) return false;
    }
    return true;
  }

  function hasFullSteamArmor(state) {
    const armor = ensureArmorSlots(state.player);
    for (const slotId of ARMOR_SLOT_ORDER) {
      const slot = armor[slotId];
      if (!slot || slot.count <= 0 || slot.id !== STEAM_ARMOR_BY_SLOT[slotId]) return false;
    }
    return true;
  }

  function hasFullInvisibilityArmor(state) {
    const armor = ensureArmorSlots(state.player);
    for (const slotId of ARMOR_SLOT_ORDER) {
      const slot = armor[slotId];
      if (!slot || slot.count <= 0 || slot.id !== INVISIBLE_ARMOR_BY_SLOT[slotId]) return false;
    }
    return true;
  }

  function hasFriendshipAmuletAura(state, requireNearbyLava = false) {
    const centerTx = Math.floor((state.player.x + state.player.w / 2) / TILE);
    const centerTy = Math.floor((state.player.y + state.player.h / 2) / TILE);
    for (let yy = centerTy - 7; yy <= centerTy + 7; yy += 1) {
      for (let xx = centerTx - 7; xx <= centerTx + 7; xx += 1) {
        if (getBlock(state, xx, yy) !== BLOCK.FRIENDSHIP_AMULET) continue;
        if (Math.hypot(xx - centerTx, yy - centerTy) > 7) continue;
        if (!requireNearbyLava) return true;
        for (let ly = yy - 3; ly <= yy + 3; ly += 1) {
          for (let lx = xx - 3; lx <= xx + 3; lx += 1) {
            if (getBlock(state, lx, ly) === BLOCK.LAVA) return true;
          }
        }
      }
    }
    return false;
  }

  function getDamageMultiplier(state) {
    return Math.max(0.32, 1 - getArmorValue(state) * 0.08);
  }

  function applyPlayerDamage(state, amount, options = {}) {
    if (!Number.isFinite(amount) || amount <= 0) return 0;
    if ((state.player.respawnInvuln || 0) > 0) return 0;
    if (state.player.steamForm && !options.allowSteamDamage) return 0;
    if ((state.player.invisibilityTimer || 0) > 0 && !options.allowInvisibleDamage) return 0;
    const noDamage = !!(state.worldMeta && (state.worldMeta.mode === 'creative' || state.worldMeta.mode === 'spectator' || state.worldMeta.mode === 'hardcore_spectator'));
    if (noDamage) return 0;
    const infiniteInventory = !!(state.worldMeta && state.worldMeta.mode === 'infinite_inventory');

    const ignoreArmor = !!options.ignoreArmor;
    const flash = options.flash ?? 0.18;
    let actual = ignoreArmor ? amount : amount * getDamageMultiplier(state);
    if (
      Game.endQuestSystem &&
      Game.endQuestSystem.hasFourElementsArtifact &&
      Game.endQuestSystem.hasFourElementsArtifact(state) &&
      (options.elementalKind === 'fire' || options.elementalKind === 'water' || options.elementalKind === 'air' || options.elementalKind === 'earth')
    ) {
      actual *= 0.5;
    }
    state.player.health = Math.max(0, state.player.health - actual);
    if (flash > 0) state.attackFlash = Math.max(state.attackFlash || 0, flash);
    if (state.player.health <= 0) {
      if (infiniteInventory) {
        state.player.health = getMaxHealth(state);
        state.player.breath = BREATH_TOTAL;
        state.player.vx = 0;
        state.player.vy = 0;
        state.player.respawnInvuln = 1.25;
        state.attackFlash = Math.max(state.attackFlash || 0, 0.3);
      }
    }
    return actual;
  }

  Game.combat = {
    ARMOR_SLOT_ORDER,
    createArmorSlots,
    ensureArmorSlots,
    getArmorValue,
    getArmorHealthBonus,
    getMaxHealth,
    clampPlayerHealthToMax,
    hasFullFriendshipArmor,
    hasFullSteamArmor,
    hasFullInvisibilityArmor,
    hasFriendshipAmuletAura,
    getDamageMultiplier,
    applyPlayerDamage,
  };
})();
