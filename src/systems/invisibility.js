(() => {
  const Game = window.MC2D;
  const { TILE, WORLD_W, WORLD_H } = Game.constants;
  const { BLOCK } = Game.blocks;
  const { getBlock, setBlock, isSolidAtPixel } = Game.world;
  const { ITEM } = Game.items;
  const { countItem, selectedItemId } = Game.inventory;

  const INVISIBILITY_DURATION = 60;

  function ensureInvisibilityState(state) {
    if (!Array.isArray(state.invisibilityBlocks)) state.invisibilityBlocks = [];
    if (!Number.isFinite(state.invisibilityGroupSeed)) state.invisibilityGroupSeed = 1;
  }

  function hasInvisibilityAmulet(state) {
    return countItem(state, ITEM.INVISIBILITY_AMULET) > 0;
  }

  function isInvisibilityAmuletSelected(state) {
    return selectedItemId(state) === ITEM.INVISIBILITY_AMULET;
  }

  function isPlayerInvisible(state) {
    return (state.player.invisibilityTimer || 0) > 0;
  }

  function isPlayerUndetectable(state) {
    return isPlayerInvisible(state);
  }

  function canPhaseInvisibleBlocks(state) {
    return hasInvisibilityAmulet(state);
  }

  function useInvisibilityAmulet(state) {
    if (!isInvisibilityAmuletSelected(state)) return false;
    if (!hasInvisibilityAmulet(state)) return false;
    state.player.invisibilityTimer = INVISIBILITY_DURATION;
    state.ui.noticeText = 'Амулет невидимости скрыл тебя на 1 минуту.';
    state.ui.noticeTimer = 3.5;
    return true;
  }

  function nextInvisibleGroupId(state) {
    ensureInvisibilityState(state);
    const id = state.invisibilityGroupSeed;
    state.invisibilityGroupSeed += 1;
    return id;
  }

  function getAdjacentInvisibleGroupIds(state, tx, ty) {
    ensureInvisibilityState(state);
    const ids = new Set();
    for (const entry of state.invisibilityBlocks) {
      if (Math.abs(entry.tx - tx) + Math.abs(entry.ty - ty) === 1) ids.add(entry.groupId);
    }
    return [...ids];
  }

  function mergeInvisibleGroups(state, targetId, sourceIds) {
    if (!sourceIds.length) return;
    for (const entry of state.invisibilityBlocks) {
      if (sourceIds.includes(entry.groupId)) entry.groupId = targetId;
    }
  }

  function hideBlockWithAmulet(state, tx, ty, originalId) {
    ensureInvisibilityState(state);
    const adjacent = getAdjacentInvisibleGroupIds(state, tx, ty);
    const groupId = adjacent[0] || nextInvisibleGroupId(state);
    if (adjacent.length > 1) mergeInvisibleGroups(state, groupId, adjacent.slice(1));
    setBlock(state, tx, ty, BLOCK.INVISIBLE_BLOCK);
    state.invisibilityBlocks.push({
      tx,
      ty,
      originalId,
      groupId,
      timer: INVISIBILITY_DURATION,
    });
  }

  function canFitPlayerAt(state, px, py) {
    const player = state.player;
    return !(
      isSolidAtPixel(state, px + 1, py + 1, player) ||
      isSolidAtPixel(state, px + player.w - 1, py + 1, player) ||
      isSolidAtPixel(state, px + 1, py + player.h - 1, player) ||
      isSolidAtPixel(state, px + player.w - 1, py + player.h - 1, player)
    );
  }

  function movePlayerToNearestFreeSpace(state) {
    const player = state.player;
    if (canFitPlayerAt(state, player.x, player.y)) return;
    const baseTx = Math.floor((player.x + player.w / 2) / TILE);
    const baseTy = Math.floor((player.y + player.h / 2) / TILE);
    for (let radius = 0; radius <= 24; radius += 1) {
      for (let ty = baseTy - radius; ty <= baseTy + radius; ty += 1) {
        for (let tx = baseTx - radius; tx <= baseTx + radius; tx += 1) {
          if (tx < 0 || tx >= WORLD_W || ty < 0 || ty >= WORLD_H) continue;
          const px = tx * TILE + 2;
          const py = ty * TILE + TILE - player.h - 1;
          if (!canFitPlayerAt(state, px, py)) continue;
          player.x = px;
          player.y = py;
          player.vx = 0;
          player.vy = 0;
          player.onGround = false;
          return;
        }
      }
    }
  }

  function spawnInvisibleOreFromGroup(state, entries) {
    if (!entries.length) return;
    let sumX = 0;
    let sumY = 0;
    for (const entry of entries) {
      sumX += entry.tx;
      sumY += entry.ty;
    }
    const oreTx = Math.round(sumX / entries.length);
    const oreTy = Math.round(sumY / entries.length);
    if (oreTx < 0 || oreTx >= WORLD_W || oreTy < 0 || oreTy >= WORLD_H) return;
    setBlock(state, oreTx, oreTy, BLOCK.INVISIBLE_ORE);
  }

  function updateInvisibleBlocks(state, dt) {
    ensureInvisibilityState(state);
    if (!state.invisibilityBlocks.length) return;
    const expiredGroups = new Map();
    for (const entry of state.invisibilityBlocks) {
      entry.timer -= dt;
      if (entry.timer <= 0) {
        if (!expiredGroups.has(entry.groupId)) expiredGroups.set(entry.groupId, []);
        expiredGroups.get(entry.groupId).push(entry);
      }
    }
    if (!expiredGroups.size) return;

    state.invisibilityBlocks = state.invisibilityBlocks.filter((entry) => entry.timer > 0);
    for (const entries of expiredGroups.values()) {
      for (const entry of entries) setBlock(state, entry.tx, entry.ty, entry.originalId);
      spawnInvisibleOreFromGroup(state, entries);
    }
    movePlayerToNearestFreeSpace(state);
  }

  function updateInvisibility(state, dt) {
    ensureInvisibilityState(state);
    if ((state.player.invisibilityTimer || 0) > 0) {
      state.player.invisibilityTimer = Math.max(0, state.player.invisibilityTimer - dt);
      if (state.player.invisibilityTimer <= 0) {
        state.ui.noticeText = 'Невидимость рассеялась.';
        state.ui.noticeTimer = 2.4;
      }
    }
    updateInvisibleBlocks(state, dt);
  }

  Game.invisibilitySystem = {
    INVISIBILITY_DURATION,
    ensureInvisibilityState,
    hasInvisibilityAmulet,
    isInvisibilityAmuletSelected,
    isPlayerInvisible,
    isPlayerUndetectable,
    canPhaseInvisibleBlocks,
    useInvisibilityAmulet,
    hideBlockWithAmulet,
    updateInvisibility,
  };
})();
