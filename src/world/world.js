(() => {
  const Game = window.MC2D;
  const { WORLD_H, WORLD_W, TILE, UPPER_CAVE_END, DWARF_END, DEEP_START } = Game.constants;
  const { BLOCK } = Game.blocks;

  function createGrid() {
    return Array.from({ length: WORLD_H }, () => Array(WORLD_W).fill(BLOCK.AIR));
  }

  function blockSolid(id) {
    if (id === BLOCK.DOOR) return true;
    return (
      id !== BLOCK.AIR &&
      id !== BLOCK.WATER &&
      id !== BLOCK.LAVA &&
      id !== BLOCK.COBWEB &&
      id !== BLOCK.WOOD &&
      id !== BLOCK.LEAF &&
      id !== BLOCK.TORCH &&
      id !== BLOCK.PILLAR &&
      id !== BLOCK.LADDER &&
      id !== BLOCK.CHEST &&
      id !== BLOCK.DRY_BUSH &&
      id !== BLOCK.FIRE_PORTAL
    );
  }

  function isOpenDoorAt(state, tx, ty) {
    const block = getBlock(state, tx, ty);
    if (block !== BLOCK.DOOR) return false;
    const door = state.doors && state.doors[`${tx},${ty}`];
    return !!(door && door.open);
  }

  function liquid(id) {
    return id === BLOCK.WATER || id === BLOCK.LAVA;
  }

  function getBlock(state, tx, ty) {
    if (tx < 0 || tx >= WORLD_W || ty < 0 || ty >= WORLD_H) return BLOCK.BEDROCK;
    return state.world[ty][tx];
  }

  function setBlock(state, tx, ty, id) {
    if (tx < 0 || tx >= WORLD_W || ty < 0 || ty >= WORLD_H) return;
    state.world[ty][tx] = id;
  }

  function isSolidAtPixel(state, px, py) {
    const tx = Math.floor(px / TILE);
    const ty = Math.floor(py / TILE);
    const block = getBlock(state, tx, ty);
    if (block === BLOCK.DOOR) return !isOpenDoorAt(state, tx, ty);
    return blockSolid(block);
  }

  function layerOffset(tx) {
    return Math.round(Math.sin(tx / 37) * 2 + Math.sin(tx / 13) * 1.2);
  }

  function getLocationInfo(state, tx, ty) {
    const safeTx = Math.max(0, Math.min(WORLD_W - 1, tx));
    if (state.activeDimension === 'fire') {
      const fireMeta = state.fireWorldMeta || {};
      const lavaLakeStart = Number.isFinite(fireMeta.lavaLakeStart) ? fireMeta.lavaLakeStart : WORLD_H - 18;
      return {
        biome: ty >= lavaLakeStart ? 'lava_lake' : (state.biomeAt[safeTx] || 'red_land'),
        climate: 'warm',
        inCave: true,
        surfaceY: state.surfaceAt[safeTx] || 0,
      };
    }
    const surfaceY = state.surfaceAt[safeTx];
    const block = getBlock(state, tx, ty);
    const airLike = block === BLOCK.AIR || block === BLOCK.COBWEB || block === BLOCK.TORCH || block === BLOCK.PILLAR || block === BLOCK.LADDER || liquid(block);
    const inCave = ty >= surfaceY + 8 && airLike;
    const offset = layerOffset(safeTx);
    const deepStart = DEEP_START + offset;
    const dwarfEnd = DWARF_END + offset;
    const upperEnd = UPPER_CAVE_END + offset;
    const caveBiome = ty >= deepStart ? 'deep' : ty > upperEnd && ty <= dwarfEnd ? 'dwarf_caves' : 'cave';
    const fireRegion = state.fireCaves && state.fireCaves.region;
    const inFireCaves = !!(fireRegion && tx >= fireRegion.x0 && tx <= fireRegion.x1 && ty >= fireRegion.y0 && ty <= fireRegion.y1);
    const surfaceBiome = state.biomeAt[safeTx];
    const surfaceClimate = state.climateAt && state.climateAt[safeTx] ? state.climateAt[safeTx] : 'temperate';
    const biome = inFireCaves ? 'fire_caves' : inCave ? caveBiome : surfaceBiome;
    const climate = inFireCaves ? 'warm' : inCave || surfaceBiome === 'lake' ? 'any' : surfaceClimate;
    return {
      biome,
      climate,
      inCave,
      surfaceY,
    };
  }

  function getStaticLightRadius(state, tx, ty) {
    const block = getBlock(state, tx, ty);
    if (block === BLOCK.TORCH) return 6;
    if (block === BLOCK.LAVA) return 7;
    if (block === BLOCK.FURNACE) {
      const furnace = state.furnaces && state.furnaces[`${tx},${ty}`];
      return furnace && furnace.burnTime > 0 ? 4 : 0;
    }
    return 0;
  }

  function isLitAt(state, tx, ty) {
    for (let yy = ty - 7; yy <= ty + 7; yy += 1) {
      for (let xx = tx - 7; xx <= tx + 7; xx += 1) {
        const radius = getStaticLightRadius(state, xx, yy);
        if (radius <= 0) continue;
        if (Math.hypot(xx - tx, yy - ty) <= radius) return true;
      }
    }
    return false;
  }

  Game.world = { createGrid, blockSolid, liquid, getBlock, setBlock, isSolidAtPixel, getLocationInfo, isLitAt, getStaticLightRadius, isOpenDoorAt };
})();
