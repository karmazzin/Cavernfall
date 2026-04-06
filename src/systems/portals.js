(() => {
  const Game = window.MC2D;
  const { TILE } = Game.constants;
  const { BLOCK } = Game.blocks;
  const { getBlock, setBlock } = Game.world;
  const { ensureDimensions, switchDimension, syncActiveDimension } = Game.state;
  const { generateFireDimensionBundle } = Game.generation;

  function findTouchedPortal(state) {
    const x0 = Math.floor(state.player.x / TILE);
    const x1 = Math.floor((state.player.x + state.player.w - 1) / TILE);
    const y0 = Math.floor(state.player.y / TILE);
    const y1 = Math.floor((state.player.y + state.player.h - 1) / TILE);
    for (let ty = y0; ty <= y1; ty += 1) {
      for (let tx = x0; tx <= x1; tx += 1) {
        if (getBlock(state, tx, ty) === BLOCK.FIRE_PORTAL) return { tx, ty };
      }
    }
    return null;
  }

  function findUsablePortal(state, input, camera) {
    const playerCx = state.player.x + state.player.w / 2;
    const playerCy = state.player.y + state.player.h / 2;
    let best = null;
    let bestDist = Infinity;

    if (input && input.mouse && camera) {
      const tx = Math.floor((input.mouse.x / Game.constants.VIEW_ZOOM + camera.x) / TILE);
      const ty = Math.floor((input.mouse.y / Game.constants.VIEW_ZOOM + camera.y) / TILE);
      if (getBlock(state, tx, ty) === BLOCK.FIRE_PORTAL) {
        const dist = Math.hypot(tx * TILE + TILE / 2 - playerCx, ty * TILE + TILE / 2 - playerCy);
        if (dist <= 110) return { tx, ty };
      }
    }

    const centerTx = Math.floor(playerCx / TILE);
    const centerTy = Math.floor(playerCy / TILE);
    for (let ty = centerTy - 3; ty <= centerTy + 3; ty += 1) {
      for (let tx = centerTx - 3; tx <= centerTx + 3; tx += 1) {
        if (getBlock(state, tx, ty) !== BLOCK.FIRE_PORTAL) continue;
        const dist = Math.hypot(tx * TILE + TILE / 2 - playerCx, ty * TILE + TILE / 2 - playerCy);
        if (dist <= 110 && dist < bestDist) {
          bestDist = dist;
          best = { tx, ty };
        }
      }
    }
    return best;
  }

  function placePlayerAtPortal(state, tx, ty) {
    state.player.x = tx * TILE + 2;
    state.player.y = (ty - 1) * TILE;
    state.player.vx = 0;
    state.player.vy = 0;
    state.player.onGround = false;
    state.player.portalCooldown = 0.9;
    state.breaking = null;
  }

  function ensureFireLink(state, originPortal) {
    ensureDimensions(state);
    if (!state.dimensions.fire) {
      syncActiveDimension(state);
      state.dimensions.fire = generateFireDimensionBundle(state.worldMeta, state.worldMeta && state.worldMeta.seed);
    }
    if (!state.portalLinks.fireGate) {
      const fireMeta = state.dimensions.fire.fireWorldMeta || { portalX: Math.floor(420), portalY: Math.floor(64) };
      state.portalLinks.fireGate = {
        overworld: { x: originPortal.tx, y: originPortal.ty },
        fire: { x: fireMeta.portalX, y: fireMeta.portalY },
      };
    }
  }

  function teleportViaPortal(state, touched) {
    if (!touched) return false;
    if (state.activeDimension === 'overworld') {
      ensureFireLink(state, touched);
      const link = state.portalLinks.fireGate;
      switchDimension(state, 'fire');
      if (Game.achievementsSystem) Game.achievementsSystem.recordEvent(state, 'enter_fire_dimension');
      setBlock(state, link.fire.x, link.fire.y, BLOCK.FIRE_PORTAL);
      placePlayerAtPortal(state, link.fire.x, link.fire.y);
      return true;
    }

    if (state.activeDimension === 'fire' && state.portalLinks.fireGate) {
      const link = state.portalLinks.fireGate;
      switchDimension(state, 'overworld');
      setBlock(state, link.overworld.x, link.overworld.y, BLOCK.FIRE_PORTAL);
      placePlayerAtPortal(state, link.overworld.x, link.overworld.y);
      return true;
    }
    return false;
  }

  function useNearbyPortal(state, input, camera) {
    ensureDimensions(state);
    if ((state.player.portalCooldown || 0) > 0) return false;
    return teleportViaPortal(state, findUsablePortal(state, input, camera));
  }

  function updatePortals(state, dt) {
    ensureDimensions(state);
    state.player.portalCooldown = Math.max(0, (state.player.portalCooldown || 0) - dt);
    if (state.player.portalCooldown > 0) return;

    const touched = findTouchedPortal(state);
    if (!touched) return;
    teleportViaPortal(state, touched);
  }

  Game.portalSystem = { updatePortals, useNearbyPortal, findUsablePortal };
})();
