(() => {
  const Game = window.MC2D;
  const { TILE } = Game.constants;
  const { BLOCK } = Game.blocks;
  const { ITEM } = Game.items;
  const { getBlock, setBlock, blockSolid } = Game.world;
  const { countItem } = Game.inventory;
  const { hasFullSteamArmor } = Game.combat;

  function hasSteamPower(state) {
    return countItem(state, ITEM.STEAM_AMULET) > 0 || hasFullSteamArmor(state);
  }

  function hasSteamAmulet(state) {
    return countItem(state, ITEM.STEAM_AMULET) > 0;
  }

  function canSpawnSteamOre(baseBlock) {
    return baseBlock === BLOCK.STONE || baseBlock === BLOCK.DIRT || baseBlock === BLOCK.GRASS || baseBlock === BLOCK.SAND || baseBlock === BLOCK.BLACKSTONE || baseBlock === BLOCK.DEEPSTONE;
  }

  function rememberTemporaryBlock(state, tx, ty, originalId, timer, effectType, extra = {}) {
    if (!Array.isArray(state.steamEffects)) state.steamEffects = [];
    state.steamEffects.push({ tx, ty, originalId, timer, effectType, ...extra });
  }

  function preservedCloudItem(itemId) {
    return itemId === ITEM.STEAM_AMULET ||
      itemId === ITEM.STEAM_PICKAXE ||
      itemId === ITEM.STEAM_AXE ||
      itemId === ITEM.STEAM_SHOVEL ||
      itemId === ITEM.STEAM_SWORD ||
      itemId === ITEM.STEAM_HELMET ||
      itemId === ITEM.STEAM_CHESTPLATE ||
      itemId === ITEM.STEAM_LEGGINGS ||
      itemId === ITEM.STEAM_BOOTS;
  }

  function spawnDroppedStack(state, x, y, itemId, count, durability = null, pickupDelay = 0) {
    state.foods.push({
      x,
      y,
      w: 12,
      h: 12,
      vx: 0,
      vy: 0,
      t: 0,
      itemId,
      amount: count,
      durability,
      pickupDelay,
    });
  }

  function dropCloudInventory(state) {
    const player = state.player;
    const baseX = player.x + player.w / 2 - 6;
    const baseY = player.y + player.h / 2 - 6;
    const slots = [...player.hotbar, ...player.inventory];
    let droppedAny = false;
    for (let i = 0; i < slots.length; i += 1) {
      const slot = slots[i];
      if (!slot || slot.id == null || slot.count <= 0 || preservedCloudItem(slot.id)) continue;
      spawnDroppedStack(state, baseX + ((i % 6) - 2.5) * 10, baseY + Math.floor(i / 6) * 4, slot.id, slot.count, slot.durability ?? null, 1.1);
      slot.id = null;
      slot.count = 0;
      slot.durability = null;
      droppedAny = true;
    }
    for (const slotId of ['head', 'chest', 'legs', 'feet']) {
      const slot = player.armor && player.armor[slotId];
      if (!slot || slot.id == null || slot.count <= 0 || preservedCloudItem(slot.id)) continue;
      spawnDroppedStack(state, baseX + randOffset(slotId), baseY - 10, slot.id, slot.count, slot.durability ?? null, 1.1);
      slot.id = null;
      slot.count = 0;
      slot.durability = null;
      droppedAny = true;
    }
    return droppedAny;
  }

  function randOffset(key) {
    if (key === 'head') return -18;
    if (key === 'chest') return -6;
    if (key === 'legs') return 6;
    return 18;
  }

  function setSteamForm(state, enabled) {
    const player = state.player;
    if (!!player.steamForm === !!enabled) return false;
    if (enabled) dropCloudInventory(state);
    const oldW = player.w;
    const oldH = player.h;
    const nextW = enabled ? 18 : 12;
    const nextH = enabled ? 26 : 24;
    const feetY = player.y + oldH;
    const centerX = player.x + oldW / 2;
    player.steamForm = !!enabled;
    player.w = nextW;
    player.h = nextH;
    player.x = centerX - nextW / 2;
    player.y = feetY - nextH;
    return true;
  }

  function revealMainWell(state) {
    if (state.activeDimension !== 'water' || !state.waterWorldMeta || !state.waterWorldMeta.mainWell) return false;
    const mainWell = state.waterWorldMeta.mainWell;
    if (mainWell.revealed) return false;
    if (countItem(state, ITEM.MAIN_WELL_MAP) <= 0) return false;
    if (Game.generation && Game.generation.stampMainWell) {
      Game.generation.stampMainWell(state, mainWell.centerX, mainWell.baseY);
      mainWell.revealed = true;
      state.ui.noticeText = 'Главный колодец проявился в воде.';
      state.ui.noticeTimer = 4;
      return true;
    }
    return false;
  }

  function inMainWellWater(state, tx, ty) {
    const mainWell = state.waterWorldMeta && state.waterWorldMeta.mainWell;
    if (!mainWell || !mainWell.revealed) return false;
    return tx >= mainWell.waterX0 && tx <= mainWell.waterX1 && ty >= mainWell.waterY0 && ty <= mainWell.waterY1;
  }

  function tryActivateMainWell(state, food) {
    const meta = state.waterWorldMeta;
    const mainWell = meta && meta.mainWell;
    if (state.activeDimension !== 'water' || !meta || !mainWell || !mainWell.revealed || mainWell.completed) return false;
    if (!food || food.itemId !== ITEM.MEDICINE) return false;
    const tx = Math.floor((food.x + food.w / 2) / TILE);
    const ty = Math.floor((food.y + food.h / 2) / TILE);
    if (!inMainWellWater(state, tx, ty)) return false;
    if (getBlock(state, tx, ty) !== BLOCK.WATER) return false;
    mainWell.completed = true;
    meta.returnAfterWellShown = true;
    state.pause.activeCompassTarget = 'water_castle';
    state.ui.noticeText = 'Лекарство вылито. Подойди к главному водяному.';
    state.ui.noticeTimer = 5;
    return true;
  }

  function useSteamCloud(state) {
    if (!hasSteamPower(state)) return false;
    const player = state.player;
    if (state.worldMeta && (state.worldMeta.mode === 'spectator' || state.worldMeta.mode === 'hardcore_spectator')) return false;
    if (player.steamForm) {
      setSteamForm(state, false);
      player.vy = Math.min(player.vy, 0);
      state.ui.noticeText = 'Ты снова стал человеком.';
      state.ui.noticeTimer = 1.8;
      return true;
    }
    if ((player.steamCloudCooldown || 0) > 0) return false;
    if (player.inWater) return false;
    setSteamForm(state, true);
    player.vy = Math.min(player.vy, -120);
    player.steamCloudCooldown = 1.1;
    state.ui.noticeText = 'Ты превратился в облако пара.';
    state.ui.noticeTimer = 1.8;
    return true;
  }

  function softenFallWithSteam(state, footTx, supportTy) {
    const player = state.player;
    if (!hasSteamPower(state)) return false;
    let solidTy = -1;
    for (let ty = Math.max(1, supportTy); ty < state.world.length - 1; ty += 1) {
      const block = getBlock(state, footTx, ty);
      if (blockSolid(block)) {
        solidTy = ty;
        break;
      }
    }
    if (solidTy <= 0) return false;
    const waterTy = solidTy - 1;
    if (getBlock(state, footTx, waterTy) !== BLOCK.AIR) return false;
    rememberTemporaryBlock(state, footTx, waterTy, BLOCK.AIR, 1.0, 'steam_water', { supportTy: solidTy });
    setBlock(state, footTx, waterTy, BLOCK.STEAM_WATER);
    player.vy = Math.min(player.vy, 0);
    return true;
  }

  function updateSteamQuest(state, dt) {
    if (state.player) state.player.steamCloudCooldown = Math.max(0, (state.player.steamCloudCooldown || 0) - dt);
    revealMainWell(state);
    if (state.activeDimension === 'overworld' && hasSteamAmulet(state) && state.airCaves && (!state.airCaves.entrance || !state.airCaves.entrance.spawned) && Game.generation && Game.generation.spawnAirEntrance) {
      Game.generation.spawnAirEntrance(state);
    }
    const entrance = state.airCaves && state.airCaves.entrance;
    if (state.activeDimension === 'overworld' && entrance && entrance.spawned) {
      const playerCx = state.player.x + state.player.w / 2;
      const playerCy = state.player.y + state.player.h / 2;
      const insideEntrance = playerCx >= entrance.x0 * TILE && playerCx <= (entrance.x1 + 1) * TILE && playerCy >= entrance.y0 * TILE && playerCy <= (entrance.y1 + 1) * TILE;
      if (state.player.steamForm && !entrance.discovered) {
        state.airCaves.lightGuide = { x: entrance.centerX * TILE + TILE / 2, y: entrance.baseY * TILE };
        if (insideEntrance) {
          entrance.discovered = true;
          entrance.revealed = true;
          state.airCaves.lightGuide = null;
          if (state.pause) state.pause.activeCompassTarget = null;
          state.ui.noticeText = 'Свет погас. Вход в воздушное измерение открылся.';
          state.ui.noticeTimer = 4.5;
        }
      } else if (entrance.discovered || !state.player.steamForm) {
        state.airCaves.lightGuide = null;
      }
    } else if (state.airCaves) {
      state.airCaves.lightGuide = null;
    }
    if (!Array.isArray(state.steamEffects) || state.steamEffects.length === 0) return;
    for (let i = state.steamEffects.length - 1; i >= 0; i -= 1) {
      const effect = state.steamEffects[i];
      effect.timer -= dt;
      if (effect.timer > 0) continue;
      const currentBlock = getBlock(state, effect.tx, effect.ty);
      if (currentBlock === BLOCK.STEAM_WATER || currentBlock === BLOCK.CLOUD) {
        setBlock(state, effect.tx, effect.ty, effect.originalId);
        if (effect.effectType === 'steam_water' && Number.isFinite(effect.supportTy)) {
          const ground = getBlock(state, effect.tx, effect.supportTy);
          if (canSpawnSteamOre(ground)) setBlock(state, effect.tx, effect.supportTy, BLOCK.STEAM_ORE);
        }
      }
      state.steamEffects.splice(i, 1);
    }
  }

  Game.steamQuestSystem = {
    revealMainWell,
    tryActivateMainWell,
    useSteamCloud,
    softenFallWithSteam,
    updateSteamQuest,
    hasSteamPower,
    hasSteamAmulet,
    setSteamForm,
    preservedCloudItem,
  };
})();
