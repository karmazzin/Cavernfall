(() => {
  const Game = window.MC2D;
  const { TILE, WORLD_W } = Game.constants;
  const { BLOCK } = Game.blocks;
  const { getBlock, setBlock } = Game.world;
  const { ensureDimensions, switchDimension, syncActiveDimension } = Game.state;
  const { generateFireDimensionBundle, generateWaterDimensionBundle, generateAirDimensionBundle, generateUndergroundDimensionBundle, generateEndDimensionBundle } = Game.generation;
  const ENTITY_GROUPS = ['animals', 'zombies', 'spiders', 'humans', 'dwarves', 'fireGuards', 'waterfolk', 'windfolk'];

  function portalTypeForBlock(blockId) {
    if (blockId === BLOCK.FIRE_PORTAL) return 'fire';
    if (blockId === BLOCK.WATER_DIMENSION_PORTAL) return 'water';
    if (blockId === BLOCK.AIR_DIMENSION_PORTAL) return 'air';
    if (blockId === BLOCK.AIR_HOME_PORTAL) return 'underground';
    if (blockId === BLOCK.END_GATE) return 'end';
    if (blockId === BLOCK.ELEMENTAL_RETURN_PORTAL) return 'elemental_home';
    return null;
  }

  function findTouchedPortalForRect(state, entity) {
    const x0 = Math.floor(entity.x / TILE);
    const x1 = Math.floor((entity.x + entity.w - 1) / TILE);
    const y0 = Math.floor(entity.y / TILE);
    const y1 = Math.floor((entity.y + entity.h - 1) / TILE);
    for (let ty = y0; ty <= y1; ty += 1) {
      for (let tx = x0; tx <= x1; tx += 1) {
        const type = portalTypeForBlock(getBlock(state, tx, ty));
        if (type) return { tx, ty, type };
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
      const type = portalTypeForBlock(getBlock(state, tx, ty));
      if (type) {
        const dist = Math.hypot(tx * TILE + TILE / 2 - playerCx, ty * TILE + TILE / 2 - playerCy);
        if (dist <= 110) return { tx, ty, type };
      }
    }

    const centerTx = Math.floor(playerCx / TILE);
    const centerTy = Math.floor(playerCy / TILE);
    for (let ty = centerTy - 3; ty <= centerTy + 3; ty += 1) {
      for (let tx = centerTx - 3; tx <= centerTx + 3; tx += 1) {
        const type = portalTypeForBlock(getBlock(state, tx, ty));
        if (!type) continue;
        const dist = Math.hypot(tx * TILE + TILE / 2 - playerCx, ty * TILE + TILE / 2 - playerCy);
        if (dist <= 110 && dist < bestDist) {
          bestDist = dist;
          best = { tx, ty, type };
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

  function ensureWaterLink(state, originPortal) {
    ensureDimensions(state);
    if (!state.dimensions.water) {
      syncActiveDimension(state);
      state.dimensions.water = generateWaterDimensionBundle(state.worldMeta, state.worldMeta && state.worldMeta.seed);
    }
    if (!state.portalLinks.waterGate) {
      const waterMeta = state.dimensions.water.waterWorldMeta || { portalX: Math.floor(420), portalY: Math.floor(24) };
      state.portalLinks.waterGate = {
        overworld: { x: originPortal.tx, y: originPortal.ty },
        water: { x: waterMeta.portalX, y: waterMeta.portalY },
      };
    }
  }

  function ensureAirLink(state, originPortal) {
    ensureDimensions(state);
    if (!state.dimensions.air) {
      syncActiveDimension(state);
      state.dimensions.air = generateAirDimensionBundle(state.worldMeta, state.worldMeta && state.worldMeta.seed);
    }
    if (!state.portalLinks.airGate) {
      const airMeta = state.dimensions.air.airWorldMeta || { portalX: Math.floor(WORLD_W / 2), portalY: 24 };
      state.portalLinks.airGate = {
        overworld: { x: originPortal.tx, y: originPortal.ty },
        air: { x: airMeta.portalX, y: airMeta.portalY },
      };
    }
  }

  function undergroundSourceKey(dimension, tx, ty) {
    return `${dimension}:${tx},${ty}`;
  }

  function ensureUndergroundGateMap(state) {
    if (!state.portalLinks.undergroundGates || typeof state.portalLinks.undergroundGates !== 'object') {
      state.portalLinks.undergroundGates = {};
    }
    return state.portalLinks.undergroundGates;
  }

  function findUndergroundLinkByPortal(state, touched) {
    const links = ensureUndergroundGateMap(state);
    if (state.activeDimension === 'underground') {
      return Object.values(links).find((link) => link && link.underground && link.underground.x === touched.tx && link.underground.y === touched.ty) || null;
    }
    return links[undergroundSourceKey(state.activeDimension, touched.tx, touched.ty)] || null;
  }

  function findFreeUndergroundPortalSpot(state, baseX, baseY) {
    for (let radius = 0; radius <= 14; radius += 1) {
      for (let dx = -radius; dx <= radius; dx += 1) {
        for (let dy = -radius; dy <= radius; dy += 1) {
          const tx = baseX + dx;
          const ty = baseY + dy;
          if (tx < 2 || tx >= WORLD_W - 2 || ty < 2 || ty >= state.dimensions.underground.world.length - 2) continue;
          if (getBlock(state.dimensions.underground, tx, ty) !== BLOCK.AIR) continue;
          const below = getBlock(state.dimensions.underground, tx, ty + 1);
          if (below === BLOCK.AIR) continue;
          const occupied = Object.values(ensureUndergroundGateMap(state)).some((link) => link && link.underground && link.underground.x === tx && link.underground.y === ty);
          if (!occupied) return { x: tx, y: ty };
        }
      }
    }
    return { x: baseX, y: baseY };
  }

  function ensureUndergroundLink(state, originPortal) {
    ensureDimensions(state);
    if (!state.dimensions.underground) {
      syncActiveDimension(state);
      state.dimensions.underground = generateUndergroundDimensionBundle(state.worldMeta, state.worldMeta && state.worldMeta.seed);
    }
    const meta = state.dimensions.underground.undergroundWorldMeta || { spawnX: Math.floor(WORLD_W * 0.18), spawnY: 32 };
    const links = ensureUndergroundGateMap(state);
    const key = undergroundSourceKey(state.activeDimension, originPortal.tx, originPortal.ty);
    const isQuestPortal = !!(
      state.activeDimension === 'air' &&
      state.airWorldMeta &&
      state.airWorldMeta.homePortal &&
      state.airWorldMeta.homePortal.tx === originPortal.tx &&
      state.airWorldMeta.homePortal.ty === originPortal.ty
    );
    if (!links[key]) {
      const undergroundSpot = isQuestPortal
        ? { x: meta.spawnX, y: meta.spawnY }
        : findFreeUndergroundPortalSpot(state, meta.spawnX, meta.spawnY);
      links[key] = {
        mode: isQuestPortal ? 'quest' : 'manual',
        sourceDimension: state.activeDimension,
        source: { x: originPortal.tx, y: originPortal.ty },
        underground: undergroundSpot,
      };
    }
    state.portalLinks.undergroundGate = links[key];
    return links[key];
  }

  function ensureEndLink(state, originPortal) {
    ensureDimensions(state);
    if (!state.dimensions.end) {
      syncActiveDimension(state);
      state.dimensions.end = generateEndDimensionBundle(state.worldMeta, state.worldMeta && state.worldMeta.seed);
    }
    if (!state.portalLinks.endGate) {
      const meta = state.dimensions.end.endWorldMeta || { spawnX: Math.floor(WORLD_W * 0.5), spawnY: 88 };
      state.portalLinks.endGate = {
        source: { x: originPortal.tx, y: originPortal.ty },
        end: { x: meta.spawnX, y: meta.spawnY },
      };
    }
  }

  function portalBlockForType(type) {
    if (type === 'water') return BLOCK.WATER_DIMENSION_PORTAL;
    if (type === 'air') return BLOCK.AIR_DIMENSION_PORTAL;
    if (type === 'underground') return BLOCK.AIR_HOME_PORTAL;
    if (type === 'end') return BLOCK.END_GATE;
    if (type === 'elemental_home') return BLOCK.ELEMENTAL_RETURN_PORTAL;
    return BLOCK.FIRE_PORTAL;
  }

  function ensureTargetBundle(state, originPortal) {
    ensureDimensions(state);
    if (originPortal.type === 'underground') {
      const link = ensureUndergroundLink(state, originPortal);
      return { name: 'underground', bundle: state.dimensions.underground, portal: link.underground, link };
    }
    if (originPortal.type === 'end') {
      ensureEndLink(state, originPortal);
      return { name: 'end', bundle: state.dimensions.end, portal: state.portalLinks.endGate.end };
    }
    if (state.activeDimension === 'overworld' && originPortal.type === 'fire') {
      ensureFireLink(state, originPortal);
      return { name: 'fire', bundle: state.dimensions.fire, portal: state.portalLinks.fireGate.fire };
    }
    if (state.activeDimension === 'overworld' && originPortal.type === 'water') {
      ensureWaterLink(state, originPortal);
      return { name: 'water', bundle: state.dimensions.water, portal: state.portalLinks.waterGate.water };
    }
    if (state.activeDimension === 'overworld' && originPortal.type === 'air') {
      ensureAirLink(state, originPortal);
      return { name: 'air', bundle: state.dimensions.air, portal: state.portalLinks.airGate.air };
    }
    if (state.activeDimension === 'fire' && originPortal.type === 'fire' && state.portalLinks.fireGate) {
      return { name: 'overworld', bundle: state.dimensions.overworld, portal: state.portalLinks.fireGate.overworld };
    }
    if (state.activeDimension === 'water' && originPortal.type === 'water' && state.portalLinks.waterGate) {
      return { name: 'overworld', bundle: state.dimensions.overworld, portal: state.portalLinks.waterGate.overworld };
    }
    if (state.activeDimension === 'air' && originPortal.type === 'air' && state.portalLinks.airGate) {
      return { name: 'overworld', bundle: state.dimensions.overworld, portal: state.portalLinks.airGate.overworld };
    }
    return null;
  }

  function teleportViaPortal(state, touched) {
    if (!touched) return false;
    if (touched.type === 'elemental_home') {
      if (Game.endQuestSystem && Game.endQuestSystem.startEndingScene) {
        Game.endQuestSystem.startEndingScene(state);
        state.player.portalCooldown = 1;
        return true;
      }
      return false;
    }
    if (touched.type === 'underground') {
      const link = findUndergroundLinkByPortal(state, touched) || ensureUndergroundLink(state, touched);
      if (state.activeDimension === 'underground') {
        const targetDimension = link.sourceDimension || 'overworld';
        if (targetDimension !== 'underground' && state.dimensions[targetDimension]) {
          switchDimension(state, targetDimension);
          setBlock(state, link.source.x, link.source.y, BLOCK.AIR_HOME_PORTAL);
          placePlayerAtPortal(state, link.source.x, link.source.y);
          return true;
        }
      } else {
        switchDimension(state, 'underground');
        if (link.mode === 'manual') setBlock(state, link.underground.x, link.underground.y, BLOCK.AIR_HOME_PORTAL);
        placePlayerAtPortal(state, link.underground.x, link.underground.y);
        if (link.mode === 'quest') {
          if (state.undergroundWorldMeta && !state.undergroundWorldMeta.firstArrivalShown) {
            state.undergroundWorldMeta.firstArrivalShown = true;
            state.undergroundWorldMeta.kingIntroPending = true;
            state.undergroundWorldMeta.kingIntroDelay = 5.5;
            state.ui.noticeText = 'Воздушный король: Ой, портал был сломан, что же делать?';
            state.ui.noticeTimer = 5.5;
          }
          const sourceDimension = link.sourceDimension || 'air';
          const sourceBundle = sourceDimension === state.activeDimension ? state : state.dimensions[sourceDimension];
          if (sourceBundle && typeof sourceBundle === 'object' && link.source) {
            setBlock(sourceBundle, link.source.x, link.source.y, BLOCK.AIR);
          }
          if (link.underground) setBlock(state, link.underground.x, link.underground.y, BLOCK.AIR);
          const links = ensureUndergroundGateMap(state);
          delete links[undergroundSourceKey(link.sourceDimension || 'air', link.source.x, link.source.y)];
          state.portalLinks.undergroundGate = null;
        }
        return true;
      }
    }
    if (touched.type === 'end') {
      ensureEndLink(state, touched);
      const link = state.portalLinks.endGate;
      if (state.activeDimension !== 'end') switchDimension(state, 'end');
      placePlayerAtPortal(state, link.end.x, link.end.y);
      return true;
    }
    if (state.activeDimension === 'overworld' && touched.type === 'fire') {
      ensureFireLink(state, touched);
      const link = state.portalLinks.fireGate;
      switchDimension(state, 'fire');
      if (Game.achievementsSystem) Game.achievementsSystem.recordEvent(state, 'enter_fire_dimension');
      setBlock(state, link.fire.x, link.fire.y, BLOCK.FIRE_PORTAL);
      placePlayerAtPortal(state, link.fire.x, link.fire.y);
      return true;
    }
    if (state.activeDimension === 'overworld' && touched.type === 'water') {
      ensureWaterLink(state, touched);
      const link = state.portalLinks.waterGate;
      switchDimension(state, 'water');
      setBlock(state, link.water.x, link.water.y, BLOCK.WATER_DIMENSION_PORTAL);
      placePlayerAtPortal(state, link.water.x, link.water.y);
      return true;
    }
    if (state.activeDimension === 'overworld' && touched.type === 'air') {
      ensureAirLink(state, touched);
      const link = state.portalLinks.airGate;
      switchDimension(state, 'air');
      setBlock(state, link.air.x, link.air.y, BLOCK.AIR_DIMENSION_PORTAL);
      placePlayerAtPortal(state, link.air.x, link.air.y);
      return true;
    }

    if (state.activeDimension === 'fire' && touched.type === 'fire' && state.portalLinks.fireGate) {
      const link = state.portalLinks.fireGate;
      switchDimension(state, 'overworld');
      setBlock(state, link.overworld.x, link.overworld.y, BLOCK.FIRE_PORTAL);
      placePlayerAtPortal(state, link.overworld.x, link.overworld.y);
      return true;
    }
    if (state.activeDimension === 'water' && touched.type === 'water' && state.portalLinks.waterGate) {
      const link = state.portalLinks.waterGate;
      switchDimension(state, 'overworld');
      setBlock(state, link.overworld.x, link.overworld.y, BLOCK.WATER_DIMENSION_PORTAL);
      placePlayerAtPortal(state, link.overworld.x, link.overworld.y);
      return true;
    }
    if (state.activeDimension === 'air' && touched.type === 'air' && state.portalLinks.airGate) {
      const link = state.portalLinks.airGate;
      switchDimension(state, 'overworld');
      setBlock(state, link.overworld.x, link.overworld.y, BLOCK.AIR_DIMENSION_PORTAL);
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
        if (touched.type !== 'underground') setBlock(targetInfo.bundle, targetInfo.portal.x, targetInfo.portal.y, portalBlockForType(touched.type));
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
