(() => {
  const Game = window.MC2D;
  const { TILE, VIEW_ZOOM, CYCLE, DAY, SUNSET } = Game.constants;
  const { BLOCK, PLACEABLE } = Game.blocks;
  const { rand, aabb } = Game.math;
  const { ITEM } = Game.items;
  const { getBlock, setBlock } = Game.world;
  const {
    selectedPlaceableId,
    selectedItemId,
    consumeSelectedPlaceable,
    addToInventory,
    countItem,
    removeItem,
    selectedToolId,
    selectedToolSlot,
    damageSlotTool,
  } = Game.inventory;
  const { getBreakTime, getAttackDamage } = Game.tools;
  const { spawnFood, ANIMAL_STATE, setWalk } = Game.animalsEntity;
  const { ensureFurnaceAt, removeFurnaceAt } = Game.furnaceSystem;
  const { removeChestAt } = Game.chestSystem;
  const { toggleDoor, removeDoorAt, resolveDoorBase } = Game.doorSystem;
  const { onColonyBlockBroken, hitDwarf, removeDwarf, getNearestTrader } = Game.dwarvesEntity;
  const { getNearestHumanTrader } = Game.humansEntity;
  const { removeFromSlot } = Game.inventory;
  const { phaseInfo } = Game.dayCycle;
  const audio = Game.audio;
  const INVISIBLE_BLOCK_BREAK_FACTOR = 0.4;

  function isCreative(state) {
    return !!(state.worldMeta && state.worldMeta.mode === 'creative');
  }

  function hasCreativePlacement(state) {
    return !!(state.worldMeta && (state.worldMeta.mode === 'creative' || state.worldMeta.mode === 'infinite_inventory'));
  }

  function isSpectator(state) {
    return !!(state.worldMeta && (state.worldMeta.mode === 'spectator' || state.worldMeta.mode === 'hardcore_spectator'));
  }

  function isMobileMode(state) {
    return !!(state.worldMeta && state.worldMeta.mode === 'mobile');
  }

  function getBlockDrop(blockId) {
    if (blockId === BLOCK.COAL_ORE) return { id: ITEM.COAL, count: 1 };
    if (blockId === BLOCK.IRON_ORE) return { id: ITEM.RAW_IRON, count: 1 };
    if (blockId === BLOCK.GOLD_ORE) return { id: ITEM.RAW_GOLD, count: 1 };
    if (blockId === BLOCK.DIAMOND_ORE) return { id: ITEM.SMALL_DIAMOND, count: Math.floor(rand(1, 5)) };
    if (blockId === BLOCK.DEEP_ORE) return { id: ITEM.DEEP_CRYSTAL, count: 1 };
    if (blockId === BLOCK.FRIENDSHIP_ORE) return { id: ITEM.FRIENDSHIP_INGOT, count: 1 };
    if (blockId === BLOCK.STEAM_ORE) return { id: ITEM.STEAM_INGOT, count: 1 };
    return { id: blockId, count: 1 };
  }

  function notifyMedicineRecipe(state) {
    const garden = state.waterWorldMeta && state.waterWorldMeta.goldenGarden;
    if (!garden || garden.recipeShown) return;
    garden.recipeShown = true;
    state.ui.noticeText = 'Рецепт лекарства: сверху и снизу золотой цветок, по бокам хлеб, в центре морковь.';
    state.ui.noticeTimer = 7;
  }

  function releaseFriendlyFireKing(state) {
    if (!state.fireDungeon || !state.friendlyFireKing || state.friendlyFireKing.freed) return;
    const dungeon = state.fireDungeon;
    for (let ty = dungeon.cageY0; ty <= dungeon.cageY1; ty += 1) {
      setBlock(state, dungeon.cageX0, ty, BLOCK.AIR);
      setBlock(state, dungeon.cageX1, ty, BLOCK.AIR);
    }
    for (let tx = dungeon.cageX0; tx <= dungeon.cageX1; tx += 1) {
      setBlock(state, tx, dungeon.cageY0, BLOCK.AIR);
      setBlock(state, tx, dungeon.cageY1, BLOCK.AIR);
    }
    state.friendlyFireKing.freed = true;
    state.friendlyFireKing.state = 'awakening';
    state.friendlyFireKing.stateTimer = 1.1;
    state.friendlyFireKing.targetX = dungeon.centerX * TILE + 18;
    state.fireDungeon.released = true;
    if (Game.achievementsSystem) Game.achievementsSystem.recordEvent(state, 'free_friendly_king');
  }

  function findUsableDungeonSeal(state, input, camera) {
    if (state.activeDimension !== 'fire' || !state.fireDungeon || state.fireDungeon.released) return null;
    const dungeon = state.fireDungeon;
    const playerCx = state.player.x + state.player.w / 2;
    const playerCy = state.player.y + state.player.h / 2;
    const distToSeal = Math.hypot(dungeon.sealX * TILE + TILE / 2 - playerCx, dungeon.sealY * TILE + TILE / 2 - playerCy);
    if (distToSeal > 110) return null;

    if (input && input.mouse && camera) {
      const { tx, ty } = screenToTile(input.mouse.x, input.mouse.y, camera);
      if (tx === dungeon.sealX && ty === dungeon.sealY) return { tx, ty };
    }
    return { tx: dungeon.sealX, ty: dungeon.sealY };
  }

  function useNearbyDungeonSeal(state, input, camera) {
    const target = findUsableDungeonSeal(state, input, camera);
    if (!target) return false;
    if (countItem(state, ITEM.FIRE_DUNGEON_KEY) <= 0) return false;
    releaseFriendlyFireKing(state);
    return true;
  }

  function useSelectedTool(state, amount = 1) {
    const slot = selectedToolSlot(state);
    if (slot) damageSlotTool(slot, amount);
  }

  function screenToTile(mx, my, camera) {
    return {
      tx: Math.floor((mx / VIEW_ZOOM + camera.x) / TILE),
      ty: Math.floor((my / VIEW_ZOOM + camera.y) / TILE),
    };
  }

  function resolvePointerTarget(state, input, camera) {
    const touchMode = !!(state.ui && state.ui.controlMode === 'touch');
    const pointerX = touchMode && input.touchTarget && input.touchTarget.active ? input.touchTarget.x : input.mouse.x;
    const pointerY = touchMode && input.touchTarget && input.touchTarget.active ? input.touchTarget.y : input.mouse.y;
    const worldX = pointerX / VIEW_ZOOM + camera.x;
    const worldY = pointerY / VIEW_ZOOM + camera.y;
    const baseTx = Math.floor(worldX / TILE);
    const baseTy = Math.floor(worldY / TILE);
    let best = { tx: baseTx, ty: baseTy };
    let bestScore = Infinity;
    for (let yy = baseTy - 1; yy <= baseTy + 1; yy += 1) {
      for (let xx = baseTx - 1; xx <= baseTx + 1; xx += 1) {
        const cx = xx * TILE + TILE / 2;
        const cy = yy * TILE + TILE / 2;
        const score = Math.hypot(cx - worldX, cy - worldY);
        if (score < bestScore) {
          bestScore = score;
          best = { tx: xx, ty: yy };
        }
      }
    }
    return {
      tx: best.tx,
      ty: best.ty,
      wx: best.tx * TILE + TILE / 2,
      wy: best.ty * TILE + TILE / 2,
      pointerX,
      pointerY,
    };
  }

  function canPlaceBlock(state, tx, ty, id) {
    if (!PLACEABLE.has(id) && !(hasCreativePlacement(state) && typeof id === 'number' && id !== BLOCK.AIR && id !== BLOCK.BEDROCK)) return false;
    const targetBlock = getBlock(state, tx, ty);
    if (targetBlock !== BLOCK.AIR && targetBlock !== BLOCK.WATER && targetBlock !== BLOCK.LAVA) return false;
    if (id === BLOCK.GOLDEN_FLOWER) {
      const below = getBlock(state, tx, ty + 1);
      if (below !== BLOCK.GRASS && below !== BLOCK.DIRT) return false;
    }

    const blockPx = tx * TILE;
    const blockPy = ty * TILE;
    if (aabb(blockPx, blockPy, TILE, TILE, state.player.x, state.player.y, state.player.w, state.player.h)) return false;

    return true;
  }

  function findUsableDoor(state, input, camera) {
    const candidates = [];
    const playerCx = state.player.x + state.player.w / 2;
    const playerCy = state.player.y + state.player.h / 2;

    if (input && input.mouse) {
      const { tx, ty } = screenToTile(input.mouse.x, input.mouse.y, camera);
      const base = resolveDoorBase(state, tx, ty);
      if (base && getBlock(state, base.tx, base.ty) === BLOCK.DOOR) {
        const dist = Math.hypot(base.tx * TILE + TILE / 2 - playerCx, base.ty * TILE + TILE / 2 - playerCy);
        if (dist <= 110) return base;
      }
    }

    const centerTx = Math.floor(playerCx / TILE);
    const centerTy = Math.floor(playerCy / TILE);
    let best = null;
    let bestDist = Infinity;
    for (let yy = centerTy - 3; yy <= centerTy + 3; yy += 1) {
      for (let xx = centerTx - 3; xx <= centerTx + 3; xx += 1) {
        const base = resolveDoorBase(state, xx, yy);
        if (!base) continue;
        const key = `${base.tx},${base.ty}`;
        if (candidates.includes(key)) continue;
        candidates.push(key);
        const dist = Math.hypot(base.tx * TILE + TILE / 2 - playerCx, base.ty * TILE + TILE / 2 - playerCy);
        if (dist < bestDist && dist <= 110) {
          bestDist = dist;
          best = base;
        }
      }
    }
    return best;
  }

  function useNearbyDoor(state, input, camera) {
    if (isSpectator(state)) return false;
    const target = findUsableDoor(state, input, camera);
    if (!target) return false;
    toggleDoor(state, target.tx, target.ty);
    return true;
  }

  function findUsablePillow(state, input, camera) {
    if (isSpectator(state) || state.player.sleeping) return null;
    const playerCx = state.player.x + state.player.w / 2;
    const playerCy = state.player.y + state.player.h / 2;
    if (input && input.mouse && camera) {
      const { tx, ty } = screenToTile(input.mouse.x, input.mouse.y, camera);
      if (getBlock(state, tx, ty) === BLOCK.PILLOW) {
        const dist = Math.hypot(tx * TILE + TILE / 2 - playerCx, ty * TILE + TILE / 2 - playerCy);
        if (dist <= 110) return { tx, ty };
      }
    }
    const centerTx = Math.floor(playerCx / TILE);
    const centerTy = Math.floor(playerCy / TILE);
    let best = null;
    let bestDist = Infinity;
    for (let yy = centerTy - 3; yy <= centerTy + 3; yy += 1) {
      for (let xx = centerTx - 3; xx <= centerTx + 3; xx += 1) {
        if (getBlock(state, xx, yy) !== BLOCK.PILLOW) continue;
        const dist = Math.hypot(xx * TILE + TILE / 2 - playerCx, yy * TILE + TILE / 2 - playerCy);
        if (dist <= 110 && dist < bestDist) {
          bestDist = dist;
          best = { tx: xx, ty: yy };
        }
      }
    }
    return best;
  }

  function sleepSkipTime(state) {
    const phase = phaseInfo(state).phase;
    const t = state.cycleTime % CYCLE;
    const base = state.cycleTime - t;
    if (phase === 'night') state.cycleTime = base + CYCLE;
    else if (t < DAY + SUNSET) state.cycleTime = base + DAY + SUNSET;
    else state.cycleTime = base + CYCLE + DAY + SUNSET;
  }

  function useNearbyPillow(state, input, camera) {
    const target = findUsablePillow(state, input, camera);
    if (!target) return false;
    if (!Array.isArray(state.player.sleepRespawnHistory)) state.player.sleepRespawnHistory = [];
    const lastPoint = state.player.sleepRespawnHistory[state.player.sleepRespawnHistory.length - 1];
    if (!lastPoint || lastPoint.dimension !== state.activeDimension || lastPoint.tx !== target.tx || lastPoint.ty !== target.ty) {
      state.player.sleepRespawnHistory.push({
        dimension: state.activeDimension,
        tx: target.tx,
        ty: target.ty,
      });
      if (state.player.sleepRespawnHistory.length > 16) state.player.sleepRespawnHistory.shift();
    }
    state.player.sleeping = true;
    state.player.sleepTimer = 0.8;
    state.player.sleepBlockX = target.tx * TILE;
    state.player.sleepBlockY = target.ty * TILE;
    state.player.vx = 0;
    state.player.vy = 0;
    sleepSkipTime(state);
    return true;
  }

  function hasAllFriendshipTools(state) {
    return countItem(state, ITEM.FRIENDSHIP_PICKAXE) > 0 &&
      countItem(state, ITEM.FRIENDSHIP_AXE) > 0 &&
      countItem(state, ITEM.FRIENDSHIP_SHOVEL) > 0 &&
      countItem(state, ITEM.FRIENDSHIP_SWORD) > 0;
  }

  function findUsableWaterCrystal(state, input, camera) {
    if (isSpectator(state) || state.activeDimension === 'fire' || !state.waterCaves || state.waterCaves.crystalTaken) return null;
    const wc = state.waterCaves;
    if (getBlock(state, wc.crystalX, wc.crystalY) !== BLOCK.WATER_CRYSTAL) return null;
    const playerCx = state.player.x + state.player.w / 2;
    const playerCy = state.player.y + state.player.h / 2;
    const dist = Math.hypot(wc.crystalX * TILE + TILE / 2 - playerCx, wc.crystalY * TILE + TILE / 2 - playerCy);
    if (dist > 110) return null;
    if (input && input.mouse && camera) {
      const { tx, ty } = screenToTile(input.mouse.x, input.mouse.y, camera);
      if (tx === wc.crystalX && ty === wc.crystalY) return { tx, ty };
    }
    return { tx: wc.crystalX, ty: wc.crystalY };
  }

  function useNearbyWaterCrystal(state, input, camera) {
    const target = findUsableWaterCrystal(state, input, camera);
    if (!target) return false;
    if (!hasAllFriendshipTools(state)) {
      state.ui.noticeText = 'Нужны все инструменты дружбы.';
      state.ui.noticeTimer = 3;
      return true;
    }
    const wc = state.waterCaves;
    wc.crystalTaken = true;
    wc.krakenSpawned = true;
    setBlock(state, wc.crystalX, wc.crystalY, BLOCK.WATER);
    removeItem(state, BLOCK.WATER_CRYSTAL, 99);
    state.quake = { timer: 1.1, strength: 6 };
    state.attackFlash = Math.max(state.attackFlash || 0, 0.18);
    state.kraken = {
      x: (wc.region.centerX - 2) * TILE,
      y: (wc.region.centerY - 2) * TILE,
      w: 64,
      h: 48,
      hp: 200,
      maxHp: 200,
      phase: 'idle',
      phaseTimer: 0,
      attackCd: 0.6,
      dir: 1,
      vx: 0,
      vy: 0,
      isBoss: true,
      name: 'Кракен',
      arena: {
        x0: wc.region.x0 * TILE,
        x1: (wc.region.x1 + 1) * TILE,
        y0: wc.region.y0 * TILE,
        y1: (wc.region.y1 + 1) * TILE,
      },
    };
    state.ui.noticeText = 'Кракен вырывает Кристалл воды и пробуждается!';
    state.ui.noticeTimer = 4.5;
    return true;
  }

  function findUsableAirCrystal(state, input, camera) {
    if (isSpectator(state) || state.activeDimension !== 'overworld' || !state.airCaves || state.airCaves.crystalTaken) return null;
    const air = state.airCaves;
    if (getBlock(state, air.crystalX, air.crystalY) !== BLOCK.AIR_CRYSTAL) return null;
    const playerCx = state.player.x + state.player.w / 2;
    const playerCy = state.player.y + state.player.h / 2;
    const dist = Math.hypot(air.crystalX * TILE + TILE / 2 - playerCx, air.crystalY * TILE + TILE / 2 - playerCy);
    if (dist > 120) return null;
    return { tx: air.crystalX, ty: air.crystalY };
  }

  function useNearbyAirCrystal(state, input, camera) {
    const target = findUsableAirCrystal(state, input, camera);
    if (!target) return false;
    if (!addToInventory(state, ITEM.AIR_CRYSTAL, 1)) {
      state.ui.noticeText = 'Инвентарь заполнен. Освободи слот для Кристалла воздуха.';
      state.ui.noticeTimer = 3.5;
      return true;
    }
    state.airCaves.crystalTaken = true;
    state.airCaves.cleared = true;
    setBlock(state, target.tx, target.ty, BLOCK.AIR);
    state.ui.noticeText = 'Воздушный кристалл получен. Теперь можно покинуть Воздушные пещеры.';
    state.ui.noticeTimer = 4.5;
    return true;
  }

  function findUsableAirEntrance(state) {
    if (isSpectator(state) || state.activeDimension !== 'overworld' || !state.airCaves || !state.airCaves.entrance) return null;
    const entrance = state.airCaves.entrance;
    if (!entrance.spawned || !entrance.revealed || entrance.guardianSpawned || entrance.guardianDefeated) return null;
    const playerCx = state.player.x + state.player.w / 2;
    const playerCy = state.player.y + state.player.h / 2;
    const dist = Math.hypot(entrance.altarX * TILE + TILE / 2 - playerCx, entrance.altarY * TILE + TILE / 2 - playerCy);
    if (dist > 110) return null;
    return entrance;
  }

  function useNearbyAirEntrance(state) {
    const entrance = findUsableAirEntrance(state);
    if (!entrance) return false;
    if (countItem(state, ITEM.AIR_CRYSTAL) <= 0) {
      state.ui.noticeText = 'Нужен Кристалл воздуха.';
      state.ui.noticeTimer = 3;
      return true;
    }
    removeItem(state, ITEM.AIR_CRYSTAL, 1);
    entrance.crystalPlaced = true;
    entrance.guardianSpawned = true;
    state.airGuardian = {
      x: entrance.centerX * TILE - 18,
      y: (entrance.y0 + 3) * TILE,
      w: 36,
      h: 36,
      hp: 450,
      maxHp: 450,
      vx: 0,
      vy: 0,
      dir: 1,
      phaseTimer: 0,
      isBoss: true,
      name: 'Страж воздуха',
      arena: {
        x0: (entrance.x0 - 6) * TILE,
        x1: (entrance.x1 + 6) * TILE,
        y0: Math.max(0, (entrance.y0 - 6) * TILE),
        y1: Math.min(state.world.length * TILE, (entrance.y1 + 6) * TILE),
      },
    };
    state.ui.noticeText = 'Страж воздуха пробудился.';
    state.ui.noticeTimer = 4;
    return true;
  }

  function findUsableAirThiefPortal(state) {
    if (isSpectator(state) || state.activeDimension !== 'air' || !state.airWorldMeta) return null;
    const meta = state.airWorldMeta;
    const playerCx = state.player.x + state.player.w / 2;
    const playerCy = state.player.y + state.player.h / 2;
    const apartment = meta.thiefPortalApartment || null;
    const refuge = meta.thiefRefuge || null;
    if (apartment && meta.hiddenApartmentsVisible && Number.isFinite(apartment.portalX) && Number.isFinite(apartment.portalY)) {
      const dist = Math.hypot(apartment.portalX * TILE + TILE / 2 - playerCx, apartment.portalY * TILE + TILE / 2 - playerCy);
      if (dist <= 92 && getBlock(state, apartment.portalX, apartment.portalY) === BLOCK.AIR_THIEF_PORTAL) {
        return { type: 'to_refuge', apartment, refuge };
      }
    }
    if (refuge && Number.isFinite(refuge.portalX) && Number.isFinite(refuge.portalY)) {
      const dist = Math.hypot(refuge.portalX * TILE + TILE / 2 - playerCx, refuge.portalY * TILE + TILE / 2 - playerCy);
      if (dist <= 92 && getBlock(state, refuge.portalX, refuge.portalY) === BLOCK.AIR_THIEF_PORTAL) {
        return { type: 'from_refuge', apartment, refuge };
      }
    }
    return null;
  }

  function useNearbyAirThiefPortal(state) {
    const target = findUsableAirThiefPortal(state);
    if (!target) return false;
    if (target.type === 'to_refuge') {
      if (!target.refuge) return false;
      state.player.x = target.refuge.portalX * TILE + 6;
      state.player.y = (target.refuge.portalY - 2) * TILE;
      state.player.vx = 0;
      state.player.vy = 0;
      if (!state.airThief && Game.airThiefEntity && Game.airThiefEntity.createAirThief) {
        state.airThief = Game.airThiefEntity.createAirThief(target.refuge.thiefX, target.refuge.thiefY, {
          x0: (target.refuge.x0 + 1) * TILE,
          x1: target.refuge.x1 * TILE,
          y0: (target.refuge.y0 + 1) * TILE,
          y1: target.refuge.y1 * TILE,
        });
      }
      state.ui.noticeText = 'Ты вошёл в укрытие вора.';
      state.ui.noticeTimer = 3.5;
      return true;
    }
    if (!target.refuge || !target.refuge.cleared) {
      state.ui.noticeText = 'Пока вор жив, выбраться нельзя.';
      state.ui.noticeTimer = 3;
      return true;
    }
    if (target.apartment) {
      state.player.x = target.apartment.centerX * TILE;
      state.player.y = (target.apartment.roomY1 - 2) * TILE;
    } else if (state.airWorldMeta && state.airWorldMeta.castle) {
      state.player.x = state.airWorldMeta.castle.centerX * TILE;
      state.player.y = (state.airWorldMeta.castle.baseY - 3) * TILE;
    } else {
      return false;
    }
    state.player.vx = 0;
    state.player.vy = 0;
    state.ui.noticeText = 'Портал вернул тебя на облако.';
    state.ui.noticeTimer = 3;
    return true;
  }

  function handleMouse(state, input, camera, dt) {
    if (isSpectator(state)) {
      state.breaking = null;
      input.mouse.justPressed = false;
      return;
    }

    if (state.pause && state.pause.open) {
      state.breaking = null;
      input.mouse.justPressed = false;
      return;
    }

    if (state.crafting && state.crafting.open) {
      state.breaking = null;
      input.mouse.justPressed = false;
      return;
    }

    if (isMobileMode(state)) {
      state.breaking = null;
      input.mouse.justPressed = false;
      return;
    }

    const pointer = resolvePointerTarget(state, input, camera);
    const { tx, ty } = pointer;
    const wx = pointer.wx;
    const wy = pointer.wy;
    const rightClick = input.mouse.button === 2;
    const dist = Math.hypot(
      tx * TILE + TILE / 2 - (state.player.x + state.player.w / 2),
      ty * TILE + TILE / 2 - (state.player.y + state.player.h / 2)
    );

    if (!input.mouse.down || state.gameOver) {
      state.breaking = null;
      input.mouse.justPressed = false;
      return;
    }

    if (state.fireBoss && wx >= state.fireBoss.x && wx <= state.fireBoss.x + state.fireBoss.w && wy >= state.fireBoss.y && wy <= state.fireBoss.y + state.fireBoss.h) {
      if (!rightClick && input.mouse.justPressed && Game.firePyramidSystem && Game.firePyramidSystem.hitFireBoss(state)) {
        audio.playHit();
        useSelectedTool(state);
      }
      input.mouse.justPressed = false;
      return;
    }

    if (state.fireKing && wx >= state.fireKing.x && wx <= state.fireKing.x + state.fireKing.w && wy >= state.fireKing.y && wy <= state.fireKing.y + state.fireKing.h) {
      if (!rightClick && input.mouse.justPressed && Game.fireKingEntity && Game.fireKingEntity.hitFireKing(state)) {
        audio.playHit();
        useSelectedTool(state);
      }
      input.mouse.justPressed = false;
      return;
    }

    if (state.kraken && wx >= state.kraken.x && wx <= state.kraken.x + state.kraken.w && wy >= state.kraken.y && wy <= state.kraken.y + state.kraken.h) {
      if (!rightClick && input.mouse.justPressed && Game.krakenEntity && Game.krakenEntity.hitKraken(state)) {
        audio.playHit();
        useSelectedTool(state);
      }
      input.mouse.justPressed = false;
      return;
    }

    if (state.goldenFlowerGuardian && wx >= state.goldenFlowerGuardian.x && wx <= state.goldenFlowerGuardian.x + state.goldenFlowerGuardian.w && wy >= state.goldenFlowerGuardian.y && wy <= state.goldenFlowerGuardian.y + state.goldenFlowerGuardian.h) {
      if (!rightClick && input.mouse.justPressed && Game.goldenFlowerGuardianEntity && Game.goldenFlowerGuardianEntity.hitGoldenFlowerGuardian(state)) {
        audio.playHit();
        useSelectedTool(state);
      }
      input.mouse.justPressed = false;
      return;
    }

    if (state.airGuardian && wx >= state.airGuardian.x && wx <= state.airGuardian.x + state.airGuardian.w && wy >= state.airGuardian.y && wy <= state.airGuardian.y + state.airGuardian.h) {
      if (!rightClick && input.mouse.justPressed && Game.airGuardianEntity && Game.airGuardianEntity.hitAirGuardian(state)) {
        audio.playHit();
        useSelectedTool(state);
      }
      input.mouse.justPressed = false;
      return;
    }

    if (state.airThief && wx >= state.airThief.x && wx <= state.airThief.x + state.airThief.w && wy >= state.airThief.y && wy <= state.airThief.y + state.airThief.h) {
      if (!rightClick && input.mouse.justPressed && Game.airThiefEntity && Game.airThiefEntity.hitAirThief(state)) {
        audio.playHit();
        useSelectedTool(state);
      }
      input.mouse.justPressed = false;
      return;
    }

    if (state.evilTrunk && wx >= state.evilTrunk.x && wx <= state.evilTrunk.x + state.evilTrunk.w && wy >= state.evilTrunk.y && wy <= state.evilTrunk.y + state.evilTrunk.h) {
      if (!rightClick && input.mouse.justPressed && Game.evilTrunkEntity && Game.evilTrunkEntity.hitEvilTrunk(state)) {
        audio.playHit();
        useSelectedTool(state);
      }
      input.mouse.justPressed = false;
      return;
    }

    for (let i = state.fireGuards.length - 1; i >= 0; i -= 1) {
      const guard = state.fireGuards[i];
      if (wx >= guard.x && wx <= guard.x + guard.w && wy >= guard.y && wy <= guard.y + guard.h) {
        if (rightClick) {
          input.mouse.justPressed = false;
          return;
        }
        if (!guard.clickCd || guard.clickCd <= 0) {
          guard.hp -= getAttackDamage(selectedToolId(state));
          guard.clickCd = 0.25;
          audio.playHit();
          useSelectedTool(state);
          if (guard.hp <= 0) state.fireGuards.splice(i, 1);
        }
        input.mouse.justPressed = false;
        return;
      }
    }

    for (let i = state.zombies.length - 1; i >= 0; i -= 1) {
      const zombie = state.zombies[i];
      if (wx >= zombie.x && wx <= zombie.x + zombie.w && wy >= zombie.y && wy <= zombie.y + zombie.h) {
        if (rightClick) {
          input.mouse.justPressed = false;
          return;
        }
        if (!zombie.clickCd || zombie.clickCd <= 0) {
          zombie.hp -= getAttackDamage(selectedToolId(state));
          zombie.clickCd = 0.25;
          audio.playHit();
          useSelectedTool(state);
          if (zombie.hp <= 0) state.zombies.splice(i, 1);
        }
        input.mouse.justPressed = false;
        return;
      }
    }

    for (let i = state.spiders.length - 1; i >= 0; i -= 1) {
      const spider = state.spiders[i];
      if (wx >= spider.x && wx <= spider.x + spider.w && wy >= spider.y && wy <= spider.y + spider.h) {
        if (rightClick) {
          input.mouse.justPressed = false;
          return;
        }
        if (!spider.clickCd || spider.clickCd <= 0) {
          spider.hp -= getAttackDamage(selectedToolId(state));
          spider.clickCd = 0.25;
          audio.playHit();
          useSelectedTool(state);
          if (spider.hp <= 0) state.spiders.splice(i, 1);
        }
        input.mouse.justPressed = false;
        return;
      }
    }

    for (let i = state.animals.length - 1; i >= 0; i -= 1) {
      const animal = state.animals[i];
      if (wx >= animal.x && wx <= animal.x + animal.w && wy >= animal.y && wy <= animal.y + animal.h) {
        if (rightClick) {
          input.mouse.justPressed = false;
          return;
        }
        if (!animal.clickCd || animal.clickCd <= 0) {
          animal.hp -= getAttackDamage(selectedToolId(state));
          animal.clickCd = 0.25;
          animal.state = ANIMAL_STATE.PANIC;
          animal.stateTimer = rand(2.2, 3.8);
          animal.dir = animal.x < state.player.x ? -1 : 1;
          animal.grazing = false;
          animal.edgeCooldown = 0.35;
          setWalk(animal, true);
          animal.state = ANIMAL_STATE.PANIC;
          animal.stateTimer = rand(2.2, 3.8);
          audio.playHit();
          useSelectedTool(state);
          if (animal.hp <= 0) {
            spawnFood(state, animal.x, animal.y, ITEM.RAW_MUTTON, Math.floor(rand(1, 3)));
            state.animals.splice(i, 1);
          }
        }
        input.mouse.justPressed = false;
        return;
      }
    }

    for (let i = state.dwarves.length - 1; i >= 0; i -= 1) {
      const dwarf = state.dwarves[i];
      if (wx >= dwarf.x && wx <= dwarf.x + dwarf.w && wy >= dwarf.y && wy <= dwarf.y + dwarf.h) {
        const settlement = state.dwarfColony && state.dwarfColony.settlements
          ? state.dwarfColony.settlements.find((entry) => entry.id === dwarf.settlementId)
          : null;
        if (rightClick) {
          input.mouse.justPressed = false;
          return;
        }
        if (input.mouse.justPressed && settlement && !settlement.hostileToPlayer && (settlement.alertLevel || 0) === 0) {
          Game.crafting.openTrade(state, dwarf.settlementId);
          input.mouse.justPressed = false;
          return;
        }
        if (!dwarf.clickCd || dwarf.clickCd <= 0) {
          hitDwarf(state, dwarf, getAttackDamage(selectedToolId(state)));
          dwarf.clickCd = 0.25;
          audio.playHit();
          useSelectedTool(state);
          if (dwarf.hp <= 0) removeDwarf(state, i, true);
        }
        input.mouse.justPressed = false;
        return;
      }
    }

    for (let i = state.humans.length - 1; i >= 0; i -= 1) {
      const human = state.humans[i];
      if (wx >= human.x && wx <= human.x + human.w && wy >= human.y && wy <= human.y + human.h) {
        if (rightClick) {
          input.mouse.justPressed = false;
          return;
        }
        if (input.mouse.justPressed && human.role !== 'guard') {
          Game.crafting.openHumanTrade(state, human.id);
          input.mouse.justPressed = false;
          return;
        }
        input.mouse.justPressed = false;
        return;
      }
    }

    if (dist > 110) {
      state.breaking = null;
      input.mouse.justPressed = false;
      return;
    }

    const block = getBlock(state, tx, ty);

    if (rightClick && input.mouse.justPressed) {
      const slot = state.player.hotbar[state.player.selectedSlot];
      if (slot && slot.id != null && slot.count > 0) {
        const itemId = slot.id;
        const durability = slot.durability ?? null;
        removeFromSlot(slot, 1);
        state.foods.push({
          x: tx * TILE + 3,
          y: ty * TILE + 3,
          w: 10,
          h: 10,
          itemId,
          amount: 1,
          durability,
          t: 0,
        });
      }
      state.breaking = null;
      input.mouse.justPressed = false;
      return;
    }

    if (block === BLOCK.DOOR && input.mouse.justPressed) {
      toggleDoor(state, tx, ty);
      state.breaking = null;
      input.mouse.justPressed = false;
      return;
    }

    if (block === BLOCK.CHEST && input.mouse.justPressed) {
      Game.crafting.openChest(state, tx, ty);
      state.breaking = null;
      input.mouse.justPressed = false;
      return;
    }

    if (block === BLOCK.AIR || block === BLOCK.WATER || block === BLOCK.LAVA) {
      if (input.mouse.justPressed) {
        if (block === BLOCK.AIR && Game.undergroundQuestSystem && Game.undergroundQuestSystem.tryUseFinalAmulet(state, tx, ty)) {
          input.mouse.justPressed = false;
          return;
        }
        if (block === BLOCK.AIR && Game.undergroundQuestSystem && Game.undergroundQuestSystem.tryPlantGreatTreeSapling(state, tx, ty)) {
          input.mouse.justPressed = false;
          return;
        }
        if (Game.spawnEggSystem && Game.spawnEggSystem.tryUseSelectedSpawnEgg(state, tx, ty)) {
          input.mouse.justPressed = false;
          return;
        }
        const id = hasCreativePlacement(state) ? selectedItemId(state) : selectedPlaceableId(state);
        if (id && canPlaceBlock(state, tx, ty, id)) {
          const used = hasCreativePlacement(state) ? id : consumeSelectedPlaceable(state);
          if (used) {
            setBlock(state, tx, ty, used);
            if (used === BLOCK.FURNACE) ensureFurnaceAt(state, tx, ty);
          }
        }
      }
      state.breaking = null;
      input.mouse.justPressed = false;
      return;
    }

    if (isCreative(state)) {
      if (!input.mouse.justPressed) return;
      const drop = getBlockDrop(block);
      addToInventory(state, drop.id, drop.count);
      if (block === BLOCK.GOLDEN_FLOWER && state.activeDimension === 'water' && state.waterWorldMeta && state.waterWorldMeta.goldenGarden) {
        state.waterWorldMeta.goldenGarden.flowerTaken = true;
        notifyMedicineRecipe(state);
      }
      onColonyBlockBroken(state, tx, ty);
      if (block === BLOCK.FURNACE) {
        const furnace = removeFurnaceAt(state, tx, ty);
        if (furnace) {
          for (const slot of [furnace.input, furnace.fuel, furnace.output]) {
            if (slot && slot.id != null && slot.count > 0) addToInventory(state, slot.id, slot.count, slot.durability ?? null);
          }
        }
      }
      if (block === BLOCK.CHEST) {
        const chest = removeChestAt(state, tx, ty);
        if (chest) {
          for (const slot of chest.slots) {
            if (slot && slot.id != null && slot.count > 0) addToInventory(state, slot.id, slot.count, slot.durability ?? null);
          }
        }
      }
      if (block === BLOCK.DOOR) removeDoorAt(state, tx, ty);
      setBlock(state, tx, ty, BLOCK.AIR);
      state.breaking = null;
      input.mouse.justPressed = false;
      return;
    }

    const invisibilityMining = !!(Game.invisibilitySystem && Game.invisibilitySystem.isInvisibilityAmuletSelected(state));
    const invisibleBreakNeed = Number.isFinite(Game.blocks.BREAK_TIME[block])
      ? Math.max(0.25, Game.blocks.BREAK_TIME[block] * INVISIBLE_BLOCK_BREAK_FACTOR)
      : Infinity;

    if (!state.breaking || state.breaking.tx !== tx || state.breaking.ty !== ty) {
      state.breaking = {
        tx,
        ty,
        progress: 0,
        need: invisibilityMining ? invisibleBreakNeed : getBreakTime(block, selectedToolId(state)),
        blockId: block,
        invisibilityMining,
      };
      audio.playDig();
    }

    if (!Number.isFinite(state.breaking.need)) {
      input.mouse.justPressed = false;
      return;
    }

    state.breaking.progress += dt;
    if (state.breaking.progress >= state.breaking.need) {
      audio.playDig();
      if (state.breaking.invisibilityMining && Game.invisibilitySystem) {
        Game.invisibilitySystem.hideBlockWithAmulet(state, tx, ty, block);
        state.breaking = null;
        input.mouse.justPressed = false;
        return;
      }
      const drop = getBlockDrop(block);
      addToInventory(state, drop.id, drop.count);
      if (block === BLOCK.GOLDEN_FLOWER && state.activeDimension === 'water' && state.waterWorldMeta && state.waterWorldMeta.goldenGarden) {
        state.waterWorldMeta.goldenGarden.flowerTaken = true;
        notifyMedicineRecipe(state);
      }
      onColonyBlockBroken(state, tx, ty);
      if (block === BLOCK.FURNACE) {
        const furnace = removeFurnaceAt(state, tx, ty);
        if (furnace) {
          for (const slot of [furnace.input, furnace.fuel, furnace.output]) {
            if (slot && slot.id != null && slot.count > 0) addToInventory(state, slot.id, slot.count, slot.durability ?? null);
          }
        }
      }
      if (block === BLOCK.CHEST) {
        const chest = removeChestAt(state, tx, ty);
        if (chest) {
          for (const slot of chest.slots) {
            if (slot && slot.id != null && slot.count > 0) addToInventory(state, slot.id, slot.count, slot.durability ?? null);
          }
        }
      }
      if (block === BLOCK.DOOR) removeDoorAt(state, tx, ty);
      setBlock(state, tx, ty, BLOCK.AIR);
      useSelectedTool(state);
      state.breaking = null;
    }

    input.mouse.justPressed = false;
  }

  Game.interaction = {
    screenToTile,
    resolvePointerTarget,
    canPlaceBlock,
    useNearbyDoor,
    useNearbyPillow,
    findUsablePillow,
    hasAllFriendshipTools,
    useNearbyWaterCrystal,
    findUsableWaterCrystal,
    useNearbyAirCrystal,
    findUsableAirCrystal,
    useNearbyAirEntrance,
    useNearbyAirThiefPortal,
    useNearbyDungeonSeal,
    findUsableDungeonSeal,
    handleMouse,
  };
})();
