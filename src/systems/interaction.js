(() => {
  const Game = window.MC2D;
  const { TILE, VIEW_ZOOM } = Game.constants;
  const { BLOCK, PLACEABLE } = Game.blocks;
  const { rand, aabb } = Game.math;
  const { ITEM } = Game.items;
  const { getBlock, setBlock } = Game.world;
  const {
    selectedPlaceableId,
    selectedItemId,
    consumeSelectedPlaceable,
    addToInventory,
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
  const audio = Game.audio;

  function isCreative(state) {
    return !!(state.worldMeta && state.worldMeta.mode === 'creative');
  }

  function getBlockDrop(blockId) {
    if (blockId === BLOCK.COAL_ORE) return { id: ITEM.COAL, count: 1 };
    if (blockId === BLOCK.GOLD_ORE) return { id: ITEM.RAW_GOLD, count: 1 };
    if (blockId === BLOCK.DEEP_ORE) return { id: ITEM.DEEP_CRYSTAL, count: 1 };
    return { id: blockId, count: 1 };
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

  function canPlaceBlock(state, tx, ty, id) {
    if (!PLACEABLE.has(id) && !(isCreative(state) && typeof id === 'number' && id !== BLOCK.AIR && id !== BLOCK.BEDROCK)) return false;
    const targetBlock = getBlock(state, tx, ty);
    if (targetBlock !== BLOCK.AIR && targetBlock !== BLOCK.WATER) return false;

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
    const target = findUsableDoor(state, input, camera);
    if (!target) return false;
    toggleDoor(state, target.tx, target.ty);
    return true;
  }

  function handleMouse(state, input, camera, dt) {
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

    const { tx, ty } = screenToTile(input.mouse.x, input.mouse.y, camera);
    const wx = input.mouse.x / VIEW_ZOOM + camera.x;
    const wy = input.mouse.y / VIEW_ZOOM + camera.y;
    const dist = Math.hypot(
      tx * TILE + TILE / 2 - (state.player.x + state.player.w / 2),
      ty * TILE + TILE / 2 - (state.player.y + state.player.h / 2)
    );

    if (!input.mouse.down || state.gameOver) {
      state.breaking = null;
      input.mouse.justPressed = false;
      return;
    }

    for (let i = state.zombies.length - 1; i >= 0; i -= 1) {
      const zombie = state.zombies[i];
      if (wx >= zombie.x && wx <= zombie.x + zombie.w && wy >= zombie.y && wy <= zombie.y + zombie.h) {
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

    if (block === BLOCK.AIR || block === BLOCK.WATER) {
      if (input.mouse.justPressed) {
        const id = isCreative(state) ? selectedItemId(state) : selectedPlaceableId(state);
        if (id && canPlaceBlock(state, tx, ty, id)) {
          const used = isCreative(state) ? id : consumeSelectedPlaceable(state);
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

    if (!state.breaking || state.breaking.tx !== tx || state.breaking.ty !== ty) {
      state.breaking = { tx, ty, progress: 0, need: getBreakTime(block, selectedToolId(state)), blockId: block };
      audio.playDig();
    }

    if (!Number.isFinite(state.breaking.need)) {
      input.mouse.justPressed = false;
      return;
    }

    state.breaking.progress += dt;
    if (state.breaking.progress >= state.breaking.need) {
      audio.playDig();
      const drop = getBlockDrop(block);
      addToInventory(state, drop.id, drop.count);
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

  Game.interaction = { screenToTile, canPlaceBlock, useNearbyDoor, handleMouse };
})();
