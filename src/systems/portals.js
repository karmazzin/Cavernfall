(() => {
  const Game = window.MC2D;
  const { TILE } = Game.constants;
  const { BLOCK } = Game.blocks;
  const { getBlock, setBlock } = Game.world;
  const { ensureDimensions, switchDimension, syncActiveDimension } = Game.state;
  const { generateFireDimensionBundle } = Game.generation;
  const ENTITY_GROUPS = ['animals', 'zombies', 'spiders', 'humans', 'dwarves', 'fireGuards'];

  function findTouchedPortalForRect(state, entity) {
    const x0 = Math.floor(entity.x / TILE);
    const x1 = Math.floor((entity.x + entity.w - 1) / TILE);
    const y0 = Math.floor(entity.y / TILE);
    const y1 = Math.floor((entity.y + entity.h - 1) / TILE);
    for (let ty = y0; ty <= y1; ty += 1) {
      for (let tx = x0; tx <= x1; tx += 1) {
        if (getBlock(state, tx, ty) === BLOCK.FIRE_PORTAL) return { tx, ty };
      }
    }
    return null;
  }

  function findTouchedPortal(state) {
    return findTouchedPortalForRect(state, state.player);
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

  function placeEntityAtPortal(entity, tx, ty) {
    entity.x = tx * TILE + 2;
    entity.y = (ty - 1) * TILE;
    entity.vx = 0;
    entity.vy = 0;
    entity.onGround = false;
    entity.portalCooldown = 0.9;
  }

  function ensureEntityArrays(bundle) {
    if (!bundle || typeof bundle !== 'object') return;
    for (const key of ENTITY_GROUPS) {
      if (!Array.isArray(bundle[key])) bundle[key] = [];
    }
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

  function ensureTargetBundle(state, originPortal) {
    ensureDimensions(state);
    if (state.activeDimension === 'overworld') {
      ensureFireLink(state, originPortal);
      return { name: 'fire', bundle: state.dimensions.fire, portal: state.portalLinks.fireGate.fire };
    }
    if (state.activeDimension === 'fire' && state.portalLinks.fireGate) {
      return { name: 'overworld', bundle: state.dimensions.overworld, portal: state.portalLinks.fireGate.overworld };
    }
    return null;
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

  function updateEntityPortalCooldowns(state, dt) {
    for (const key of ENTITY_GROUPS) {
      const list = state[key];
      if (!Array.isArray(list)) continue;
      for (const entity of list) {
        entity.portalCooldown = Math.max(0, (entity.portalCooldown || 0) - dt);
      }
    }
  }

  function teleportEntitiesViaPortals(state) {
    for (const key of ENTITY_GROUPS) {
      const source = state[key];
      if (!Array.isArray(source)) continue;
      for (let i = source.length - 1; i >= 0; i -= 1) {
        const entity = source[i];
        if ((entity.portalCooldown || 0) > 0) continue;
        const touched = findTouchedPortalForRect(state, entity);
        if (!touched) continue;
        const targetInfo = ensureTargetBundle(state, touched);
        if (!targetInfo || !targetInfo.bundle || !targetInfo.portal) continue;
        ensureEntityArrays(targetInfo.bundle);
        const target = targetInfo.bundle[key];
        if (!Array.isArray(target)) continue;
        setBlock(targetInfo.bundle, targetInfo.portal.x, targetInfo.portal.y, BLOCK.FIRE_PORTAL);
        source.splice(i, 1);
        placeEntityAtPortal(entity, targetInfo.portal.x, targetInfo.portal.y);
        target.push(entity);
      }
    }
  }

  function useNearbyPortal(state, input, camera) {
    ensureDimensions(state);
    if ((state.player.portalCooldown || 0) > 0) return false;
    return teleportViaPortal(state, findUsablePortal(state, input, camera));
  }

  function updatePortals(state, dt) {
    ensureDimensions(state);
    state.player.portalCooldown = Math.max(0, (state.player.portalCooldown || 0) - dt);
    updateEntityPortalCooldowns(state, dt);
    teleportEntitiesViaPortals(state);
    if (state.player.portalCooldown > 0) return;

    const touched = findTouchedPortal(state);
    if (!touched) return;
    teleportViaPortal(state, touched);
  }

  Game.portalSystem = { updatePortals, useNearbyPortal, findUsablePortal };
})();
