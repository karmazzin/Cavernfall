(() => {
  const Game = window.MC2D;
  const { WORLD_H, WORLD_W, TILE, UPPER_CAVE_END, DWARF_END, DEEP_START } = Game.constants;
  const { BLOCK } = Game.blocks;
  const BIOME_LABELS = {
    plains: 'Равнина',
    forest: 'Лес',
    mountains: 'Горы',
    snow_plains: 'Снежная равнина',
    desert: 'Пустыня',
    volcano: 'Вулкан',
    cave: 'Пещера',
    dwarf_caves: 'Пещеры гномов',
    deep: 'Глубины',
    fire_caves: 'Огненные пещеры',
    water_caves: 'Водные пещеры',
    red_land: 'Красная земля',
    lava_lake: 'Лавовое озеро',
    water_surface: 'Водная гладь',
    water_floor: 'Дно',
    golden_garden: 'Сад золотых цветков',
    air_caves: 'Воздушные пещеры',
    air_isles: 'Облачные острова',
    air_void: 'Небесная пустота',
    lake: 'Озеро',
    void: 'Пустота',
  };
  const SINGLE_BIOME_EXCLUDED = new Set(['lake', 'void']);
  const SINGLE_BIOME_CAVE_SET = new Set(['cave', 'dwarf_caves', 'deep', 'fire_caves', 'water_caves', 'air_caves']);
  const SINGLE_BIOME_FIRE_SET = new Set(['red_land', 'lava_lake']);
  const SINGLE_BIOME_WATER_SET = new Set(['water_surface', 'water_floor', 'golden_garden']);

  function biomeLabel(biome) {
    return BIOME_LABELS[biome] || biome;
  }

  function getSelectableSingleBiomes() {
    return Object.keys(BIOME_LABELS).filter((biome) => !SINGLE_BIOME_EXCLUDED.has(biome));
  }

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
      id !== BLOCK.SPRUCE_WOOD &&
      id !== BLOCK.LEAF &&
      id !== BLOCK.SPRUCE_LEAF &&
      id !== BLOCK.TORCH &&
      id !== BLOCK.PILLAR &&
      id !== BLOCK.LADDER &&
      id !== BLOCK.CHEST &&
      id !== BLOCK.DRY_BUSH &&
      id !== BLOCK.FIRE_PORTAL &&
      id !== BLOCK.WATER_DIMENSION_PORTAL &&
      id !== BLOCK.AIR_CRYSTAL &&
      id !== BLOCK.AIR_DIMENSION_PORTAL &&
      id !== BLOCK.FRIENDSHIP_AMULET &&
      id !== BLOCK.WATER_CRYSTAL &&
      id !== BLOCK.GOLDEN_GARDEN_SHELL &&
      id !== BLOCK.STEAM_WATER
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
    const singleBiome = state.worldMeta && state.worldMeta.worldType === 'single_biome' ? state.worldMeta.singleBiome : null;
    if (singleBiome && SINGLE_BIOME_CAVE_SET.has(singleBiome)) {
      const biome = state.biomeAt[safeTx] || singleBiome;
      return {
        biome,
        climate: biome === 'fire_caves' ? 'warm' : 'any',
        inCave: true,
        surfaceY: state.surfaceAt[safeTx] || 0,
      };
    }
    if (singleBiome && SINGLE_BIOME_FIRE_SET.has(singleBiome)) {
      return {
        biome: state.biomeAt[safeTx] || singleBiome,
        climate: 'warm',
        inCave: true,
        surfaceY: state.surfaceAt[safeTx] || 0,
      };
    }
    if (singleBiome && SINGLE_BIOME_WATER_SET.has(singleBiome)) {
      return {
        biome: state.biomeAt[safeTx] || singleBiome,
        climate: 'any',
        inCave: false,
        surfaceY: state.surfaceAt[safeTx] || 0,
      };
    }
    if (state.worldMeta && state.worldMeta.worldType === 'cavern') {
      const biome = state.worldMeta.cavernBiome && state.worldMeta.cavernBiome !== 'mix'
        ? state.worldMeta.cavernBiome
        : (state.biomeAt[safeTx] || 'cave');
      return {
        biome,
        climate: biome === 'fire_caves' ? 'warm' : 'any',
        inCave: true,
        surfaceY: state.surfaceAt[safeTx] || 0,
      };
    }
    if (state.worldMeta && state.worldMeta.worldType === 'floating_islands') {
      const surfaceBiome = state.biomeAt[safeTx] || 'void';
      return {
        biome: surfaceBiome,
        climate: surfaceBiome === 'void' ? 'any' : (state.climateAt && state.climateAt[safeTx] ? state.climateAt[safeTx] : 'temperate'),
        inCave: false,
        surfaceY: state.surfaceAt[safeTx] || 0,
      };
    }
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
    if (state.activeDimension === 'water') {
      const waterMeta = state.waterWorldMeta || {};
      const floorStart = Number.isFinite(waterMeta.floorStart) ? waterMeta.floorStart : WORLD_H - 18;
      const garden = waterMeta.goldenGarden || null;
      const inGarden = !!(garden && tx >= garden.x0 && tx <= garden.x1 && ty >= garden.y0 && ty <= garden.y1);
      return {
        biome: inGarden ? 'golden_garden' : ty >= floorStart ? 'water_floor' : (state.biomeAt[safeTx] || 'water_surface'),
        climate: 'any',
        inCave: false,
        surfaceY: state.surfaceAt[safeTx] || 0,
      };
    }
    if (state.activeDimension === 'air') {
      const airMeta = state.airWorldMeta || {};
      const voidStart = Number.isFinite(airMeta.voidStart) ? airMeta.voidStart : Math.floor(WORLD_H * 0.58);
      return {
        biome: ty >= voidStart ? 'air_void' : (state.biomeAt[safeTx] || 'air_isles'),
        climate: 'any',
        inCave: false,
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
    const waterRegion = state.waterCaves && state.waterCaves.region;
    const inWaterCaves = !!(waterRegion && tx >= waterRegion.x0 && tx <= waterRegion.x1 && ty >= waterRegion.y0 && ty <= waterRegion.y1);
    const airRegion = state.airCaves && state.airCaves.region;
    const inAirCaves = !!(airRegion && tx >= airRegion.x0 && tx <= airRegion.x1 && ty >= airRegion.y0 && ty <= airRegion.y1);
    const surfaceBiome = state.biomeAt[safeTx];
    const surfaceClimate = state.climateAt && state.climateAt[safeTx] ? state.climateAt[safeTx] : 'temperate';
    const biome = inAirCaves ? 'air_caves' : inWaterCaves ? 'water_caves' : inFireCaves ? 'fire_caves' : inCave ? caveBiome : surfaceBiome;
    const climate = inFireCaves ? 'warm' : inAirCaves || inWaterCaves || inCave || surfaceBiome === 'lake' ? 'any' : surfaceClimate;
    return {
      biome,
      climate,
      inCave: inCave || inWaterCaves || inAirCaves,
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

  Game.world = {
    BIOME_LABELS,
    biomeLabel,
    getSelectableSingleBiomes,
    createGrid,
    blockSolid,
    liquid,
    getBlock,
    setBlock,
    isSolidAtPixel,
    getLocationInfo,
    isLitAt,
    getStaticLightRadius,
    isOpenDoorAt,
  };
})();
