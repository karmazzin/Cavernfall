(() => {
  const Game = window.MC2D;
  const {
    TILE,
    WORLD_H,
    WORLD_W,
    SURFACE_BASE,
    UPPER_CAVE_START,
    UPPER_CAVE_END,
    DWARF_START,
    DWARF_END,
    DEEP_START,
  } = Game.constants;
  const { BLOCK } = Game.blocks;
  const { ITEM } = Game.items;
  const { rand, clamp } = Game.math;
  const { createGrid, getBlock, setBlock } = Game.world;
  const { chestKey, createChestState, fillChestLoot, ensureChestAt } = Game.chestSystem;
  const { createItemStack } = Game.inventory;
  const { placeDoor } = Game.doorSystem;
  const { createGameState, captureDimensionState } = Game.state;
  const { withSeed } = Game.random;
  const DWARF_COLORS = [
    { tunic: '#8a5c34', hood: '#6c727f' },
    { tunic: '#5a6f8f', hood: '#7e868f' },
    { tunic: '#6f5d8d', hood: '#88808f' },
    { tunic: '#4f7a64', hood: '#758174' },
    { tunic: '#8a4f4f', hood: '#7f6c6c' },
    { tunic: '#8b7442', hood: '#867b67' },
  ];
  const VILLAGER_PALETTES = [
    { body: '#5477a7', accent: '#d6c28a', hat: '#8f6a3f' },
    { body: '#7b8d4f', accent: '#d8b57f', hat: '#75522d' },
    { body: '#8a5c5c', accent: '#d7cab4', hat: '#6f4b2d' },
    { body: '#6f6294', accent: '#d5c69e', hat: '#725537' },
  ];
  const PLAINS_PROFESSIONS = ['farmer', 'farmer', 'shepherd', 'shepherd', 'lumber', 'lumber', 'merchant', 'mason'];
  const MOUNTAIN_PROFESSIONS = ['miner', 'miner', 'miner', 'mason', 'mason', 'merchant', 'lumber', 'farmer'];
  const DESERT_PROFESSIONS = ['merchant', 'merchant', 'mason', 'mason', 'miner', 'miner', 'farmer', 'shepherd'];
  const WINTER_PROFESSIONS = ['lumber', 'lumber', 'shepherd', 'shepherd', 'merchant', 'mason', 'miner', 'farmer'];

  const CLIMATE = {
    ANY: 'any',
    COLD: 'cold',
    TEMPERATE: 'temperate',
    WARM: 'warm',
  };
  const SINGLE_BIOME_CAVE_SET = new Set(['cave', 'dwarf_caves', 'deep', 'fire_caves', 'water_caves', 'air_caves']);
  const SINGLE_BIOME_FIRE_SET = new Set(['red_land', 'lava_lake']);
  const SINGLE_BIOME_WATER_SET = new Set(['water_surface', 'water_floor', 'golden_garden']);
  const SINGLE_BIOME_AIR_SET = new Set(['air_plains', 'air_isles', 'air_void']);

  function clearChestSlots(chest) {
    for (let i = 0; i < chest.slots.length; i += 1) chest.slots[i] = { id: null, count: 0, durability: null };
  }

  function chestHasItem(chest, itemId, count = 1) {
    let total = 0;
    for (const slot of chest.slots) {
      if (slot && slot.id === itemId) total += slot.count || 0;
      if (total >= count) return true;
    }
    return false;
  }

  function removeItemFromChest(chest, itemId, count = 1) {
    let left = count;
    for (const slot of chest.slots) {
      if (!slot || slot.id !== itemId || !slot.count) continue;
      const take = Math.min(left, slot.count);
      slot.count -= take;
      left -= take;
      if (slot.count <= 0) {
        slot.id = null;
        slot.count = 0;
        slot.durability = null;
      }
      if (left <= 0) return true;
    }
    return false;
  }

  function isUpperBand(y) {
    return y >= UPPER_CAVE_START && y <= UPPER_CAVE_END;
  }

  function isDwarfBand(y) {
    return y >= DWARF_START && y <= DWARF_END;
  }

  function isDeepBand(y) {
    return y >= DEEP_START;
  }

  function layerOffset(tx) {
    return Math.round(Math.sin(tx / 37) * 2 + Math.sin(tx / 13) * 1.2);
  }

  function upperStartAt(tx) {
    return UPPER_CAVE_START + layerOffset(tx);
  }

  function upperEndAt(tx) {
    return UPPER_CAVE_END + layerOffset(tx);
  }

  function dwarfStartAt(tx) {
    return DWARF_START + layerOffset(tx);
  }

  function dwarfEndAt(tx) {
    return DWARF_END + layerOffset(tx);
  }

  function deepStartAt(tx) {
    return DEEP_START + layerOffset(tx);
  }

  function isRockLike(blockId) {
    return blockId === BLOCK.STONE || blockId === BLOCK.BLACKSTONE || blockId === BLOCK.DEEPSTONE || blockId === BLOCK.SANDSTONE || blockId === BLOCK.DIRT || blockId === BLOCK.GRASS || blockId === BLOCK.SAND || blockId === BLOCK.COAL_ORE || blockId === BLOCK.GOLD_ORE;
  }

  function isDesertBiome(biome) {
    return biome === 'desert';
  }

  function climateForBiome(biome) {
    if (biome === 'mountains' || biome === 'snow_plains') return CLIMATE.COLD;
    if (biome === 'desert' || biome === 'volcano') return CLIMATE.WARM;
    if (biome === 'plains' || biome === 'forest') return CLIMATE.TEMPERATE;
    return CLIMATE.ANY;
  }

  function chooseBiomeForClimate(climate, lastBiome) {
    if (climate === CLIMATE.COLD) {
      if (lastBiome === 'mountains') return Math.random() < 0.42 ? 'snow_plains' : 'mountains';
      if (lastBiome === 'snow_plains') return Math.random() < 0.34 ? 'mountains' : 'snow_plains';
      return Math.random() < 0.58 ? 'snow_plains' : 'mountains';
    }
    if (climate === CLIMATE.WARM) return 'desert';
    if (lastBiome === 'forest') return Math.random() < 0.62 ? 'plains' : 'forest';
    if (lastBiome === 'plains') return Math.random() < 0.38 ? 'forest' : 'plains';
    return Math.random() < 0.34 ? 'forest' : 'plains';
  }

  function chooseClimate(lastClimate) {
    const roll = Math.random();
    if (lastClimate === CLIMATE.COLD) {
      if (roll < 0.58) return CLIMATE.COLD;
      if (roll < 0.88) return CLIMATE.TEMPERATE;
      return CLIMATE.WARM;
    }
    if (lastClimate === CLIMATE.WARM) {
      if (roll < 0.54) return CLIMATE.WARM;
      if (roll < 0.86) return CLIMATE.TEMPERATE;
      return CLIMATE.COLD;
    }
    if (roll < 0.62) return CLIMATE.TEMPERATE;
    if (roll < 0.81) return CLIMATE.WARM;
    return CLIMATE.COLD;
  }

  function getVillageStyle(type) {
    if (type === 'mountain_village') {
      return { surface: BLOCK.STONE, subsoil: BLOCK.STONE, deepSubsoil: BLOCK.STONE, wall: BLOCK.STONE, support: BLOCK.STONE, roof: BLOCK.DEEPSTONE, tower: BLOCK.STONE };
    }
    if (type === 'desert_village') {
      return { surface: BLOCK.SAND, subsoil: BLOCK.SANDSTONE, deepSubsoil: BLOCK.SANDSTONE, wall: BLOCK.SANDSTONE, support: BLOCK.SANDSTONE, roof: BLOCK.SANDSTONE, tower: BLOCK.SANDSTONE };
    }
    if (type === 'winter_village') {
      return { surface: BLOCK.SNOW, subsoil: BLOCK.DIRT, deepSubsoil: BLOCK.STONE, wall: BLOCK.PLANK, support: BLOCK.SPRUCE_WOOD, roof: BLOCK.STONE, tower: BLOCK.STONE };
    }
    return { surface: BLOCK.GRASS, subsoil: BLOCK.DIRT, deepSubsoil: BLOCK.STONE, wall: BLOCK.PLANK, support: BLOCK.WOOD, roof: BLOCK.STONE, tower: BLOCK.STONE };
  }

  function carveCircle(state, cx, cy, radius, blockId = BLOCK.AIR) {
    for (let yy = -radius; yy <= radius; yy += 1) {
      for (let xx = -radius; xx <= radius; xx += 1) {
        if (xx * xx + yy * yy > radius * radius + 1) continue;
        const tx = Math.round(cx + xx);
        const ty = Math.round(cy + yy);
        if (tx < 1 || tx >= WORLD_W - 1 || ty < 1 || ty >= WORLD_H - 1) continue;
        if (getBlock(state, tx, ty) !== BLOCK.BEDROCK) setBlock(state, tx, ty, blockId);
      }
    }
  }

  function carveRect(state, x0, y0, x1, y1, blockId = BLOCK.AIR) {
    for (let ty = y0; ty <= y1; ty += 1) {
      for (let tx = x0; tx <= x1; tx += 1) {
        if (tx < 1 || tx >= WORLD_W - 1 || ty < 1 || ty >= WORLD_H - 1) continue;
        if (getBlock(state, tx, ty) !== BLOCK.BEDROCK) setBlock(state, tx, ty, blockId);
      }
    }
  }

  function carveTunnel(state, startX, startY, length, radius, minY, maxY, depth = 0) {
    let x = startX;
    let y = startY;
    let angle = rand(-0.38, 0.38);
    let verticalDrift = rand(-0.06, 0.06);

    for (let step = 0; step < length; step += 1) {
      carveCircle(state, x, y, Math.max(2, Math.round(radius + rand(-0.4, 0.6))));
      if (Math.random() < 0.08) carveCircle(state, x + rand(-1, 1), y + rand(-1, 1), radius + 1);

      x += Math.cos(angle) * rand(1.4, 2.2);
      y += Math.sin(angle) * 1 + verticalDrift;
      angle += rand(-0.2, 0.2);
      verticalDrift = clamp(verticalDrift + rand(-0.03, 0.03), -0.12, 0.12);
      x = clamp(x, 4, WORLD_W - 5);
      y = clamp(y, minY, maxY);

      if (depth < 1 && step > 10 && Math.random() < 0.04) {
        carveTunnel(state, x, y + rand(-2, 2), Math.floor(length * rand(0.35, 0.55)), Math.max(2, radius - 1), minY, maxY, depth + 1);
      }
    }
  }

  function smoothSurface(state, passes = 1) {
    for (let pass = 0; pass < passes; pass += 1) {
      const next = state.surfaceAt.slice();
      for (let tx = 2; tx < WORLD_W - 2; tx += 1) {
        const biome = state.biomeAt[tx];
        if (biome === 'volcano') continue;
        const left = state.surfaceAt[tx - 1];
        const mid = state.surfaceAt[tx];
        const right = state.surfaceAt[tx + 1];
        const avg = Math.round((left + mid * 2 + right) / 4);
        const blend = biome === 'mountains' ? 3 : biome === 'forest' ? 4 : biome === 'desert' ? 5 : 5;
        next[tx] = clamp(Math.round((mid * blend + avg) / (blend + 1)), 8, 38);
      }
      state.surfaceAt = next;
    }
  }

  function flattenPlains(state) {
    let tx = 0;
    while (tx < WORLD_W) {
      if (state.biomeAt[tx] !== 'plains' && state.biomeAt[tx] !== 'desert' && state.biomeAt[tx] !== 'snow_plains') {
        tx += 1;
        continue;
      }

      const start = tx;
      while (tx < WORLD_W && (state.biomeAt[tx] === 'plains' || state.biomeAt[tx] === 'desert' || state.biomeAt[tx] === 'snow_plains')) tx += 1;
      const end = tx - 1;
      if (end - start + 1 < 18) continue;

      let cursor = start;
      while (cursor <= end) {
        const plateauLen = Math.min(end - cursor + 1, Math.floor(rand(9, 18)));
        const base = state.surfaceAt[Math.min(end, cursor + Math.floor(plateauLen / 2))];
        for (let px = cursor; px < cursor + plateauLen; px += 1) {
          const edge = px === cursor || px === cursor + plateauLen - 1 ? Math.round(rand(0, 1)) : 0;
          const micro = px > cursor && px < cursor + plateauLen - 1 && Math.random() < 0.12 ? (Math.random() < 0.5 ? -1 : 1) : 0;
          state.surfaceAt[px] = clamp(base + edge + micro, 20, 36);
        }
        cursor += plateauLen;
      }
    }
  }

  function addPlainMicroRelief(state) {
    for (let tx = 3; tx < WORLD_W - 3; tx += 1) {
      if (state.biomeAt[tx] !== 'plains' && state.biomeAt[tx] !== 'desert' && state.biomeAt[tx] !== 'snow_plains') continue;
      if (Math.random() < 0.7) continue;
      const prev = state.surfaceAt[tx - 1];
      const next = state.surfaceAt[tx + 1];
      state.surfaceAt[tx] = clamp(state.surfaceAt[tx] + (Math.random() < 0.5 ? -1 : 1), Math.min(prev, next) - 1, Math.max(prev, next) + 1);
    }
  }

  function applyVolcanoSegment(state, start, end) {
    const center = (start + end) / 2;
    const half = Math.max(1, (end - start) / 2);
    const lift = rand(14, 20);
    for (let x = start; x <= end; x += 1) {
      const t = Math.abs((x - center) / half);
      const ridge = Math.pow(Math.max(0, 1 - t), 0.42);
      const target = SURFACE_BASE - lift * ridge + rand(-0.5, 0.5);
      const prev = x > 0 ? state.surfaceAt[x - 1] : SURFACE_BASE;
      state.surfaceAt[x] = Math.round(clamp(prev + clamp(target - prev, -2, 2), 6, 22));
      state.biomeAt[x] = 'volcano';
      state.climateAt[x] = CLIMATE.WARM;
    }
  }

  function applyDesertSegment(state, start, end) {
    const center = (start + end) / 2;
    const half = Math.max(1, (end - start) / 2);
    for (let x = start; x <= end; x += 1) {
      const t = Math.abs((x - center) / half);
      const dune = Math.sin((1 - t) * Math.PI) * 1.2;
      const prev = x > 0 ? state.surfaceAt[x - 1] : SURFACE_BASE;
      const target = SURFACE_BASE + dune + rand(-0.3, 0.3);
      state.surfaceAt[x] = Math.round(clamp(prev + clamp(target - prev, -0.7, 0.7), 20, 36));
      state.biomeAt[x] = 'desert';
      state.climateAt[x] = CLIMATE.WARM;
    }
  }

  function generateBiomeBands(state) {
    let x = 0;
    let lastBiome = 'plains';
    let lastClimate = CLIMATE.TEMPERATE;
    while (x < WORLD_W) {
      const climate = chooseClimate(lastClimate);
      const biome = chooseBiomeForClimate(climate, lastBiome);

      let segLen = Math.floor(rand(90, 170));
      if (biome === 'mountains') segLen = Math.floor(rand(104, 164));
      if (biome === 'snow_plains') segLen = Math.floor(rand(96, 156));
      if (biome === 'forest') segLen = Math.floor(rand(72, 136));
      if (biome === 'desert') segLen = Math.floor(rand(112, 176));

      const segmentStart = x;
      const segmentEnd = Math.min(WORLD_W - 1, x + segLen - 1);
      const center = (segmentStart + segmentEnd) / 2;
      const half = Math.max(1, (segmentEnd - segmentStart) / 2);
      const peakLift = biome === 'mountains' ? rand(10, 18) : biome === 'forest' ? rand(1, 3) : biome === 'desert' ? rand(0, 1.4) : biome === 'snow_plains' ? rand(0.4, 1.8) : rand(0, 1.2);
      const segmentBase = biome === 'plains' || biome === 'desert' || biome === 'snow_plains' ? SURFACE_BASE + rand(-0.6, 0.6) : SURFACE_BASE + rand(-1.2, 1.2);

      for (; x <= segmentEnd; x += 1) {
        const prev = x > 0 ? state.surfaceAt[x - 1] : SURFACE_BASE;
        let target = segmentBase;
        if (biome === 'mountains') {
          const t = Math.abs((x - center) / half);
          const ridge = Math.pow(Math.max(0, 1 - t), 0.55);
          target = SURFACE_BASE - peakLift * ridge + rand(-0.6, 0.6);
        } else if (biome === 'snow_plains') {
          target += Math.sin((x - segmentStart) / 12) * 0.7 + rand(-0.2, 0.2);
        } else if (biome === 'forest') {
          target += Math.sin((x - segmentStart) / 9) * 1.2 + rand(-0.4, 0.4);
        } else if (biome === 'desert') {
          target += Math.sin((x - segmentStart) / 14) * 0.9 + rand(-0.25, 0.25);
        } else if ((x - segmentStart) % Math.floor(rand(12, 22)) === 0) {
          target += rand(-0.4, 0.4);
        }

        const maxStep = biome === 'mountains' ? 2 : biome === 'forest' ? 1.1 : biome === 'desert' ? 0.6 : biome === 'snow_plains' ? 0.55 : 0.4;
        state.surfaceAt[x] = Math.round(clamp(prev + clamp(target - prev, -maxStep, maxStep), biome === 'mountains' ? 8 : 20, biome === 'mountains' ? 28 : 36));
        state.biomeAt[x] = biome;
        state.climateAt[x] = climate;
      }

      if (biome === 'mountains' && Math.random() < 0.24) {
        const width = Math.floor(rand(26, 46));
        const volcanoStart = clamp(segmentStart + Math.floor(rand(8, Math.max(9, segLen - width - 8))), segmentStart, segmentEnd - width + 1);
        const volcanoEnd = Math.min(segmentEnd, volcanoStart + width - 1);
        applyVolcanoSegment(state, volcanoStart, volcanoEnd);
      }

      lastBiome = biome;
      lastClimate = climate;
    }
  }

  function ensureVolcanoSegment(state) {
    for (let tx = 0; tx < WORLD_W; tx += 1) {
      if (state.biomeAt[tx] === 'volcano') return;
    }

    const mountainSegments = [];
    let x = 0;
    while (x < WORLD_W) {
      if (state.biomeAt[x] !== 'mountains') {
        x += 1;
        continue;
      }
      const start = x;
      while (x < WORLD_W && state.biomeAt[x] === 'mountains') x += 1;
      const end = x - 1;
      if (end - start + 1 >= 32) mountainSegments.push({ start, end });
    }

    if (mountainSegments.length > 0) {
      const host = mountainSegments[Math.floor(rand(0, mountainSegments.length))];
      const width = Math.floor(rand(28, Math.min(44, host.end - host.start + 1) + 1));
      const center = Math.floor((host.start + host.end) / 2);
      const start = clamp(center - Math.floor(width / 2), host.start, host.end - width + 1);
      applyVolcanoSegment(state, start, start + width - 1);
      return;
    }

    const width = Math.floor(rand(28, 42));
    const start = clamp(Math.floor(rand(40, WORLD_W - 41)) - Math.floor(width / 2), 20, WORLD_W - width - 20);
    applyVolcanoSegment(state, start, start + width - 1);
  }

  function ensureDesertSegment(state) {
    for (let tx = 0; tx < WORLD_W; tx += 1) {
      if (state.biomeAt[tx] === 'desert') return;
    }

    const hostStart = Math.floor(rand(80, WORLD_W - 160));
    const width = Math.floor(rand(120, 182));
    applyDesertSegment(state, hostStart, Math.min(WORLD_W - 40, hostStart + width));
  }

  function ensureClimateAt(state) {
    if (!Array.isArray(state.climateAt) || state.climateAt.length !== WORLD_W) {
      state.climateAt = Array(WORLD_W).fill(CLIMATE.TEMPERATE);
    }
  }

  function shapeVolcanoes(state, volcanoSegments) {
    for (const segment of volcanoSegments) {
      const radius = Math.max(10, Math.floor((segment.end - segment.start) / 2));
      for (let tx = segment.start; tx <= segment.end; tx += 1) {
        const edge = Math.abs(tx - segment.center) / radius;
        const cone = Math.max(0, 1 - edge * edge);
        const lift = Math.round(5 * cone + 3 * Math.sqrt(cone));
        state.surfaceAt[tx] = Math.max(5, state.surfaceAt[tx] - lift);
      }
      const craterHalf = Math.max(4, Math.floor(radius * 0.24));
      for (let tx = segment.center - craterHalf; tx <= segment.center + craterHalf; tx += 1) {
        if (tx < segment.start || tx > segment.end) continue;
        const depth = craterHalf - Math.abs(tx - segment.center) + 3;
        state.surfaceAt[tx] = clamp(state.surfaceAt[tx] + depth, 6, 24);
      }
    }
  }

  function fillTerrain(state) {
    for (let tx = 0; tx < WORLD_W; tx += 1) {
      const s = state.surfaceAt[tx];
      const biome = state.biomeAt[tx];
      const deepStart = deepStartAt(tx);
      const upperStart = upperStartAt(tx);
      for (let ty = s; ty < WORLD_H; ty += 1) {
        if (ty === WORLD_H - 1) {
          state.world[ty][tx] = BLOCK.BEDROCK;
        } else if (biome === 'volcano') {
          state.world[ty][tx] = ty >= deepStart - 4 ? BLOCK.BLACKSTONE : BLOCK.BLACKSTONE;
        } else if (ty >= deepStart) {
          state.world[ty][tx] = BLOCK.DEEPSTONE;
        } else if (biome === 'desert') {
          if (ty === s) state.world[ty][tx] = BLOCK.SAND;
          else if (ty < s + 3) state.world[ty][tx] = BLOCK.SAND;
          else if (ty < upperStart - 1) state.world[ty][tx] = BLOCK.SANDSTONE;
          else state.world[ty][tx] = BLOCK.STONE;
        } else if (biome === 'mountains') {
          state.world[ty][tx] = BLOCK.STONE;
        } else if (ty === s) {
          state.world[ty][tx] = BLOCK.GRASS;
        } else if (ty < s + 4) {
          state.world[ty][tx] = BLOCK.DIRT;
        } else {
          state.world[ty][tx] = BLOCK.STONE;
        }
      }
    }
  }

  function countSolidNeighbors(state, tx, ty, radiusX, radiusY) {
    let solid = 0;
    let total = 0;
    for (let yy = ty - radiusY; yy <= ty + radiusY; yy += 1) {
      for (let xx = tx - radiusX; xx <= tx + radiusX; xx += 1) {
        total += 1;
        if (isRockLike(getBlock(state, xx, yy))) solid += 1;
      }
    }
    return { solid, total };
  }

  function canHostMineRoom(state, tx, topY) {
    if (!isUpperBand(topY + 2)) return false;
    const around = countSolidNeighbors(state, tx, topY + 2, 4, 3);
    return around.solid / around.total >= 0.7;
  }

  function carveMineCell(state, tx, topY, withSupport = false) {
    const ceilingY = topY;
    const floorY = topY + 5;
    for (let ty = ceilingY + 1; ty <= floorY - 1; ty += 1) setBlock(state, tx, ty, BLOCK.AIR);
    setBlock(state, tx, ceilingY, BLOCK.PLANK);
    setBlock(state, tx, floorY, BLOCK.PLANK);

    if (withSupport) {
      for (let ty = ceilingY + 1; ty <= floorY - 1; ty += 1) {
        setBlock(state, tx - 1, ty, BLOCK.PILLAR);
        setBlock(state, tx + 1, ty, BLOCK.PILLAR);
      }
    }

    if (Math.random() < 0.12) setBlock(state, tx, ceilingY + 1 + Math.floor(rand(0, 3)), BLOCK.COBWEB);
  }

  function carveVerticalMineEntrance(state, centerX, surfaceY, topY) {
    for (let ty = surfaceY - 1; ty <= topY + 4; ty += 1) {
      for (let tx = centerX - 1; tx <= centerX + 1; tx += 1) setBlock(state, tx, ty, BLOCK.AIR);
      setBlock(state, centerX, ty, BLOCK.LADDER);
      if ((ty - surfaceY) % 5 === 0) {
        setBlock(state, centerX - 2, ty, BLOCK.PILLAR);
        setBlock(state, centerX + 2, ty, BLOCK.PILLAR);
      }
    }
    for (let tx = centerX - 2; tx <= centerX + 2; tx += 1) carveMineCell(state, tx, topY, false);
  }

  function carveLadderShaft(state, centerX, minY, maxY) {
    for (let ty = minY; ty <= maxY; ty += 1) {
      for (let tx = centerX - 1; tx <= centerX + 1; tx += 1) setBlock(state, tx, ty, BLOCK.AIR);
      setBlock(state, centerX, ty, BLOCK.LADDER);
      setBlock(state, centerX - 1, ty, BLOCK.PLANK);
      setBlock(state, centerX + 1, ty, BLOCK.PLANK);
      if ((ty - minY) % 6 === 0) {
        setBlock(state, centerX - 2, ty, BLOCK.PILLAR);
        setBlock(state, centerX + 2, ty, BLOCK.PILLAR);
      }
    }
  }

  function decorateSealedMineHint(state, roomX, topY, dir, isReal) {
    setBlock(state, roomX - 2, topY, BLOCK.PLANK);
    setBlock(state, roomX + 2, topY, BLOCK.PLANK);
    setBlock(state, roomX - 3, topY + 2, BLOCK.PILLAR);
    setBlock(state, roomX + 3, topY + 2, BLOCK.PILLAR);
    placeTorchPair(state, roomX - 2, topY + 1);
    placeTorchPair(state, roomX + 2, topY + 1);
    if (isReal) {
      setBlock(state, roomX + dir, topY + 4, BLOCK.PLANK);
      setBlock(state, roomX + dir * 2, topY + 4, BLOCK.PLANK);
      if (Math.random() < 0.6) setBlock(state, roomX - dir, topY + 3, BLOCK.COBWEB);
    } else {
      if (Math.random() < 0.65) setBlock(state, roomX + dir, topY + 3, BLOCK.COBWEB);
      setBlock(state, roomX - dir, topY + 4, BLOCK.PLANK);
    }
  }

  function buildDeepShield(state, faceX, topY, dir) {
    for (let ty = topY; ty <= topY + 5; ty += 1) {
      for (let depth = 0; depth < 3; depth += 1) {
        setBlock(state, faceX + dir * depth, ty, BLOCK.DEEPSTONE);
      }
    }
    setBlock(state, faceX - 1, topY + 1, BLOCK.PILLAR);
    setBlock(state, faceX - 1, topY + 4, BLOCK.PILLAR);
    setBlock(state, faceX + 1, topY + 1, BLOCK.PILLAR);
    setBlock(state, faceX + 1, topY + 4, BLOCK.PILLAR);
  }

  function carveMineConnector(state, tx, fromTopY, toTopY) {
    carveLadderShaft(state, tx, Math.min(fromTopY, toTopY) - 1, Math.max(fromTopY, toTopY) + 6);
  }

  function buildCurvedMineshaft(state, startX, topY, length, direction, depth = 0) {
    let x = startX;
    let y = topY;
    let carved = 0;
    let supportGap = 0;
    const maxLength = Math.min(length, 108);

    while (carved < maxLength) {
      if (x < 5 || x >= WORLD_W - 5 || y < upperStartAt(x) - 8 || y >= upperEndAt(x) - 8) break;
      const density = countSolidNeighbors(state, x, y + 2, 3, 2);
      if (density.solid / density.total < 0.62 && carved > 14) break;

      const support = supportGap >= 6;
      carveMineCell(state, x, y, support);
      supportGap = support ? 0 : supportGap + 1;

      if (carved > 6 && carved % 10 === 0 && Math.random() < 0.28) addSpider(state, x, y + 3);

      x += direction;
      if (Math.random() < 0.14) y += Math.random() < 0.5 ? -1 : 1;
      y = clamp(y, upperStartAt(x) - 6, upperEndAt(x) - 10);

      if (depth < 1 && carved > 16 && carved % 14 === 0 && Math.random() < 0.28) {
        const branchTopY = clamp(y + (Math.random() < 0.5 ? -5 : 5), upperStartAt(x) - 6, upperEndAt(x) - 12);
        const branchDensity = countSolidNeighbors(state, x, branchTopY + 2, 3, 2);
        if (branchDensity.solid / branchDensity.total >= 0.6) {
          carveMineConnector(state, x, y, branchTopY);
          buildCurvedMineshaft(state, x + direction, branchTopY, Math.floor(length * rand(0.45, 0.7)), Math.random() < 0.8 ? direction : -direction, depth + 1);
        }
      }

      carved += 1;
    }

    return carved;
  }

  function addSpider(state, tx, ty) {
    state.spiders.push({
      x: tx * TILE + 1,
      y: ty * TILE + 4,
      w: 14,
      h: 10,
      vx: 0,
      vy: 0,
      onGround: false,
      hp: 2,
      attackCd: 0,
      clickCd: 0,
      moveTimer: rand(0.4, 1.5),
      dir: Math.random() < 0.5 ? -1 : 1,
    });
  }

  function generateMineshafts(state) {
    const shaftCount = Math.floor(rand(3, 5));
    let built = 0;
    let attempts = 0;
    while (built < shaftCount && attempts < 220) {
      attempts += 1;
      const tx = Math.floor(rand(16, WORLD_W - 17));
      const biome = state.biomeAt[tx];
      if (biome === 'volcano') continue;
      const topY = clamp(Math.max(state.surfaceAt[tx] + 11, Math.floor(rand(upperStartAt(tx) - 2, upperEndAt(tx) - 12))), upperStartAt(tx) - 4, upperEndAt(tx) - 12);
      if (!canHostMineRoom(state, tx, topY)) continue;
      const carved = buildCurvedMineshaft(state, tx, topY, Math.floor(rand(64, 106)), Math.random() < 0.5 ? -1 : 1);
      if (carved < 18) continue;
      built += 1;
    }
  }

  function generateMineEntranceShafts(state, blockedColumns) {
    const target = Math.floor(rand(1, 3));
    let built = 0;
    let attempts = 0;
    while (built < target && attempts < 180) {
      attempts += 1;
      const tx = Math.floor(rand(18, WORLD_W - 19));
      const biome = state.biomeAt[tx];
      if (biome === 'volcano') continue;
      if (blockedColumns.has(tx) || blockedColumns.has(tx - 1) || blockedColumns.has(tx + 1)) continue;
      const surfaceY = state.surfaceAt[tx];
      const topY = clamp(surfaceY + Math.floor(rand(10, 18)), upperStartAt(tx) - 4, upperEndAt(tx) - 12);
      if (!canHostMineRoom(state, tx, topY)) continue;
      carveVerticalMineEntrance(state, tx, surfaceY, topY);
      buildCurvedMineshaft(state, tx + 2, topY, Math.floor(rand(54, 96)), 1);
      built += 1;
    }
  }

  function carveUpperCaves(state) {
    const networkCount = Math.floor(rand(18, 28));
    for (let i = 0; i < networkCount; i += 1) {
      const tx = Math.floor(rand(8, WORLD_W - 9));
      const startY = clamp(Math.max(state.surfaceAt[tx] + Math.floor(rand(8, 16)), upperStartAt(tx)), upperStartAt(tx), upperEndAt(tx) - 8);
      carveTunnel(state, tx, startY, Math.floor(rand(16, 36)), Math.floor(rand(2, 4)), upperStartAt(tx), upperEndAt(tx));
    }

    for (let i = 0; i < 12; i += 1) {
      const tx = Math.floor(rand(10, WORLD_W - 11));
      const ty = Math.floor(rand(upperStartAt(tx) + 4, upperEndAt(tx) - 2));
      carveCircle(state, tx, ty, Math.floor(rand(2, 5)));
    }
  }

  function carveDwarfHall(state, cx, cy, halfW, halfH) {
    carveRect(state, cx - halfW, cy - halfH, cx + halfW, cy + halfH, BLOCK.AIR);
    for (let tx = cx - halfW; tx <= cx + halfW; tx += 1) {
      setBlock(state, tx, cy + halfH + 1, BLOCK.DEEPSTONE);
      setBlock(state, tx, cy - halfH - 1, BLOCK.DEEPSTONE);
    }
  }

  function placeTorchPair(state, tx, ty, chance = 1) {
    if (Math.random() > chance) return;
    if (getBlock(state, tx, ty) === BLOCK.AIR) setBlock(state, tx, ty, BLOCK.TORCH);
  }

  function addDwarfNode(state, settlementId, kind, x, y, meta = {}) {
    const node = {
      id: `dnode-${state.dwarfColony.nodes.length}`,
      settlementId,
      kind,
      x,
      y,
      ...meta,
    };
    state.dwarfColony.nodes.push(node);
    return node;
  }

  function addDwarfEdge(state, a, b, type = 'walk') {
    if (!a || !b || a.id === b.id) return;
    state.dwarfColony.edges.push({ from: a.id, to: b.id, type });
    state.dwarfColony.edges.push({ from: b.id, to: a.id, type });
  }

  function addHumanNode(state, settlementId, kind, x, y, meta = {}) {
    const node = {
      id: `hnode-${state.humanSettlements.nodes.length}`,
      settlementId,
      kind,
      x,
      y,
      ...meta,
    };
    state.humanSettlements.nodes.push(node);
    return node;
  }

  function addHumanEdge(state, a, b, type = 'walk') {
    if (!a || !b || a.id === b.id) return;
    state.humanSettlements.edges.push({ from: a.id, to: b.id, type });
    state.humanSettlements.edges.push({ from: b.id, to: a.id, type });
  }

  function getSettlementNodes(state, settlementId, kind = null) {
    return state.dwarfColony.nodes.filter((node) => node.settlementId === settlementId && (kind == null || node.kind === kind));
  }

  function findNearestSettlementNode(state, settlementId, x, y, kind = null) {
    const nodes = getSettlementNodes(state, settlementId, kind);
    let best = null;
    let bestDist = Infinity;
    for (const node of nodes) {
      const dist = Math.abs(node.x - x) + Math.abs(node.y - y);
      if (dist < bestDist) {
        best = node;
        bestDist = dist;
      }
    }
    return best;
  }

  function decorateDwarfHall(state, hall) {
    const floorY = hall.y + hall.halfH;
    for (let tx = hall.x - hall.halfW + 1; tx <= hall.x + hall.halfW - 1; tx += 1) {
      if ((tx - hall.x) % 4 === 0) setBlock(state, tx, floorY, BLOCK.PLANK);
    }
    setBlock(state, hall.x - hall.halfW, hall.y - hall.halfH, BLOCK.PILLAR);
    setBlock(state, hall.x + hall.halfW, hall.y - hall.halfH, BLOCK.PILLAR);
    setBlock(state, hall.x - hall.halfW, floorY, BLOCK.PILLAR);
    setBlock(state, hall.x + hall.halfW, floorY, BLOCK.PILLAR);
  }

  function carveDwarfDwelling(state, hall) {
    const entranceX = clamp(hall.x + Math.floor(rand(-2, 3)), 6, WORLD_W - 7);
    const roomCenterY = clamp(hall.y + hall.halfH + Math.floor(rand(7, 11)), dwarfStartAt(entranceX) + 6, dwarfEndAt(entranceX) + 6);
    const roomHalfW = Math.floor(rand(2, 4));
    const roomHalfH = Math.floor(rand(2, 3));
    carveLadderShaft(state, entranceX, hall.y + hall.halfH, roomCenterY + roomHalfH);
    carveRect(state, entranceX - roomHalfW, roomCenterY - roomHalfH, entranceX + roomHalfW, roomCenterY + roomHalfH, BLOCK.AIR);
    for (let tx = entranceX - roomHalfW; tx <= entranceX + roomHalfW; tx += 1) setBlock(state, tx, roomCenterY + roomHalfH + 1, BLOCK.DEEPSTONE);
    placeTorchPair(state, entranceX - roomHalfW + 1, roomCenterY - roomHalfH + 1, 0.7);
    placeTorchPair(state, entranceX + roomHalfW - 1, roomCenterY - roomHalfH + 1, 0.7);
    setBlock(state, entranceX - roomHalfW + 1, roomCenterY + roomHalfH, BLOCK.PLANK);
    setBlock(state, entranceX + roomHalfW - 1, roomCenterY + roomHalfH, BLOCK.PLANK);
    if (roomHalfW >= 4) setBlock(state, entranceX, roomCenterY + roomHalfH, BLOCK.PLANK);
  }

  function carveDwarfBranchRoom(state, anchorX, anchorY, side, type, settlement) {
    const roomHalfW = type === 'storage' ? Math.floor(rand(4, 6)) : Math.floor(rand(3, 5));
    const roomHalfH = Math.floor(rand(2, 3));
    let centerX = anchorX;
    let centerY = anchorY;
    let connectorY = anchorY;

    if (side === 'below') {
      centerY = clamp(anchorY + Math.floor(rand(7, 11)), dwarfStartAt(anchorX) + 5, dwarfEndAt(anchorX) + 6);
      carveLadderShaft(state, anchorX, anchorY, centerY + roomHalfH);
    } else if (side === 'above') {
      centerY = clamp(anchorY - Math.floor(rand(7, 10)), dwarfStartAt(anchorX) + 4, dwarfEndAt(anchorX) - 6);
      carveLadderShaft(state, anchorX, centerY - roomHalfH, anchorY);
    } else {
      centerX = clamp(anchorX + (side === 'left' ? -Math.floor(rand(8, 13)) : Math.floor(rand(8, 13))), 10, WORLD_W - 11);
      centerY = clamp(anchorY + Math.floor(rand(-2, 3)), dwarfStartAt(centerX) + 4, dwarfEndAt(centerX) - 4);
      connectorY = clamp(anchorY + Math.floor(rand(-3, 4)), dwarfStartAt(anchorX) + 4, dwarfEndAt(anchorX) - 4);
      carveLadderShaft(state, anchorX, Math.min(anchorY, connectorY) - 1, Math.max(anchorY, connectorY) + 2);
      carveDwarfCorridor(state, anchorX, connectorY, centerX, centerY);
    }

    carveRect(state, centerX - roomHalfW, centerY - roomHalfH, centerX + roomHalfW, centerY + roomHalfH, BLOCK.AIR);
    for (let tx = centerX - roomHalfW; tx <= centerX + roomHalfW; tx += 1) {
      setBlock(state, tx, centerY + roomHalfH + 1, BLOCK.DEEPSTONE);
      setBlock(state, tx, centerY - roomHalfH - 1, BLOCK.DEEPSTONE);
    }

    placeTorchPair(state, centerX - roomHalfW + 1, centerY - roomHalfH + 1, 0.7);
    placeTorchPair(state, centerX + roomHalfW - 1, centerY - roomHalfH + 1, 0.7);
    setBlock(state, centerX - roomHalfW, centerY - roomHalfH, BLOCK.PILLAR);
    setBlock(state, centerX + roomHalfW, centerY - roomHalfH, BLOCK.PILLAR);
    const floorY = centerY + roomHalfH;
    const roomNode = addDwarfNode(state, settlement.id, type === 'storage' ? 'stock' : 'home', centerX, floorY - 1);
    const anchorNode = findNearestSettlementNode(state, settlement.id, anchorX, anchorY, 'shaft') || findNearestSettlementNode(state, settlement.id, anchorX, anchorY, 'hall');
    if (anchorNode) addDwarfEdge(state, anchorNode, roomNode, side === 'below' || side === 'above' ? 'ladder' : 'walk');

    if (type === 'storage') {
      setBlock(state, centerX - 1, floorY, BLOCK.PLANK);
      setBlock(state, centerX + 1, floorY, BLOCK.PLANK);
      setBlock(state, centerX - 2, floorY - 1, BLOCK.CHEST);
      setBlock(state, centerX, floorY - 1, BLOCK.CHEST);
      setBlock(state, centerX + 2, floorY - 1, BLOCK.CHEST);
      if (!state.chests) state.chests = {};
      for (const chestX of [centerX - 2, centerX, centerX + 2]) {
        const key = chestKey(chestX, floorY - 1);
        if (!state.chests[key]) {
          state.chests[key] = createChestState(settlement.id);
          fillChestLoot(state.chests[key]);
        }
      }
      state.dwarfColony.stockpiles.push({
        settlementId: settlement.id,
        x: centerX,
        y: centerY,
        halfW: roomHalfW,
        halfH: roomHalfH,
      });
    } else {
      setBlock(state, centerX - roomHalfW + 1, floorY, BLOCK.PLANK);
      setBlock(state, centerX + roomHalfW - 1, floorY, BLOCK.PLANK);
      if (roomHalfW >= 4) setBlock(state, centerX, floorY, BLOCK.PLANK);
      state.dwarfColony.homes.push({
        id: `${settlement.id}-home-${state.dwarfColony.homes.length}`,
        settlementId: settlement.id,
        x: centerX,
        y: centerY,
        halfW: roomHalfW,
        halfH: roomHalfH,
        spawnX: centerX,
        spawnY: floorY - 1,
        nodeId: roomNode.id,
        residentId: null,
        respawnTimer: 0,
      });
    }
  }

  function createDwarfWorksites(state, settlement, hall) {
    const leftTx = hall.x - hall.halfW - 3;
    const rightTx = hall.x + hall.halfW + 3;
    const workY = hall.y + hall.halfH - 1;
    const leftSite = {
      settlementId: settlement.id,
      x: hall.x - hall.halfW + 1,
      y: workY,
      targetTx: leftTx,
      targetTy: workY,
      originTx: leftTx,
      maxAdvance: 8,
      dir: -1,
    };
    const rightSite = {
      settlementId: settlement.id,
      x: hall.x + hall.halfW - 1,
      y: workY,
      targetTx: rightTx,
      targetTy: workY,
      originTx: rightTx,
      maxAdvance: 8,
      dir: 1,
    };
    state.dwarfColony.worksites.push(leftSite);
    state.dwarfColony.worksites.push(rightSite);
    const hallNode = findNearestSettlementNode(state, settlement.id, hall.x, hall.y, 'hall');
    const leftNode = addDwarfNode(state, settlement.id, 'worksite', leftSite.x, leftSite.y, { worksiteIndex: state.dwarfColony.worksites.length - 2 });
    const rightNode = addDwarfNode(state, settlement.id, 'worksite', rightSite.x, rightSite.y, { worksiteIndex: state.dwarfColony.worksites.length - 1 });
    if (hallNode) {
      addDwarfEdge(state, hallNode, leftNode, 'walk');
      addDwarfEdge(state, hallNode, rightNode, 'walk');
    }
  }

  function buildDwarfSettlement(state, hall, index, groupId) {
    const shaftX = clamp(hall.x + Math.floor(rand(-2, 3)), hall.x - hall.halfW + 2, hall.x + hall.halfW - 2);
    const shaftTop = clamp(hall.y - hall.halfH - Math.floor(rand(4, 7)), dwarfStartAt(shaftX) + 3, hall.y - 1);
    const shaftBottom = clamp(hall.y + hall.halfH + Math.floor(rand(6, 10)), hall.y + 4, dwarfEndAt(shaftX) + 8);
    carveLadderShaft(state, shaftX, shaftTop, shaftBottom);
    for (let ty = shaftTop; ty <= shaftBottom; ty += 1) {
      if ((ty - shaftTop) % 5 === 0) {
        setBlock(state, shaftX - 3, ty, BLOCK.PILLAR);
        setBlock(state, shaftX + 3, ty, BLOCK.PILLAR);
      }
    }
    placeTorchPair(state, shaftX - 3, hall.y - 1, 0.7);
    placeTorchPair(state, shaftX + 3, hall.y - 1, 0.7);

    const settlement = {
      id: `dwarf-settlement-${index}`,
      groupId,
      clothes: DWARF_COLORS[index % DWARF_COLORS.length],
      hallX: hall.x,
      hallY: hall.y,
      shaftX,
      shaftTop,
      shaftBottom,
      alertLevel: 0,
      alertTimer: 0,
      hostileToPlayer: false,
    };
    state.dwarfColony.settlements.push(settlement);
    state.dwarfColony.shafts.push({
      settlementId: settlement.id,
      x: shaftX,
      topY: shaftTop,
      bottomY: shaftBottom,
    });
    const hallMeta = {
      settlementId: settlement.id,
      x: hall.x,
      y: hall.y,
      halfW: hall.halfW,
      halfH: hall.halfH,
    };
    state.dwarfColony.halls.push(hallMeta);
    const hallNode = addDwarfNode(state, settlement.id, 'hall', hall.x, hall.y + hall.halfH - 1);
    let prevShaftNode = null;
    for (let ty = shaftTop; ty <= shaftBottom; ty += 4) {
      const shaftNode = addDwarfNode(state, settlement.id, 'shaft', shaftX, ty);
      if (prevShaftNode) addDwarfEdge(state, prevShaftNode, shaftNode, 'ladder');
      prevShaftNode = shaftNode;
      if (Math.abs(ty - hall.y) <= 3) addDwarfEdge(state, hallNode, shaftNode, 'walk');
    }

    const roomSides = ['below', 'above', 'left', 'right', 'below', 'above'];
    const homeCount = Math.floor(rand(4, 7));
    for (let i = 0; i < homeCount; i += 1) {
      const side = roomSides[i % roomSides.length];
      const anchorY = side === 'below' ? hall.y + hall.halfH : side === 'above' ? hall.y - hall.halfH : hall.y + Math.floor(rand(-2, 3));
      carveDwarfBranchRoom(state, shaftX, anchorY, side, 'home', settlement);
    }

    const storageSide = Math.random() < 0.5 ? 'left' : 'right';
    carveDwarfBranchRoom(state, shaftX, hall.y + Math.floor(rand(-2, 3)), storageSide, 'storage', settlement);
    if (Math.random() < 0.2) {
      const extraStorageSide = storageSide === 'left' ? 'right' : 'left';
      carveDwarfBranchRoom(state, shaftX, hall.y + Math.floor(rand(-3, 4)), extraStorageSide, 'storage', settlement);
    }
    createDwarfWorksites(state, settlement, hall);
    return settlement;
  }

  function carveDwarfCorridor(state, x0, y0, x1, y1) {
    let x = x0;
    let y = y0;
    let steps = 0;
    while (x !== x1) {
      carveRect(state, x - 2, y - 2, x + 2, y + 1, BLOCK.AIR);
      for (let fx = x - 2; fx <= x + 2; fx += 1) setBlock(state, fx, y + 2, BLOCK.DEEPSTONE);
      if (steps % 7 === 0) {
        placeTorchPair(state, x - 3, y - 1, 0.7);
        placeTorchPair(state, x + 3, y - 1, 0.7);
      }
      if (steps > 0 && steps % 11 === 0 && Math.random() < 0.28) {
        y = clamp(y + (Math.random() < 0.5 ? -1 : 1), dwarfStartAt(x) + 4, dwarfEndAt(x) - 4);
      }
      x += Math.sign(x1 - x);
      steps += 1;
    }
    if (y !== y1) {
      carveLadderShaft(state, x, Math.min(y, y1) - 2, Math.max(y, y1) + 1);
      setBlock(state, x - 2, y + 2, BLOCK.PLANK);
      setBlock(state, x + 2, y + 2, BLOCK.PLANK);
      setBlock(state, x - 2, y1 + 2, BLOCK.PLANK);
      setBlock(state, x + 2, y1 + 2, BLOCK.PLANK);
      placeTorchPair(state, x - 3, Math.min(y, y1), 0.7);
      placeTorchPair(state, x + 3, Math.min(y, y1), 0.7);
      y = y1;
    }
    while (x !== x1 || y !== y1) {
      carveRect(state, x - 2, y - 2, x + 2, y + 1, BLOCK.AIR);
      for (let fx = x - 2; fx <= x + 2; fx += 1) setBlock(state, fx, y + 2, BLOCK.DEEPSTONE);
      x += Math.sign(x1 - x);
      y += Math.sign(y1 - y);
    }
  }

  function generateDwarfCaverns(state) {
    const clusterCount = Math.random() < 0.32 ? 4 : 3;
    const settlements = [];
    let settlementIndex = 0;
    const clusterSpan = Math.floor((WORLD_W - 120) / clusterCount);

    for (let cluster = 0; cluster < clusterCount; cluster += 1) {
      const sectorStart = 60 + cluster * clusterSpan;
      const sectorEnd = Math.min(WORLD_W - 60, sectorStart + clusterSpan - 18);
      const hallCount = Math.floor(rand(2, 4));
      const halls = [];
      let cursorX = clamp(Math.floor(rand(sectorStart + 8, sectorStart + Math.max(16, clusterSpan * 0.25))), sectorStart, sectorEnd);
      let cursorY = clamp(
        Math.floor(rand(dwarfStartAt(cursorX) + 6, dwarfEndAt(cursorX) - 6)),
        dwarfStartAt(cursorX) + 4,
        dwarfEndAt(cursorX) - 4
      );

      for (let i = 0; i < hallCount; i += 1) {
        const x = clamp(cursorX + Math.floor(rand(-12, 13)), sectorStart, sectorEnd);
        const y = clamp(cursorY + Math.floor(rand(-3, 4)), dwarfStartAt(x) + 4, dwarfEndAt(x) - 4);
        const halfW = Math.floor(rand(5, 10));
        const halfH = Math.floor(rand(2, 3));
        carveDwarfHall(state, x, y, halfW, halfH);
        decorateDwarfHall(state, { x, y, halfW, halfH });
        placeTorchPair(state, x - halfW + 1, y - 1, 0.7);
        placeTorchPair(state, x + halfW - 1, y - 1, 0.7);
        halls.push({ x, y, halfW, halfH, cluster });
        cursorX = clamp(x + Math.floor(rand(20, 34)), sectorStart, sectorEnd);
        cursorY = clamp(y + Math.floor(rand(-2, 3)), dwarfStartAt(cursorX) + 4, dwarfEndAt(cursorX) - 4);
      }

      halls.sort((a, b) => a.x - b.x);
      for (let i = 1; i < halls.length; i += 1) {
        carveDwarfCorridor(state, halls[i - 1].x, halls[i - 1].y, halls[i].x, halls[i].y);
      }

      for (const hall of halls) {
        const sideRoomCount = Math.random() < 0.35 ? 1 : 0;
        for (let s = 0; s < sideRoomCount; s += 1) {
          if (Math.random() < 0.72) {
            const sideX = hall.x + (Math.random() < 0.5 ? -(hall.halfW + Math.floor(rand(5, 8))) : hall.halfW + Math.floor(rand(5, 8)));
            const sideY = clamp(hall.y + Math.floor(rand(-3, 4)), dwarfStartAt(sideX) + 4, dwarfEndAt(sideX) - 4);
            const sideHalfW = Math.floor(rand(4, 7));
            const sideHalfH = Math.floor(rand(2, 3));
            carveDwarfHall(state, sideX, sideY, sideHalfW, sideHalfH);
            decorateDwarfHall(state, { x: sideX, y: sideY, halfW: sideHalfW, halfH: sideHalfH });
            carveDwarfCorridor(state, hall.x, hall.y, sideX, sideY);
          }
        }
      }

      for (const hall of halls) {
        if (Math.random() < 0.22) carveDwarfDwelling(state, hall);
      }
      for (const hall of halls) settlements.push(buildDwarfSettlement(state, hall, settlementIndex++, cluster));
    }

    return settlements;
  }

  function generateDwarfEntrances(state, settlements) {
    const representatives = [];
    const seen = new Set();
    for (const settlement of settlements) {
      if (seen.has(settlement.groupId)) continue;
      seen.add(settlement.groupId);
      representatives.push(settlement);
    }
    for (const settlement of representatives) {
      const dir = Math.random() < 0.5 ? -1 : 1;
      const entryTx = clamp(settlement.shaftX + dir * Math.floor(rand(7, 13)), 10, WORLD_W - 11);
      const entryTopY = clamp(Math.floor(rand(upperStartAt(entryTx) + 2, upperEndAt(entryTx) - 10)), upperStartAt(entryTx) + 2, upperEndAt(entryTx) - 10);

      for (let tx = entryTx - 2; tx <= entryTx + 2; tx += 1) carveMineCell(state, tx, entryTopY, tx === entryTx - 2 || tx === entryTx + 2);

      const plugFaceX = entryTx + dir * 2;
      const shaftTx = entryTx + dir * 7;
      carveLadderShaft(state, shaftTx, entryTopY, settlement.hallY + 3);
      buildDeepShield(state, plugFaceX, entryTopY, dir);
      for (let ty = entryTopY + 1; ty <= entryTopY + 4; ty += 1) {
        for (let tx = plugFaceX + dir * 3; tx !== shaftTx; tx += dir) {
          setBlock(state, tx, ty, BLOCK.AIR);
        }
      }
      setBlock(state, shaftTx, entryTopY, BLOCK.PLANK);
      setBlock(state, shaftTx - 1, entryTopY, BLOCK.PLANK);
      setBlock(state, shaftTx + 1, entryTopY, BLOCK.PLANK);
      decorateSealedMineHint(state, entryTx, entryTopY, dir, true);
      placeTorchPair(state, settlement.shaftX - 3, settlement.hallY - 1, 0.7);
      placeTorchPair(state, settlement.shaftX + 3, settlement.hallY - 1, 0.7);
    }
  }

  function generateFalseDwarfSeals(state, count) {
    let built = 0;
    let attempts = 0;
    while (built < count && attempts < 220) {
      attempts += 1;
      const dir = Math.random() < 0.5 ? -1 : 1;
      const entryTx = Math.floor(rand(18, WORLD_W - 19));
      const entryTopY = clamp(
        Math.floor(rand(upperStartAt(entryTx) + 2, upperEndAt(entryTx) - 10)),
        upperStartAt(entryTx) + 2,
        upperEndAt(entryTx) - 10
      );
      if (!canHostMineRoom(state, entryTx, entryTopY)) continue;
      for (let tx = entryTx - 2; tx <= entryTx + 2; tx += 1) carveMineCell(state, tx, entryTopY, tx === entryTx - 2 || tx === entryTx + 2);
      const plugFaceX = entryTx + dir * 2;
      buildDeepShield(state, plugFaceX, entryTopY, dir);
      decorateSealedMineHint(state, entryTx, entryTopY, dir, false);
      built += 1;
    }
  }

  function carveVolcanoCore(state, segment) {
    const center = segment.center;
    const mouthWidth = Math.max(5, Math.floor((segment.end - segment.start) * 0.15));
    const topY = state.surfaceAt[center] + 1;
    const bottomY = clamp(topY + Math.floor(rand(26, 38)), topY + 20, WORLD_H - 12);
    for (let ty = topY; ty <= bottomY; ty += 1) {
      const progress = (ty - topY) / Math.max(1, bottomY - topY);
      const width = Math.round(mouthWidth + progress * 4 + Math.sin(progress * Math.PI) * 4);
      for (let tx = center - width; tx <= center + width; tx += 1) setBlock(state, tx, ty, BLOCK.AIR);
    }

    const lavaTop = Math.max(DEEP_START - 4, bottomY - Math.floor(rand(8, 14)));
    for (let ty = lavaTop; ty <= bottomY; ty += 1) {
      const progress = (ty - topY) / Math.max(1, bottomY - topY);
      const width = Math.round(mouthWidth + progress * 4 + Math.sin(progress * Math.PI) * 4) - 1;
      for (let tx = center - width; tx <= center + width; tx += 1) setBlock(state, tx, ty, BLOCK.LAVA);
    }
  }

  function generateDeepZones(state, volcanoSegments) {
    for (let ty = DEEP_START - 3; ty < WORLD_H - 1; ty += 1) {
      for (let tx = 1; tx < WORLD_W - 1; tx += 1) {
        const id = getBlock(state, tx, ty);
        const deepStart = deepStartAt(tx);
        if (ty < deepStart - 3) continue;
        if (id === BLOCK.STONE && Math.random() < (ty >= deepStart ? 0.75 : 0.28)) setBlock(state, tx, ty, BLOCK.DEEPSTONE);
        if (id === BLOCK.BLACKSTONE && Math.random() < 0.18) {
          setBlock(state, tx, ty, state.biomeAt[tx] === 'volcano' && Math.random() < (1 / 3) ? BLOCK.DIAMOND_ORE : BLOCK.DEEPSTONE);
        }
      }
    }

    const deepPocketCount = Math.floor(rand(4, 7));
    for (let i = 0; i < deepPocketCount; i += 1) {
      const cx = Math.floor(rand(12, WORLD_W - 13));
      const cy = Math.floor(rand(DEEP_START + 2, WORLD_H - 10));
      const radius = Math.floor(rand(4, 8));
      carveCircle(state, cx, cy, radius);
      carveCircle(state, cx, cy + Math.floor(radius * 0.6), Math.max(2, radius - 2), BLOCK.LAVA);
    }

    for (const segment of volcanoSegments) {
      const chamberY = clamp(Math.floor(rand(DEEP_START + 1, WORLD_H - 12)), DEEP_START + 1, WORLD_H - 12);
      const chamberRadius = Math.max(8, Math.floor((segment.end - segment.start) * 0.22));
      carveCircle(state, segment.center, chamberY, chamberRadius + 2);
      carveCircle(state, segment.center, chamberY + 2, chamberRadius, BLOCK.LAVA);
      for (let tx = segment.center - chamberRadius - 4; tx <= segment.center + chamberRadius + 4; tx += 1) {
        for (let ty = chamberY - chamberRadius - 2; ty <= chamberY + chamberRadius + 2; ty += 1) {
          if (getBlock(state, tx, ty) === BLOCK.STONE || getBlock(state, tx, ty) === BLOCK.DEEPSTONE) setBlock(state, tx, ty, BLOCK.BLACKSTONE);
        }
      }
    }
  }

  function generateFireCaves(state) {
    const centerX = Math.floor(rand(120, WORLD_W - 120));
    const centerY = Math.floor(rand(DEEP_START + 10, WORLD_H - 18));
    const radiusX = Math.floor(rand(34, 54));
    const radiusY = Math.floor(rand(10, 16));
    const region = {
      x0: centerX - radiusX - 2,
      x1: centerX + radiusX + 2,
      y0: centerY - radiusY - 4,
      y1: Math.min(WORLD_H - 6, centerY + radiusY + 6),
      centerX,
      centerY,
    };

    for (let ty = region.y0; ty <= region.y1; ty += 1) {
      for (let tx = region.x0; tx <= region.x1; tx += 1) {
        if (tx < 2 || tx >= WORLD_W - 2 || ty < DEEP_START - 2 || ty >= WORLD_H - 2) continue;
        const nx = (tx - centerX) / radiusX;
        const ny = (ty - centerY) / radiusY;
        const oval = nx * nx + ny * ny;
        if (oval <= 1.18) {
          const rim = oval > 0.84;
          setBlock(state, tx, ty, rim ? BLOCK.BASALT : BLOCK.AIR);
          if (!rim && ty > centerY + 2 && Math.random() < 0.58) setBlock(state, tx, ty, BLOCK.LAVA);
          if (!rim && ty <= centerY + 2 && Math.random() < 0.22) setBlock(state, tx, ty, BLOCK.BASALT);
        }
      }
    }

    for (let i = 0; i < 5; i += 1) {
      const lx = Math.floor(rand(region.x0 + 6, region.x1 - 6));
      const ly = Math.floor(rand(centerY, region.y1 - 3));
      carveCircle(state, lx, ly, Math.floor(rand(3, 6)), BLOCK.LAVA);
      carveCircle(state, lx, ly - 1, Math.floor(rand(3, 5)), BLOCK.AIR);
      for (let ty = ly - 3; ty <= ly + 4; ty += 1) {
        for (let tx = lx - 6; tx <= lx + 6; tx += 1) {
          if (getBlock(state, tx, ty) === BLOCK.DEEPSTONE || getBlock(state, tx, ty) === BLOCK.BLACKSTONE || getBlock(state, tx, ty) === BLOCK.STONE) {
            setBlock(state, tx, ty, BLOCK.BASALT);
          }
        }
      }
    }

    const domeRadiusX = 8;
    const domeRadiusY = 6;
    const shrineFloorY = centerY + domeRadiusY - 1;
    for (let ty = centerY - domeRadiusY - 1; ty <= centerY + domeRadiusY + 1; ty += 1) {
      for (let tx = centerX - domeRadiusX - 1; tx <= centerX + domeRadiusX + 1; tx += 1) {
        const nx = (tx - centerX) / domeRadiusX;
        const ny = (ty - centerY) / domeRadiusY;
        const oval = nx * nx + ny * ny;
        if (oval <= 1.1) {
          if (oval >= 0.72) setBlock(state, tx, ty, BLOCK.FIRE_SEAL);
          else setBlock(state, tx, ty, BLOCK.AIR);
        }
      }
    }
    for (let tx = centerX - domeRadiusX + 1; tx <= centerX + domeRadiusX - 1; tx += 1) setBlock(state, tx, shrineFloorY + 1, BLOCK.BASALT);
    setBlock(state, centerX - 2, shrineFloorY, BLOCK.BASALT);
    setBlock(state, centerX + 2, shrineFloorY, BLOCK.BASALT);
    placeTorchPair(state, centerX - 3, centerY - 2, 1);
    placeTorchPair(state, centerX + 3, centerY - 2, 1);

    const altarChestX = centerX;
    const altarChestY = shrineFloorY;
    setBlock(state, altarChestX, altarChestY, BLOCK.CHEST);
    const altarChest = ensureChestAt(state, altarChestX, altarChestY, null);
    clearChestSlots(altarChest);

    state.fireCaves.region = region;
    state.fireCaves.shrine = {
      altarChestX,
      altarChestY,
      rewardChestX: centerX + 4,
      rewardChestY: shrineFloorY,
      activated: false,
      rewardSpawned: false,
    };
  }

  function checkFireShrineActivation(state, tx, ty) {
    const shrine = state.fireCaves && state.fireCaves.shrine;
    if (!shrine || shrine.activated) return false;
    if (tx !== shrine.altarChestX || ty !== shrine.altarChestY) return false;
    const chest = state.chests && state.chests[chestKey(tx, ty)];
    if (!chest || !chestHasItem(chest, Game.items.ITEM.DEEP_DIAMOND, 1)) return false;

    removeItemFromChest(chest, Game.items.ITEM.DEEP_DIAMOND, 1);
    setBlock(state, shrine.rewardChestX, shrine.rewardChestY, BLOCK.CHEST);
    const rewardChest = ensureChestAt(state, shrine.rewardChestX, shrine.rewardChestY, null);
    clearChestSlots(rewardChest);
    rewardChest.slots[0] = { id: Game.items.ITEM.FIRE_CRYSTAL, count: 1, durability: null };
    shrine.activated = true;
    shrine.rewardSpawned = true;
    return true;
  }

  function generateWaterCaves(state) {
    const fireRegion = state.fireCaves && state.fireCaves.region;
    let region = null;
    const minCenterY = Math.max(DWARF_START + 14, UPPER_CAVE_END + 12);
    const maxCenterY = Math.min(DEEP_START - 4, WORLD_H - 32);
    for (let attempt = 0; attempt < 48 && !region; attempt += 1) {
      const centerX = Math.floor(rand(88, WORLD_W - 88));
      const centerY = Math.floor(rand(minCenterY, maxCenterY));
      const radiusX = Math.floor(rand(24, 34));
      const radiusY = Math.floor(rand(9, 14));
      const candidate = {
        x0: centerX - radiusX - 4,
        x1: centerX + radiusX + 4,
        y0: centerY - radiusY - 4,
        y1: centerY + radiusY + 4,
        centerX,
        centerY,
        radiusX,
        radiusY,
      };
      if (candidate.x0 < 10 || candidate.x1 > WORLD_W - 11 || candidate.y0 < 18 || candidate.y1 > WORLD_H - 14) continue;
      if (fireRegion && !(candidate.x1 < fireRegion.x0 - 18 || candidate.x0 > fireRegion.x1 + 18 || candidate.y1 < fireRegion.y0 - 12 || candidate.y0 > fireRegion.y1 + 12)) continue;
      const blocked = state.biomeAt.slice(candidate.x0, candidate.x1 + 1).some((biome) => biome === 'volcano' || biome === 'desert');
      if (blocked) continue;
      region = candidate;
    }

    if (!region) {
      state.waterCaves = null;
      return;
    }

    for (let ty = region.y0; ty <= region.y1; ty += 1) {
      for (let tx = region.x0; tx <= region.x1; tx += 1) {
        const nx = (tx - region.centerX) / region.radiusX;
        const ny = (ty - region.centerY) / region.radiusY;
        const oval = nx * nx + ny * ny;
        if (oval > 1.18) continue;
        if (oval > 0.92) setBlock(state, tx, ty, Math.random() < 0.42 ? BLOCK.DEEPSTONE : BLOCK.STONE);
        else setBlock(state, tx, ty, BLOCK.WATER);
      }
    }

    for (let i = 0; i < 4; i += 1) {
      const lx = Math.floor(rand(region.centerX - region.radiusX + 4, region.centerX + region.radiusX - 4));
      const ly = Math.floor(rand(region.centerY - 2, region.centerY + region.radiusY - 1));
      carveCircle(state, lx, ly, Math.floor(rand(3, 6)), BLOCK.WATER);
    }

    const entranceDir = Math.random() < 0.5 ? -1 : 1;
    const entranceX = region.centerX + entranceDir * (region.radiusX + 1);
    const corridorEndX = clamp(entranceX + entranceDir * Math.floor(rand(16, 26)), 6, WORLD_W - 7);
    const corridorY = region.centerY - Math.floor(region.radiusY * 0.45);
    for (let tx = Math.min(entranceX, corridorEndX); tx <= Math.max(entranceX, corridorEndX); tx += 1) {
      carveRect(state, tx - 1, corridorY - 2, tx + 1, corridorY + 2, BLOCK.AIR);
      setBlock(state, tx, corridorY + 3, BLOCK.STONE);
    }
    for (let tx = entranceX - 2; tx <= entranceX + 2; tx += 1) {
      for (let ty = corridorY - 2; ty <= corridorY + 2; ty += 1) {
        if (getBlock(state, tx, ty) !== BLOCK.AIR) setBlock(state, tx, ty, BLOCK.WATER);
      }
    }

    const frameX0 = region.centerX - 5;
    const frameX1 = region.centerX + 5;
    const frameY0 = region.centerY - 4;
    const frameY1 = region.centerY + 4;
    for (let tx = frameX0; tx <= frameX1; tx += 1) {
      setBlock(state, tx, frameY0, BLOCK.WATER_FRAME);
      setBlock(state, tx, frameY1, BLOCK.WATER_FRAME);
    }
    for (let ty = frameY0; ty <= frameY1; ty += 1) {
      setBlock(state, frameX0, ty, BLOCK.WATER_FRAME);
      setBlock(state, frameX1, ty, BLOCK.WATER_FRAME);
    }
    for (let ty = frameY0 + 1; ty < frameY1; ty += 1) {
      for (let tx = frameX0 + 1; tx < frameX1; tx += 1) setBlock(state, tx, ty, BLOCK.WATER);
    }
    setBlock(state, region.centerX, region.centerY, BLOCK.WATER_CRYSTAL);

    state.waterCaves = {
      region,
      frameX0,
      frameX1,
      frameY0,
      frameY1,
      crystalX: region.centerX,
      crystalY: region.centerY,
      crystalTaken: false,
      krakenSpawned: false,
      krakenDefeated: false,
      warningTimer: 0,
    };
  }

  function generateAirCaves(state) {
    const blockedRegion = state.waterCaves && state.waterCaves.region;
    let region = null;
    for (let attempt = 0; attempt < 48 && !region; attempt += 1) {
      const centerX = Math.floor(rand(96, WORLD_W - 96));
      const centerY = Math.floor(rand(DWARF_START + 4, Math.min(DWARF_END - 8, DEEP_START - 10)));
      const radiusX = Math.floor(rand(22, 32));
      const radiusY = Math.floor(rand(10, 15));
      const candidate = {
        x0: centerX - radiusX - 3,
        x1: centerX + radiusX + 3,
        y0: centerY - radiusY - 3,
        y1: centerY + radiusY + 5,
        centerX,
        centerY,
        radiusX,
        radiusY,
      };
      if (candidate.x0 < 10 || candidate.x1 > WORLD_W - 11 || candidate.y0 < UPPER_CAVE_START + 6 || candidate.y1 > DEEP_START - 4) continue;
      if (blockedRegion && !(candidate.x1 < blockedRegion.x0 - 20 || candidate.x0 > blockedRegion.x1 + 20 || candidate.y1 < blockedRegion.y0 - 8 || candidate.y0 > blockedRegion.y1 + 8)) continue;
      region = candidate;
    }
    if (!region) {
      state.airCaves = null;
      return;
    }

    for (let ty = region.y0; ty <= region.y1; ty += 1) {
      for (let tx = region.x0; tx <= region.x1; tx += 1) {
        const nx = (tx - region.centerX) / region.radiusX;
        const ny = (ty - region.centerY) / region.radiusY;
        const oval = nx * nx + ny * ny;
        if (oval > 1.18) continue;
        if (oval > 0.9) setBlock(state, tx, ty, Math.random() < 0.5 ? BLOCK.STONE : BLOCK.CLOUD);
        else setBlock(state, tx, ty, BLOCK.AIR);
      }
    }

    for (let i = 0; i < 7; i += 1) {
      const platformX = Math.floor(rand(region.x0 + 5, region.x1 - 5));
      const platformY = Math.floor(rand(region.y0 + 5, region.y1 - 4));
      const half = Math.floor(rand(2, 5));
      for (let tx = platformX - half; tx <= platformX + half; tx += 1) {
        const topY = platformY + Math.min(2, Math.abs(tx - platformX));
        setBlock(state, tx, topY, Math.random() < 0.45 ? BLOCK.CLOUD : BLOCK.STONE);
        if (Math.random() < 0.35) setBlock(state, tx, topY + 1, BLOCK.CLOUD);
      }
    }

    const crystalX = region.centerX;
    const crystalY = region.centerY - 3;
    setBlock(state, crystalX, crystalY + 3, BLOCK.CLOUD);
    setBlock(state, crystalX - 1, crystalY + 4, BLOCK.CLOUD);
    setBlock(state, crystalX + 1, crystalY + 4, BLOCK.CLOUD);
    setBlock(state, crystalX, crystalY, BLOCK.AIR_CRYSTAL);

    state.airCaves = {
      region,
      crystalX,
      crystalY,
      crystalTaken: false,
      cleared: false,
      warningTimer: 0,
      entrance: null,
    };
  }

  function stampAirEntrance(state, centerX, baseY) {
    const frame = BLOCK.AIR_ENTRANCE_FRAME;
    const x0 = centerX - 10;
    const x1 = centerX + 10;
    const y0 = baseY - 10;
    const y1 = baseY + 2;
    for (let tx = x0 - 2; tx <= x1 + 2; tx += 1) {
      for (let ty = y0 - 3; ty <= y1 + 3; ty += 1) {
        if (tx < 2 || tx >= WORLD_W - 2 || ty < 2 || ty >= WORLD_H - 2) continue;
        setBlock(state, tx, ty, BLOCK.AIR);
      }
    }
    for (let tx = x0; tx <= x1; tx += 1) {
      setBlock(state, tx, y1, frame);
      if (tx <= x0 + 2 || tx >= x1 - 2) setBlock(state, tx, y0, frame);
    }
    for (let ty = y0; ty <= y1; ty += 1) {
      setBlock(state, x0, ty, frame);
      setBlock(state, x1, ty, frame);
    }
    for (let tx = centerX - 4; tx <= centerX + 4; tx += 1) {
      setBlock(state, tx, y1, BLOCK.AIR);
      setBlock(state, tx, y1 - 1, BLOCK.AIR);
    }
    for (let ty = baseY - 1; ty <= baseY + 1; ty += 1) {
      setBlock(state, x0, ty, BLOCK.AIR);
      setBlock(state, x0 + 1, ty, BLOCK.AIR);
      setBlock(state, x1, ty, BLOCK.AIR);
      setBlock(state, x1 - 1, ty, BLOCK.AIR);
    }
    for (let tx = centerX - 3; tx <= centerX + 3; tx += 1) setBlock(state, tx, baseY - 3, frame);
    for (let ty = baseY - 3; ty <= baseY + 1; ty += 1) {
      setBlock(state, centerX - 3, ty, frame);
      setBlock(state, centerX + 3, ty, frame);
    }
    for (let tx = centerX - 1; tx <= centerX + 1; tx += 1) {
      setBlock(state, tx, baseY - 2, BLOCK.AIR);
      setBlock(state, tx, baseY - 1, BLOCK.AIR);
      setBlock(state, tx, baseY, BLOCK.AIR);
      setBlock(state, tx, baseY + 1, BLOCK.AIR);
    }
    for (let tx = centerX - 6; tx <= centerX + 6; tx += 1) setBlock(state, tx, y1 + 1, BLOCK.CLOUD);
  }

  function spawnAirEntrance(state) {
    if (!state.airCaves || state.activeDimension !== 'overworld') return false;
    if (state.airCaves.entrance && state.airCaves.entrance.spawned) return false;
    const centerX = Math.floor(rand(WORLD_W * 0.62, WORLD_W - 28));
    const baseY = 10;
    stampAirEntrance(state, centerX, baseY);
    state.airCaves.entrance = {
      centerX,
      baseY,
      x0: centerX - 10,
      x1: centerX + 10,
      y0: baseY - 10,
      y1: baseY + 2,
      altarX: centerX,
      altarY: baseY - 1,
      discovered: false,
      revealed: false,
      spawned: true,
      guardianSpawned: false,
      guardianDefeated: false,
      crystalPlaced: false,
      portalX: centerX,
      portalY: baseY - 7,
    };
    return true;
  }

  function oreHostMatches(blockId) {
    return blockId === BLOCK.STONE || blockId === BLOCK.BLACKSTONE || blockId === BLOCK.DEEPSTONE;
  }

  function generateCoalOre(state) {
    const veinCount = Math.floor(rand(118, 170));
    for (let i = 0; i < veinCount; i += 1) {
      const tx = Math.floor(rand(8, WORLD_W - 9));
      const band = Math.random() < 0.58 ? 'upper' : Math.random() < 0.8 ? 'dwarf' : 'deep';
      const ty = band === 'upper'
        ? Math.floor(rand(UPPER_CAVE_START - 8, UPPER_CAVE_END + 4))
        : band === 'dwarf'
          ? Math.floor(rand(dwarfStartAt(tx), dwarfEndAt(tx)))
          : Math.floor(rand(deepStartAt(tx) - 1, WORLD_H - 8));
      if (!oreHostMatches(getBlock(state, tx, ty))) continue;
      const nearCave = getBlock(state, tx + 1, ty) === BLOCK.AIR || getBlock(state, tx - 1, ty) === BLOCK.AIR || getBlock(state, tx, ty + 1) === BLOCK.AIR || getBlock(state, tx, ty - 1) === BLOCK.AIR;
      if (!nearCave && Math.random() < 0.72) continue;
      const veinSize = band === 'deep' ? Math.floor(rand(4, 8)) : Math.floor(rand(4, 10));
      let x = tx;
      let y = ty;
      for (let j = 0; j < veinSize; j += 1) {
        if (oreHostMatches(getBlock(state, x, y))) setBlock(state, x, y, BLOCK.COAL_ORE);
        x = clamp(x + Math.floor(rand(-1, 2)), 4, WORLD_W - 5);
        y = clamp(y + Math.floor(rand(-1, 2)), 12, WORLD_H - 6);
      }
    }
  }

  function generateGoldOre(state) {
    const veinCount = Math.floor(rand(72, 112));
    for (let i = 0; i < veinCount; i += 1) {
      const tx = Math.floor(rand(8, WORLD_W - 9));
      const band = Math.random() < 0.16 ? 'upper' : Math.random() < 0.65 ? 'dwarf' : 'deep';
      const ty = band === 'upper'
        ? Math.floor(rand(UPPER_CAVE_START + 2, UPPER_CAVE_END + 2))
        : band === 'dwarf'
          ? Math.floor(rand(dwarfStartAt(tx), dwarfEndAt(tx)))
          : Math.floor(rand(deepStartAt(tx) - 1, WORLD_H - 6));
      if (!oreHostMatches(getBlock(state, tx, ty))) continue;
      const nearCave = getBlock(state, tx + 1, ty) === BLOCK.AIR || getBlock(state, tx - 1, ty) === BLOCK.AIR || getBlock(state, tx, ty + 1) === BLOCK.AIR || getBlock(state, tx, ty - 1) === BLOCK.AIR;
      if (!nearCave && Math.random() < 0.85) continue;
      const veinSize = band === 'deep' ? Math.floor(rand(3, 6)) : Math.floor(rand(3, 7));
      let x = tx;
      let y = ty;
      for (let j = 0; j < veinSize; j += 1) {
        if (oreHostMatches(getBlock(state, x, y))) setBlock(state, x, y, BLOCK.GOLD_ORE);
        x = clamp(x + Math.floor(rand(-1, 2)), 4, WORLD_W - 5);
        y = clamp(y + Math.floor(rand(-1, 2)), 12, WORLD_H - 6);
      }
    }
  }

  function generateIronOre(state) {
    const veinCount = Math.floor(rand(92, 138));
    for (let i = 0; i < veinCount; i += 1) {
      const tx = Math.floor(rand(8, WORLD_W - 9));
      const roll = Math.random();
      const band = roll < 0.34 ? 'upper' : roll < 0.76 ? 'dwarf' : 'deep';
      const ty = band === 'upper'
        ? Math.floor(rand(UPPER_CAVE_START - 2, UPPER_CAVE_END + 5))
        : band === 'dwarf'
          ? Math.floor(rand(dwarfStartAt(tx), dwarfEndAt(tx)))
          : Math.floor(rand(deepStartAt(tx) - 1, WORLD_H - 7));
      if (!oreHostMatches(getBlock(state, tx, ty))) continue;
      const nearCave = getBlock(state, tx + 1, ty) === BLOCK.AIR || getBlock(state, tx - 1, ty) === BLOCK.AIR || getBlock(state, tx, ty + 1) === BLOCK.AIR || getBlock(state, tx, ty - 1) === BLOCK.AIR;
      if (!nearCave && Math.random() < 0.79) continue;
      const veinSize = band === 'deep' ? Math.floor(rand(4, 7)) : Math.floor(rand(4, 9));
      let x = tx;
      let y = ty;
      for (let j = 0; j < veinSize; j += 1) {
        if (oreHostMatches(getBlock(state, x, y))) setBlock(state, x, y, BLOCK.IRON_ORE);
        x = clamp(x + Math.floor(rand(-1, 2)), 4, WORLD_W - 5);
        y = clamp(y + Math.floor(rand(-1, 2)), 12, WORLD_H - 6);
      }
    }
  }

  function countBlockInWorld(state, blockId) {
    let total = 0;
    for (let ty = 0; ty < WORLD_H; ty += 1) {
      for (let tx = 0; tx < WORLD_W; tx += 1) {
        if (state.world[ty][tx] === blockId) total += 1;
      }
    }
    return total;
  }

  function retrofitVolcanoDiamondOre(state, volcanoSegments) {
    for (const segment of volcanoSegments) {
      for (let tx = segment.start; tx <= segment.end; tx += 1) {
        for (let ty = 0; ty < WORLD_H - 1; ty += 1) {
          if (getBlock(state, tx, ty) === BLOCK.DEEPSTONE && Math.random() < (1 / 3)) setBlock(state, tx, ty, BLOCK.DIAMOND_ORE);
        }
      }
    }
  }

  function retrofitWorldFeatures(state) {
    if (!('airCaves' in state)) state.airCaves = null;
    if (!('airGuardian' in state)) state.airGuardian = null;
    const worldType = state.worldMeta && state.worldMeta.worldType ? state.worldMeta.worldType : 'normal';
    if (!state.airCaves && state.activeDimension !== 'fire' && state.activeDimension !== 'water' && worldType !== 'flat') generateAirCaves(state);
    if (state.airCaves && !state.airCaves.crystalTaken && Number.isFinite(state.airCaves.crystalX) && Number.isFinite(state.airCaves.crystalY)) {
      const current = getBlock(state, state.airCaves.crystalX, state.airCaves.crystalY);
      if (current === BLOCK.AIR) setBlock(state, state.airCaves.crystalX, state.airCaves.crystalY, BLOCK.AIR_CRYSTAL);
    }
    const volcanoSegments = [];
    let x = 0;
    while (x < WORLD_W) {
      if (state.biomeAt[x] !== 'volcano') {
        x += 1;
        continue;
      }
      const start = x;
      while (x < WORLD_W && state.biomeAt[x] === 'volcano') x += 1;
      volcanoSegments.push({ start, end: x - 1 });
    }
    if (countBlockInWorld(state, BLOCK.IRON_ORE) === 0) generateIronOre(state);
    if (countBlockInWorld(state, BLOCK.GOLD_ORE) === 0) generateGoldOre(state);
    if (countBlockInWorld(state, BLOCK.DEEP_ORE) === 0) generateDeepOre(state);
    if (countBlockInWorld(state, BLOCK.DIAMOND_ORE) === 0 && volcanoSegments.length > 0) retrofitVolcanoDiamondOre(state, volcanoSegments);
  }

  function generateDeepOre(state) {
    const veinCount = Math.floor(rand(56, 84));
    for (let i = 0; i < veinCount; i += 1) {
      const tx = Math.floor(rand(8, WORLD_W - 9));
      const ty = Math.floor(rand(deepStartAt(tx) + 1, WORLD_H - 6));
      const host = getBlock(state, tx, ty);
      if (host !== BLOCK.DEEPSTONE && host !== BLOCK.BLACKSTONE) continue;
      const nearHeat =
        getBlock(state, tx + 1, ty) === BLOCK.LAVA ||
        getBlock(state, tx - 1, ty) === BLOCK.LAVA ||
        getBlock(state, tx, ty + 1) === BLOCK.LAVA ||
        getBlock(state, tx, ty - 1) === BLOCK.LAVA;
      const nearCave =
        getBlock(state, tx + 1, ty) === BLOCK.AIR ||
        getBlock(state, tx - 1, ty) === BLOCK.AIR ||
        getBlock(state, tx, ty + 1) === BLOCK.AIR ||
        getBlock(state, tx, ty - 1) === BLOCK.AIR;
      if (!nearHeat && !nearCave && Math.random() < 0.82) continue;
      let x = tx;
      let y = ty;
      const veinSize = Math.floor(rand(2, 5));
      for (let j = 0; j < veinSize; j += 1) {
        if (getBlock(state, x, y) === BLOCK.DEEPSTONE || getBlock(state, x, y) === BLOCK.BLACKSTONE) setBlock(state, x, y, BLOCK.DEEP_ORE);
        x = clamp(x + Math.floor(rand(-1, 2)), 4, WORLD_W - 5);
        y = clamp(y + Math.floor(rand(-1, 2)), DEEP_START - 2, WORLD_H - 6);
      }
    }
  }

  function hasLeakPath(state, x0, x1, liquidTop) {
    for (let tx = x0; tx <= x1; tx += 1) {
      const edge = tx === x0 || tx === x1;
      const floorY = state.surfaceAt[tx] - 1;
      if (edge && floorY <= liquidTop + 1) return true;
      for (let ty = liquidTop; ty <= Math.min(floorY, liquidTop + 1); ty += 1) {
        if (getBlock(state, tx - 1, ty) === BLOCK.AIR || getBlock(state, tx + 1, ty) === BLOCK.AIR) return true;
      }
    }
    return false;
  }

  function carveSurfaceBasin(state, options) {
    const allowedCenters = [];
    for (let tx = options.minX; tx <= options.maxX; tx += 1) {
      const biome = state.biomeAt[tx];
      if ((biome === 'plains' || biome === 'forest') && tx > 4 && tx < WORLD_W - 5) allowedCenters.push(tx);
    }
    if (allowedCenters.length === 0) return null;
    const center = allowedCenters[Math.floor(rand(0, allowedCenters.length))];
    const radius = Math.floor(rand(options.minRadius, options.maxRadius));
    const depth = Math.floor(rand(options.minDepth, options.maxDepth));
    const x0 = clamp(center - radius, 3, WORLD_W - 4);
    const x1 = clamp(center + radius, 3, WORLD_W - 4);
    for (let tx = x0; tx <= x1; tx += 1) {
      const biome = state.biomeAt[tx];
      if (biome !== 'plains' && biome !== 'forest') return null;
    }
    const original = state.surfaceAt.slice(x0, x1 + 1);
    const rimDelta = Math.abs(original[0] - original[original.length - 1]);
    if (rimDelta > 3) return null;
    for (let tx = x0; tx <= x1; tx += 1) {
      const edgeDistance = Math.abs(tx - center) / Math.max(1, radius);
      const curve = 1 - edgeDistance * edgeDistance;
      const carve = Math.max(0, Math.round(depth * curve));
      state.surfaceAt[tx] = clamp(state.surfaceAt[tx] + carve, 18, 42);
    }
    const liquidTop = Math.min(original[0], original[original.length - 1]);
    const filledColumns = [];
    for (let tx = x0 + 1; tx <= x1 - 1; tx += 1) {
      if (state.surfaceAt[tx] - 2 >= liquidTop) filledColumns.push(tx);
    }
    if (filledColumns.length < 4) return null;
    return { type: options.type, x0, x1, liquidTop, filledColumns, stable: !hasLeakPath(state, x0, x1, liquidTop) };
  }

  function carveFallbackBasin(state, type) {
    for (let attempt = 0; attempt < 42; attempt += 1) {
      const center = Math.floor(rand(12, WORLD_W - 12));
      if (state.biomeAt[center] !== 'plains' && state.biomeAt[center] !== 'forest') continue;
      const radius = type === 'water' ? Math.floor(rand(4, 8)) : Math.floor(rand(3, 5));
      const depth = type === 'water' ? Math.floor(rand(2, 4)) : Math.floor(rand(2, 3));
      const x0 = center - radius;
      const x1 = center + radius;
      let valid = true;
      for (let tx = x0; tx <= x1; tx += 1) {
        if (tx < 3 || tx >= WORLD_W - 3) { valid = false; break; }
        const biome = state.biomeAt[tx];
        if (biome !== 'plains' && biome !== 'forest') { valid = false; break; }
      }
      if (!valid) continue;
      const rim = Math.round((state.surfaceAt[x0] + state.surfaceAt[x1]) / 2);
      for (let tx = x0; tx <= x1; tx += 1) {
        const dist = Math.abs(tx - center) / Math.max(1, radius);
        const carve = Math.max(0, Math.round(depth * (1 - dist * dist)));
        state.surfaceAt[tx] = clamp(Math.max(state.surfaceAt[tx], rim + carve), 18, 42);
      }
      const filledColumns = [];
      for (let tx = x0 + 1; tx <= x1 - 1; tx += 1) {
        if (state.surfaceAt[tx] - 2 >= rim) filledColumns.push(tx);
      }
      if (filledColumns.length < 3) continue;
      return { type, x0, x1, liquidTop: rim, filledColumns, stable: true };
    }
    return null;
  }

  function fillSurfaceBasin(state, basin) {
    if (!basin.stable) return;
    const fluidId = basin.type === 'water' ? BLOCK.WATER : BLOCK.LAVA;
    for (const tx of basin.filledColumns) {
      for (let ty = basin.liquidTop; ty < state.surfaceAt[tx] - 1; ty += 1) setBlock(state, tx, ty, fluidId);
      if (basin.type === 'water') state.biomeAt[tx] = 'lake';
    }
  }

  function reinforceSurfaceLayer(state, surfaceFluidColumns = null) {
    for (let tx = 0; tx < WORLD_W; tx += 1) {
      if (surfaceFluidColumns && (surfaceFluidColumns.has(tx) || surfaceFluidColumns.has(tx - 1) || surfaceFluidColumns.has(tx + 1))) continue;
      const s = state.surfaceAt[tx];
      const biome = state.biomeAt[tx];
      const surfaceBlock = getBlock(state, tx, s);
      if (surfaceBlock === BLOCK.WATER || surfaceBlock === BLOCK.LAVA) continue;
      if (biome === 'mountains') setBlock(state, tx, s, BLOCK.STONE);
      else if (biome === 'snow_plains') setBlock(state, tx, s, BLOCK.SNOW);
      else if (biome === 'desert') setBlock(state, tx, s, BLOCK.SAND);
      else if (biome === 'volcano') setBlock(state, tx, s, BLOCK.BLACKSTONE);
      else setBlock(state, tx, s, BLOCK.GRASS);
      const filler = biome === 'volcano' ? BLOCK.BLACKSTONE : biome === 'mountains' ? BLOCK.STONE : biome === 'desert' ? BLOCK.SANDSTONE : BLOCK.DIRT;
      for (let ty = s + 1; ty <= Math.min(WORLD_H - 2, s + 2); ty += 1) {
        if (getBlock(state, tx, ty) === BLOCK.AIR) setBlock(state, tx, ty, filler);
      }
    }
  }

  function removeFloatingDebris(state) {
    for (let ty = 6; ty < WORLD_H - 2; ty += 1) {
      for (let tx = 2; tx < WORLD_W - 2; tx += 1) {
        const id = getBlock(state, tx, ty);
        if (!isRockLike(id)) continue;
        if (ty <= state.surfaceAt[tx] + 2) continue;
        const below = getBlock(state, tx, ty + 1);
        if (below !== BLOCK.AIR && below !== BLOCK.WATER && below !== BLOCK.LAVA) continue;
        const supportCount = [getBlock(state, tx - 1, ty), getBlock(state, tx + 1, ty), getBlock(state, tx, ty - 1)].filter(isRockLike).length;
        if (supportCount <= 1) setBlock(state, tx, ty, BLOCK.AIR);
      }
    }
  }

  function carveEntrance(state, centerX, surfaceY, width, depth) {
    const bottomY = Math.min(WORLD_H - 8, surfaceY + depth);
    for (let ty = surfaceY - 1; ty <= bottomY; ty += 1) {
      const progress = (ty - surfaceY + 1) / Math.max(1, depth + 1);
      const halfWidth = Math.max(1, Math.round(width / 2 + Math.sin(progress * Math.PI) * 1.5));
      for (let tx = centerX - halfWidth; tx <= centerX + halfWidth; tx += 1) setBlock(state, tx, ty, BLOCK.AIR);
    }
  }

  function carveCaveEntrances(state, blockedColumns, count) {
    let carved = 0;
    let attempts = 0;
    while (carved < count && attempts < 200) {
      attempts += 1;
      const tx = Math.floor(rand(8, WORLD_W - 9));
      const biome = state.biomeAt[tx];
      if (biome === 'volcano' || blockedColumns.has(tx) || blockedColumns.has(tx - 1) || blockedColumns.has(tx + 1)) continue;
      const surfaceY = state.surfaceAt[tx];
      let caveY = -1;
      for (let ty = surfaceY + 5; ty <= Math.min(UPPER_CAVE_END, surfaceY + 22); ty += 1) {
        if (getBlock(state, tx, ty) === BLOCK.AIR || getBlock(state, tx - 1, ty) === BLOCK.AIR || getBlock(state, tx + 1, ty) === BLOCK.AIR) {
          caveY = ty;
          break;
        }
      }
      if (caveY < 0) continue;
      carveEntrance(state, tx, surfaceY, biome === 'mountains' ? 3 : 2, caveY - surfaceY + 1);
      carved += 1;
    }
  }

  function plantSpruceTree(state, tx, s) {
    const height = Math.floor(rand(5, 8));
    for (let i = 1; i <= height; i += 1) setBlock(state, tx, s - i, BLOCK.SPRUCE_WOOD);
    const topY = s - height;
    for (let yy = -4; yy <= 0; yy += 1) {
      const width = yy <= -3 ? 1 : yy === -2 ? 2 : 3;
      for (let xx = -width; xx <= width; xx += 1) {
        if (Math.abs(xx) === width && width > 1 && Math.random() < 0.2) continue;
        if (getBlock(state, tx + xx, topY + yy) === BLOCK.AIR) setBlock(state, tx + xx, topY + yy, BLOCK.SPRUCE_LEAF);
      }
    }
    if (getBlock(state, tx, topY - 1) === BLOCK.AIR) setBlock(state, tx, topY - 1, BLOCK.SPRUCE_LEAF);
  }

  function plantTrees(state, surfaceFluidColumns) {
    for (let tx = 4; tx < WORLD_W - 4; tx += 1) {
      const biome = state.biomeAt[tx];
      if (biome === 'lake' || biome === 'mountains' || biome === 'volcano' || biome === 'desert' || surfaceFluidColumns.has(tx)) continue;
      const treeChance = biome === 'forest' ? 0.09 : biome === 'snow_plains' ? 0.045 : 0.01;
      if (Math.random() >= treeChance) continue;
      const s = state.surfaceAt[tx];
      const surfaceBlock = getBlock(state, tx, s);
      const validSurface = biome === 'snow_plains' ? surfaceBlock === BLOCK.SNOW : surfaceBlock === BLOCK.GRASS;
      if (!validSurface || getBlock(state, tx, s - 1) !== BLOCK.AIR) continue;
      if (Math.abs(state.surfaceAt[tx - 1] - s) > (biome === 'snow_plains' ? 1 : 1) || Math.abs(state.surfaceAt[tx + 1] - s) > (biome === 'snow_plains' ? 1 : 1)) continue;
      if (biome === 'snow_plains') {
        plantSpruceTree(state, tx, s);
        continue;
      }
      const height = Math.floor(rand(3, 6));
      for (let i = 1; i <= height; i += 1) setBlock(state, tx, s - i, BLOCK.WOOD);
      const topY = s - height;
      for (let yy = -2; yy <= 1; yy += 1) {
        for (let xx = -2; xx <= 2; xx += 1) {
          if (Math.abs(xx) + Math.abs(yy) < 4 && getBlock(state, tx + xx, topY + yy) === BLOCK.AIR) setBlock(state, tx + xx, topY + yy, BLOCK.LEAF);
        }
      }
    }
  }

  function plantDesertFlora(state, surfaceFluidColumns) {
    let cactusCount = 0;
    let bushCount = 0;
    const inFirePyramid = (tx) => !!(state.firePyramid && state.firePyramid.bounds && tx >= state.firePyramid.bounds.x0 - 1 && tx <= state.firePyramid.bounds.x1 + 1);
    function tryPlace(skipVillageBounds) {
      for (let tx = 4; tx < WORLD_W - 4; tx += 1) {
        if (state.biomeAt[tx] !== 'desert' || surfaceFluidColumns.has(tx)) continue;
        if (inFirePyramid(tx)) continue;
        if (!skipVillageBounds && (state.humanSettlements.villages || []).some((village) => tx >= village.bounds.x0 && tx <= village.bounds.x1)) continue;
        const s = state.surfaceAt[tx];
        if (getBlock(state, tx, s) !== BLOCK.SAND || getBlock(state, tx, s - 1) !== BLOCK.AIR) continue;
        if (Math.random() < 0.09 && getBlock(state, tx, s - 2) === BLOCK.AIR && getBlock(state, tx, s - 3) === BLOCK.AIR) {
          const height = Math.random() < 0.34 ? 3 : 2;
          for (let i = 1; i <= height; i += 1) setBlock(state, tx, s - i, BLOCK.CACTUS);
          cactusCount += 1;
        } else if (Math.random() < 0.18) {
          setBlock(state, tx, s - 1, BLOCK.DRY_BUSH);
          bushCount += 1;
        }
      }
    }

    tryPlace(false);

    if (cactusCount === 0 || bushCount === 0) {
      for (const skipVillageBounds of [false, true]) {
        for (let tx = 6; tx < WORLD_W - 6; tx += 1) {
          if (state.biomeAt[tx] !== 'desert' || surfaceFluidColumns.has(tx)) continue;
          if (inFirePyramid(tx)) continue;
          if (!skipVillageBounds && (state.humanSettlements.villages || []).some((village) => tx >= village.bounds.x0 && tx <= village.bounds.x1)) continue;
          const s = state.surfaceAt[tx];
          if (getBlock(state, tx, s) !== BLOCK.SAND) continue;
          if (cactusCount === 0 && getBlock(state, tx, s - 1) === BLOCK.AIR && getBlock(state, tx, s - 2) === BLOCK.AIR) {
            setBlock(state, tx, s - 1, BLOCK.CACTUS);
            setBlock(state, tx, s - 2, BLOCK.CACTUS);
            cactusCount += 1;
          } else if (bushCount === 0 && getBlock(state, tx, s - 1) === BLOCK.AIR) {
            setBlock(state, tx, s - 1, BLOCK.DRY_BUSH);
            bushCount += 1;
          }
          if (cactusCount > 0 && bushCount > 0) return;
        }
      }
    }
  }

  function chooseVillageProfession(type) {
    const pool = type === 'mountain_village'
      ? MOUNTAIN_PROFESSIONS
      : type === 'desert_village'
        ? DESERT_PROFESSIONS
        : type === 'winter_village'
          ? WINTER_PROFESSIONS
          : PLAINS_PROFESSIONS;
    return pool[Math.floor(rand(0, pool.length))];
  }

  function prepareVillageGround(state, x0, x1, baseY, type = 'plains_village') {
    const style = getVillageStyle(type);
    for (let tx = x0; tx <= x1; tx += 1) {
      if (tx < 3 || tx >= WORLD_W - 3) continue;
      state.surfaceAt[tx] = baseY;
      state.biomeAt[tx] = type === 'desert_village' ? 'desert' : type === 'winter_village' ? 'snow_plains' : state.biomeAt[tx];
      state.climateAt[tx] = climateForBiome(state.biomeAt[tx]);
      setBlock(state, tx, baseY, style.surface);
      setBlock(state, tx, baseY + 1, style.subsoil);
      setBlock(state, tx, baseY + 2, style.subsoil);
      setBlock(state, tx, baseY + 3, style.deepSubsoil);
      for (let ty = Math.max(1, baseY - 12); ty < baseY; ty += 1) {
        if (getBlock(state, tx, ty) !== BLOCK.BEDROCK) setBlock(state, tx, ty, BLOCK.AIR);
      }
    }
  }

  function placeLampPost(state, tx, groundY) {
    setBlock(state, tx, groundY - 1, BLOCK.PILLAR);
    if (getBlock(state, tx, groundY - 2) === BLOCK.AIR) setBlock(state, tx, groundY - 2, BLOCK.TORCH);
  }

  function placeVillageChest(state, tx, ty, ownerSettlementId) {
    setBlock(state, tx, ty, BLOCK.CHEST);
    const key = chestKey(tx, ty);
    if (!state.chests[key]) {
      state.chests[key] = createChestState(ownerSettlementId);
      fillChestLoot(state.chests[key]);
    }
  }

  function canHostFirePyramid(state, centerX) {
    if (centerX < 10 || centerX > WORLD_W - 11) return false;
    if ((state.climateAt[centerX] || CLIMATE.TEMPERATE) !== CLIMATE.WARM) return false;
    const biome = state.biomeAt[centerX];
    if (biome !== 'desert') return false;
    const baseY = state.surfaceAt[centerX];
    for (let tx = centerX - 7; tx <= centerX + 7; tx += 1) {
      if ((state.climateAt[tx] || CLIMATE.TEMPERATE) !== CLIMATE.WARM) return false;
      if (state.biomeAt[tx] !== biome) return false;
      if (Math.abs(state.surfaceAt[tx] - baseY) > 3) return false;
      if ((state.humanSettlements.villages || []).some((village) => tx >= village.bounds.x0 - 6 && tx <= village.bounds.x1 + 6)) return false;
    }
    return true;
  }

  function stampFirePyramid(state, centerX) {
    const baseY = state.surfaceAt[centerX];
    const biome = state.biomeAt[centerX];
    const x0 = centerX - 7;
    const x1 = centerX + 7;
    const y0 = baseY - 10;
    const y1 = baseY;

    for (let tx = x0 - 1; tx <= x1 + 1; tx += 1) {
      state.surfaceAt[tx] = baseY;
      setBlock(state, tx, baseY, BLOCK.SAND);
      setBlock(state, tx, baseY + 1, BLOCK.SANDSTONE);
      setBlock(state, tx, baseY + 2, BLOCK.SANDSTONE);
      for (let ty = y0; ty < baseY; ty += 1) {
        if (getBlock(state, tx, ty) !== BLOCK.BEDROCK) setBlock(state, tx, ty, BLOCK.AIR);
      }
      state.biomeAt[tx] = 'desert';
      state.climateAt[tx] = CLIMATE.WARM;
    }

    const set = (dx, dy, block) => setBlock(state, centerX + dx, baseY + dy, block);

    for (let dx = -4; dx <= 4; dx += 1) set(dx, 0, BLOCK.BLACKSTONE);
    for (let dx = -3; dx <= 3; dx += 1) set(dx, -1, BLOCK.BLACKSTONE);
    for (let dx = -2; dx <= 2; dx += 1) set(dx, -2, BLOCK.BLACKSTONE);
    set(0, -2, BLOCK.LAVA);

    for (let y = -1; y >= -8; y -= 1) {
      set(-6, y, BLOCK.CACTUS);
      set(6, y, BLOCK.CACTUS);
    }

    set(-5, -1, BLOCK.TORCH);
    set(5, -1, BLOCK.TORCH);

    for (let dx = -7; dx <= -5; dx += 1) set(dx, -5, BLOCK.BLACKSTONE);
    for (let dx = -6; dx <= -4; dx += 1) set(dx, -6, BLOCK.BLACKSTONE);
    for (let dx = -6; dx <= -5; dx += 1) set(dx, -7, BLOCK.BLACKSTONE);
    set(-5, -8, BLOCK.DRY_BUSH);

    for (let dx = 5; dx <= 7; dx += 1) set(dx, -5, BLOCK.BLACKSTONE);
    for (let dx = 4; dx <= 6; dx += 1) set(dx, -6, BLOCK.BLACKSTONE);
    for (let dx = 5; dx <= 6; dx += 1) set(dx, -7, BLOCK.BLACKSTONE);
    set(5, -8, BLOCK.DRY_BUSH);

    set(-1, -6, BLOCK.BLACKSTONE);
    set(0, -6, BLOCK.BLACKSTONE);
    set(1, -6, BLOCK.BLACKSTONE);
    set(0, -7, BLOCK.BLACKSTONE);
    set(0, -8, BLOCK.CACTUS);
    set(0, -9, BLOCK.CACTUS);
    set(0, -10, BLOCK.CACTUS);

    state.firePyramid = {
      centerX,
      baseY,
      bounds: { x0, x1, y0, y1 },
      climate: CLIMATE.WARM,
      biome,
      name: 'Пирамида огня',
      lavaX: centerX,
      lavaY: baseY - 2,
      ritual: {
        active: false,
        phase: 'idle',
        timer: 0,
        clearedToY: baseY - 2,
        noonTriggered: false,
        completed: false,
        bossSpawned: false,
        portalCreated: false,
      },
    };
  }

  function generateFirePyramid(state) {
    state.firePyramid = null;
    const candidates = [];
    for (let tx = 10; tx < WORLD_W - 10; tx += 1) {
      if (!canHostFirePyramid(state, tx)) continue;
      let score = 0;
      const baseY = state.surfaceAt[tx];
      for (let xx = tx - 7; xx <= tx + 7; xx += 1) score += Math.abs(state.surfaceAt[xx] - baseY);
      candidates.push({ tx, score });
    }
    if (candidates.length > 0) {
      candidates.sort((a, b) => a.score - b.score);
      const topPool = candidates.slice(0, Math.min(6, candidates.length));
      const chosen = topPool[Math.floor(rand(0, topPool.length))];
      stampFirePyramid(state, chosen.tx);
      return;
    }

    const desertSegments = findBiomeSegments(state, 'desert')
      .filter((segment) => segment.end - segment.start >= 18)
      .sort((a, b) => (b.end - b.start) - (a.end - a.start));
    if (desertSegments.length === 0) return;

    for (const segment of desertSegments) {
      const minX = Math.max(10, segment.start + 7);
      const maxX = Math.min(WORLD_W - 11, segment.end - 7);
      if (minX > maxX) continue;
      const fallback = [];
      for (let tx = minX; tx <= maxX; tx += 1) {
        if ((state.climateAt[tx] || CLIMATE.TEMPERATE) !== CLIMATE.WARM) continue;
        if ((state.humanSettlements.villages || []).some((village) => tx >= village.bounds.x0 - 10 && tx <= village.bounds.x1 + 10)) continue;
        let score = 0;
        const baseY = state.surfaceAt[tx];
        for (let xx = tx - 7; xx <= tx + 7; xx += 1) score += Math.abs(state.surfaceAt[xx] - baseY);
        fallback.push({ tx, score });
      }
      if (!fallback.length) continue;
      fallback.sort((a, b) => a.score - b.score);
      stampFirePyramid(state, fallback[0].tx);
      return;
    }

    stampFirePyramid(state, clamp(desertSegments[0].center, 10, WORLD_W - 11));
  }

  function canHostWaterWell(state, centerX) {
    if (centerX < 12 || centerX > WORLD_W - 13) return false;
    if (state.biomeAt[centerX] !== 'snow_plains') return false;
    const baseY = state.surfaceAt[centerX];
    for (let tx = centerX - 8; tx <= centerX + 8; tx += 1) {
      if (state.biomeAt[tx] !== 'snow_plains') return false;
      if (Math.abs(state.surfaceAt[tx] - baseY) > 2) return false;
      if ((state.humanSettlements.villages || []).some((village) => tx >= village.bounds.x0 - 8 && tx <= village.bounds.x1 + 8)) return false;
    }
    return true;
  }

  function stampWaterWell(state, centerX) {
    const baseY = state.surfaceAt[centerX];
    const x0 = centerX - 8;
    const x1 = centerX + 8;
    const y0 = baseY - 10;
    const y1 = baseY;
    for (let tx = x0 - 1; tx <= x1 + 1; tx += 1) {
      state.surfaceAt[tx] = baseY;
      setBlock(state, tx, baseY, BLOCK.SNOW);
      setBlock(state, tx, baseY + 1, BLOCK.DIRT);
      setBlock(state, tx, baseY + 2, BLOCK.STONE);
      for (let ty = y0; ty < baseY; ty += 1) {
        if (getBlock(state, tx, ty) !== BLOCK.BEDROCK) setBlock(state, tx, ty, BLOCK.AIR);
      }
      state.biomeAt[tx] = 'snow_plains';
      state.climateAt[tx] = CLIMATE.COLD;
    }

    const set = (dx, dy, block) => setBlock(state, centerX + dx, baseY + dy, block);
    const frame = BLOCK.WATER_WELL_FRAME;

    for (let dx = -5; dx <= 5; dx += 1) set(dx, -7, frame);
    for (let dy = -7; dy <= -5; dy += 1) {
      set(-5, dy, frame);
      set(5, dy, frame);
    }

    for (let dx = -7; dx <= -3; dx += 1) set(dx, -2, frame);
    for (let dx = 3; dx <= 7; dx += 1) set(dx, -2, frame);
    for (let dx = -4; dx <= 4; dx += 1) set(dx, 0, frame);
    for (let dy = -2; dy <= -1; dy += 1) {
      set(-4, dy, frame);
      set(4, dy, frame);
    }
    for (let dx = -3; dx <= 3; dx += 1) {
      for (let dy = -2; dy <= -1; dy += 1) set(dx, dy, BLOCK.WATER);
    }

    state.waterWell = {
      centerX,
      baseY,
      bounds: { x0, x1, y0, y1 },
      waterX0: centerX - 3,
      waterX1: centerX + 3,
      waterY0: baseY - 2,
      waterY1: baseY - 1,
      ritual: {
        active: false,
        phase: 'idle',
        timer: 0,
        completed: false,
        portalCreated: false,
      },
      portalX: centerX,
      portalY: baseY - 1,
      name: 'Водный колодец',
    };
  }

  function generateWaterWell(state) {
    state.waterWell = null;
    const candidates = [];
    for (let tx = 12; tx < WORLD_W - 12; tx += 1) {
      if (!canHostWaterWell(state, tx)) continue;
      let score = 0;
      const baseY = state.surfaceAt[tx];
      for (let xx = tx - 8; xx <= tx + 8; xx += 1) score += Math.abs(state.surfaceAt[xx] - baseY);
      candidates.push({ tx, score });
    }
    if (candidates.length > 0) {
      candidates.sort((a, b) => a.score - b.score);
      const topPool = candidates.slice(0, Math.min(5, candidates.length));
      const chosen = topPool[Math.floor(rand(0, topPool.length))];
      stampWaterWell(state, chosen.tx);
      return;
    }

    const snowSegments = findBiomeSegments(state, 'snow_plains')
      .filter((segment) => segment.end - segment.start >= 18)
      .sort((a, b) => (b.end - b.start) - (a.end - a.start));
    if (snowSegments.length === 0) return;

    for (const segment of snowSegments) {
      const minX = Math.max(12, segment.start + 8);
      const maxX = Math.min(WORLD_W - 13, segment.end - 8);
      if (minX > maxX) continue;
      const fallbackX = Math.floor((minX + maxX) / 2);
      const baseY = state.surfaceAt[fallbackX];
      for (let tx = fallbackX - 8; tx <= fallbackX + 8; tx += 1) state.surfaceAt[tx] = baseY;
      stampWaterWell(state, fallbackX);
      return;
    }
  }

  function spawnVillageSheep(state, tx, groundY, dir = 1) {
    const animal = {
      x: tx * TILE + 2,
      y: (groundY - 1) * TILE,
      w: 12,
      h: 10,
      vx: 0,
      vy: 0,
      onGround: false,
      hp: 3,
      dir,
      state: 'idle',
      stateTimer: 1.6,
      grazing: true,
      walkMin: 6,
      walkMax: 10,
      moveSpeed: 18,
      panicSpeed: 54,
      targetVx: 0,
      hopCd: 0,
      obstacleTimer: 0,
      clickCd: 0,
      edgeCooldown: 0,
      commitTimer: 0,
      stuckTimer: 0,
      turnLockTimer: 0,
      breath: 3.5,
      inWater: false,
      underwater: false,
      lavaDamageTimer: 0,
    };
    state.animals.push(animal);
  }

  function decorateVillageRoad(state, x0, x1, groundY) {
    for (let tx = x0; tx <= x1; tx += 1) {
      setBlock(state, tx, groundY, BLOCK.PATH);
      if ((tx - x0) % 14 === 6) {
        placeLampPost(state, tx, groundY);
      }
    }
  }

  function decorateHouseInterior(state, house, village) {
    const floorY = house.groundY;
    const x0 = house.x0;
    const x1 = house.x1;
    const mid = Math.floor((x0 + x1) / 2);
    const bedX = x0 + 2;
    const bedY = floorY - 1;
    house.bedX = bedX;
    house.bedY = bedY;
    if (getBlock(state, bedX, bedY) === BLOCK.AIR) setBlock(state, bedX, bedY, BLOCK.PILLOW);
      setBlock(state, mid, floorY, village.type === 'mountain_village' ? BLOCK.STONE : village.type === 'desert_village' ? BLOCK.SANDSTONE : BLOCK.PLANK);
    if (house.profession === 'merchant') {
      placeVillageChest(state, mid - 1, floorY - 1, village.id);
      placeVillageChest(state, mid + 1, floorY - 1, village.id);
      setBlock(state, mid, floorY, village.type === 'desert_village' ? BLOCK.SANDSTONE : BLOCK.PLANK);
    } else if (house.profession === 'miner') {
      placeVillageChest(state, mid - 1, floorY - 1, village.id);
      setBlock(state, mid + 1, floorY - 1, BLOCK.LADDER);
      setBlock(state, mid, floorY, BLOCK.STONE);
    } else if (house.profession === 'mason') {
      setBlock(state, mid - 1, floorY, BLOCK.STONE);
      setBlock(state, mid + 1, floorY, BLOCK.DEEPSTONE);
      setBlock(state, mid, floorY - 1, BLOCK.PILLAR);
    } else if (house.profession === 'lumber') {
      setBlock(state, mid - 1, floorY, BLOCK.WOOD);
      setBlock(state, mid + 1, floorY, BLOCK.PLANK);
      placeVillageChest(state, mid, floorY - 1, village.id);
    } else if (house.profession === 'farmer') {
      placeVillageChest(state, mid - 1, floorY - 1, village.id);
      setBlock(state, mid + 1, floorY, BLOCK.PLANK);
    } else if (house.profession === 'shepherd') {
      placeVillageChest(state, mid, floorY - 1, village.id);
      setBlock(state, mid - 1, floorY, BLOCK.PLANK);
      setBlock(state, mid + 1, floorY, BLOCK.PLANK);
    } else if (village.type === 'desert_village') {
      setBlock(state, mid - 1, floorY, BLOCK.SANDSTONE);
      setBlock(state, mid + 1, floorY, BLOCK.SANDSTONE);
    } else if (house.role === 'guard') {
      setBlock(state, mid - 1, floorY, BLOCK.STONE);
      setBlock(state, mid + 1, floorY, BLOCK.STONE);
      placeVillageChest(state, mid, floorY - 1, village.id);
    }
  }

  function decorateWorkyard(state, house, village, side) {
    const baseY = house.groundY;
    const workX = side < 0 ? house.x0 - 5 : house.x1 + 5;
    if (house.profession === 'farmer') {
      for (let dx = -2; dx <= 2; dx += 1) {
        setBlock(state, workX + dx, baseY, BLOCK.DIRT);
        if (dx % 2 === 0 && getBlock(state, workX + dx, baseY - 1) === BLOCK.AIR) setBlock(state, workX + dx, baseY - 1, BLOCK.LEAF);
      }
      placeLampPost(state, workX, baseY);
    } else if (house.profession === 'shepherd') {
      for (let dx = -3; dx <= 3; dx += 1) {
        setBlock(state, workX + dx, baseY, BLOCK.PATH);
      }
      setBlock(state, workX - 3, baseY - 1, BLOCK.PILLAR);
      setBlock(state, workX + 3, baseY - 1, BLOCK.PILLAR);
      setBlock(state, workX - 3, baseY - 2, BLOCK.PILLAR);
      setBlock(state, workX + 3, baseY - 2, BLOCK.PILLAR);
      if (Math.random() < 0.7) spawnVillageSheep(state, workX - 1, baseY, 1);
      if (Math.random() < 0.7) spawnVillageSheep(state, workX + 1, baseY, -1);
    } else if (house.profession === 'lumber') {
      setBlock(state, workX - 1, baseY - 1, village.type === 'winter_village' ? BLOCK.SPRUCE_WOOD : BLOCK.WOOD);
      setBlock(state, workX, baseY - 1, village.type === 'winter_village' ? BLOCK.SPRUCE_WOOD : BLOCK.WOOD);
      setBlock(state, workX + 1, baseY - 1, BLOCK.PLANK);
      setBlock(state, workX + 2, baseY - 1, BLOCK.PILLAR);
    } else if (house.profession === 'mason') {
      setBlock(state, workX - 1, baseY - 1, BLOCK.STONE);
      setBlock(state, workX, baseY - 1, BLOCK.DEEPSTONE);
      setBlock(state, workX + 1, baseY - 1, BLOCK.PILLAR);
      setBlock(state, workX + 2, baseY - 1, BLOCK.STONE);
    } else if (house.profession === 'miner') {
      placeVillageChest(state, workX - 1, baseY - 1, village.id);
      setBlock(state, workX, baseY - 1, BLOCK.LADDER);
      setBlock(state, workX + 1, baseY - 1, BLOCK.COAL_ORE);
      if (Math.random() < 0.45) setBlock(state, workX + 2, baseY - 1, BLOCK.GOLD_ORE);
    } else if (house.profession === 'merchant') {
      placeVillageChest(state, workX - 1, baseY - 1, village.id);
      setBlock(state, workX, baseY - 1, village.type === 'desert_village' ? BLOCK.SANDSTONE : BLOCK.PLANK);
      placeVillageChest(state, workX + 1, baseY - 1, village.id);
      placeLampPost(state, workX, baseY);
    } else if (village.type === 'desert_village') {
      setBlock(state, workX - 1, baseY - 1, BLOCK.SANDSTONE);
      setBlock(state, workX, baseY - 1, BLOCK.CACTUS);
      if (getBlock(state, workX + 1, baseY - 1) === BLOCK.AIR) setBlock(state, workX + 1, baseY - 1, BLOCK.DRY_BUSH);
    } else if (village.type === 'winter_village') {
      setBlock(state, workX - 1, baseY - 1, BLOCK.SPRUCE_WOOD);
      setBlock(state, workX, baseY - 1, BLOCK.PLANK);
      setBlock(state, workX + 1, baseY - 1, BLOCK.SPRUCE_LEAF);
    }
  }

  function buildVillageTower(state, village, cx, groundY, inward) {
    const topY = groundY - 10;
    const style = getVillageStyle(village.type);
    prepareVillageGround(state, cx - 3, cx + 3, groundY, village.type);
    for (let tx = cx - 2; tx <= cx + 2; tx += 1) {
      setBlock(state, tx, groundY, style.tower);
      setBlock(state, tx, topY, style.tower);
    }
    for (let ty = topY; ty <= groundY; ty += 1) {
      setBlock(state, cx - 2, ty, style.tower);
      setBlock(state, cx + 2, ty, style.tower);
      if (ty > topY && ty < groundY) {
        setBlock(state, cx - 1, ty, BLOCK.AIR);
        setBlock(state, cx, ty, BLOCK.AIR);
        setBlock(state, cx + 1, ty, BLOCK.AIR);
      }
    }
    for (let ty = groundY - 1; ty >= topY + 1; ty -= 1) setBlock(state, cx, ty, BLOCK.LADDER);
    placeDoor(state, cx - 2, groundY - 1, { ownerSettlementId: village.id, tower: true, open: true, height: 2 });
    placeDoor(state, cx + 2, groundY - 1, { ownerSettlementId: village.id, tower: true, open: true, height: 2 });
    placeTorchPair(state, cx - 1, topY + 1, 1);
    placeTorchPair(state, cx + 1, topY + 1, 1);
    const baseNode = addHumanNode(state, village.id, 'tower_base', cx, groundY - 1);
    const topNode = addHumanNode(state, village.id, 'tower_top', cx, topY + 1);
    addHumanEdge(state, baseNode, topNode, 'ladder');
    village.towers.push({
      x: cx,
      groundY,
      doorX: cx + inward,
      doorY: groundY - 1,
      doorXs: [cx - 2, cx + 2],
      baseNodeId: baseNode.id,
      topNodeId: topNode.id
    });
    return { baseNode, topNode };
  }

  function buildVillageHouse(state, village, cx, groundY, profession, role = 'villager', options = {}) {
    const style = getVillageStyle(village.type);
    const wallBlock = style.wall;
    const supportBlock = style.support;
    const roofBlock = style.roof;
    const halfW = options.halfW || (role === 'guard' ? 3 : village.type === 'mountain_village' ? Math.floor(rand(4, 6)) : village.type === 'winter_village' ? Math.floor(rand(4, 6)) : Math.floor(rand(4, 6)));
    const height = options.height || (role === 'guard' ? 4 : Math.floor(rand(5, 7)));
    const x0 = cx - halfW;
    const x1 = cx + halfW;
    const topY = groundY - height;
    prepareVillageGround(state, x0 - 2, x1 + 2, groundY, village.type);

    for (let tx = x0; tx <= x1; tx += 1) {
      setBlock(state, tx, groundY, style.subsoil);
      setBlock(state, tx, topY, roofBlock);
      if (tx > x0 && tx < x1 && Math.abs(tx - cx) < halfW) setBlock(state, tx, topY - 1, roofBlock);
    }
    for (let ty = topY; ty <= groundY; ty += 1) {
      setBlock(state, x0, ty, wallBlock);
      setBlock(state, x1, ty, wallBlock);
      if (ty > topY && ty < groundY) {
        for (let tx = x0 + 1; tx <= x1 - 1; tx += 1) setBlock(state, tx, ty, BLOCK.AIR);
      }
    }

    setBlock(state, x0, groundY - 1, supportBlock);
    setBlock(state, x1, groundY - 1, supportBlock);
    setBlock(state, x0 + 1, groundY - 2, BLOCK.AIR);
    setBlock(state, x1 - 1, groundY - 2, BLOCK.AIR);
    placeDoor(state, x0, groundY - 1, { ownerSettlementId: village.id, open: true, height: 2 });
    placeDoor(state, x1, groundY - 1, { ownerSettlementId: village.id, open: true, height: 2 });
    if (halfW >= 4) {
      setBlock(state, cx - 1, topY + 2, BLOCK.AIR);
      setBlock(state, cx + 1, topY + 2, BLOCK.AIR);
    }
    placeTorchPair(state, x0 + 1, groundY - 3, 0.7);
    placeTorchPair(state, x1 - 1, groundY - 3, 0.7);

    const houseNode = addHumanNode(state, village.id, 'house', cx, groundY - 1, { profession, role });
    const workSide = options.workSide || (Math.random() < 0.5 ? -1 : 1);
    const workNode = addHumanNode(state, village.id, 'work', cx + workSide * (halfW + 4), groundY - 1, { profession });
    const house = {
      id: `${village.id}-house-${village.houses.length}`,
      x: cx,
      x0,
      x1,
      y: groundY - 1,
      groundY,
      halfW,
      height,
      spawnX: cx,
      spawnY: groundY - 1,
      nodeId: houseNode.id,
      workNodeId: workNode.id,
      residentId: null,
      respawnTimer: 0,
      profession,
      role,
      leftDoorX: x0,
      rightDoorX: x1,
      doorY: groundY - 1,
    };
    village.houses.push(house);
    decorateHouseInterior(state, house, village);
    decorateWorkyard(state, house, village, workSide);
    return { houseNode, workNode, house };
  }

  function buildGuardHut(state, village, tower, inward, guardIndex) {
    const hutX = tower.x + inward * 8;
    const { houseNode, workNode, house } = buildVillageHouse(state, village, hutX, tower.groundY, 'guard', 'guard', { halfW: 3, height: 4, workSide: inward });
    house.towerNodeId = guardIndex % 2 === 0
      ? (tower.topNodeId || (tower.topNode && tower.topNode.id) || null)
      : (tower.baseNodeId || (tower.baseNode && tower.baseNode.id) || null);
    return { houseNode, workNode, house };
  }

  function findBiomeSegments(state, biome) {
    const segments = [];
    let x = 0;
    while (x < WORLD_W) {
      if (state.biomeAt[x] !== biome) {
        x += 1;
        continue;
      }
      const start = x;
      while (x < WORLD_W && state.biomeAt[x] === biome) x += 1;
      segments.push({ start, end: x - 1, center: Math.floor((start + x - 1) / 2) });
    }
    return segments;
  }

  function generateHumanVillage(state, segment, type, index) {
    const village = {
      id: `human-village-${index}`,
      type,
      centerX: segment.center,
      alertLevel: 0,
      alertTimer: 0,
      palette: VILLAGER_PALETTES[index % VILLAGER_PALETTES.length],
      houses: [],
      towers: [],
      bounds: { x0: segment.center, x1: segment.center, y0: 0, y1: 0 },
    };
    const segmentWidth = segment.end - segment.start + 1;
    const desiredCount = type === 'mountain_village' ? Math.floor(rand(6, 9)) : type === 'desert_village' ? Math.floor(rand(7, 10)) : type === 'winter_village' ? Math.floor(rand(7, 10)) : Math.floor(rand(8, 11));
    const spacing = type === 'mountain_village' ? 16 : type === 'desert_village' ? 16 : type === 'winter_village' ? 16 : 15;
    const minCount = type === 'mountain_village' ? 4 : type === 'desert_village' ? 5 : type === 'winter_village' ? 5 : 6;
    const maxCount = Math.max(minCount, Math.floor((segmentWidth - 32) / spacing) + 1);
    const houseCount = Math.max(minCount, Math.min(desiredCount, maxCount));
    const totalWidth = (houseCount - 1) * spacing;
    const startX = clamp(segment.center - Math.floor(totalWidth / 2), segment.start + 16, segment.end - 16);
    const groundY = state.surfaceAt[segment.center];
    const centerNodes = [];
    const roadX0 = startX - 12;
    const roadX1 = startX + totalWidth + 12;

    prepareVillageGround(state, roadX0 - 2, roadX1 + 2, groundY, type);
    decorateVillageRoad(state, roadX0, roadX1, groundY);

    for (let i = 0; i < houseCount; i += 1) {
      const x = startX + i * spacing;
      const roadNode = addHumanNode(state, village.id, 'center', x, groundY - 1);
      centerNodes.push(roadNode);
      if (i > 0) addHumanEdge(state, centerNodes[i - 1], roadNode, 'walk');
    }

    const leftTower = buildVillageTower(state, village, roadX0, groundY, 1);
    const rightTower = buildVillageTower(state, village, roadX1, groundY, -1);
    addHumanEdge(state, leftTower.baseNode, centerNodes[0], 'walk');
    addHumanEdge(state, centerNodes[centerNodes.length - 1], rightTower.baseNode, 'walk');

    const leftGuard = buildGuardHut(state, village, { ...leftTower, x: roadX0, groundY }, 1, 0);
    const rightGuard = buildGuardHut(state, village, { ...rightTower, x: roadX1, groundY }, -1, 1);
    addHumanEdge(state, leftGuard.houseNode, leftTower.baseNode, 'walk');
    addHumanEdge(state, leftGuard.workNode, leftTower.baseNode, 'walk');
    addHumanEdge(state, rightGuard.houseNode, rightTower.baseNode, 'walk');
    addHumanEdge(state, rightGuard.workNode, rightTower.baseNode, 'walk');

    for (let i = 0; i < houseCount; i += 1) {
      const x = startX + i * spacing;
      const profession = chooseVillageProfession(village.type);
      const { houseNode, workNode, house } = buildVillageHouse(state, village, x, groundY, profession, 'villager');
      addHumanEdge(state, houseNode, centerNodes[i], 'walk');
      addHumanEdge(state, workNode, centerNodes[i], 'walk');
    }

    village.bounds = { x0: roadX0 - 8, x1: roadX1 + 8, y0: groundY - 12, y1: groundY + 3 };
    state.humanSettlements.villages.push(village);
  }

  function generateVillages(state) {
    state.humanSettlements = { villages: [], nodes: [], edges: [] };
    const plains = findBiomeSegments(state, 'plains').filter((segment) => segment.end - segment.start >= 120);
    const snowPlains = findBiomeSegments(state, 'snow_plains').filter((segment) => segment.end - segment.start >= 96);
    const mountains = findBiomeSegments(state, 'mountains').filter((segment) => segment.end - segment.start >= 72);
    const deserts = findBiomeSegments(state, 'desert').filter((segment) => segment.end - segment.start >= 72);
    let index = 0;
    plains.sort((a, b) => (b.end - b.start) - (a.end - a.start));
    if (plains[0]) generateHumanVillage(state, plains[0], 'plains_village', index++);
    snowPlains.sort((a, b) => (b.end - b.start) - (a.end - a.start));
    if (snowPlains[0]) generateHumanVillage(state, snowPlains[0], 'winter_village', index++);
    mountains.sort((a, b) => (b.end - b.start) - (a.end - a.start));
    if (mountains[0]) generateHumanVillage(state, mountains[0], 'mountain_village', index++);
    deserts.sort((a, b) => (b.end - b.start) - (a.end - a.start));
    if (deserts[0]) generateHumanVillage(state, deserts[0], 'desert_village', index++);
    if (plains[1]) generateHumanVillage(state, plains[1], 'plains_village', index++);
  }

  function applySingleBiomeSurface(state, biome) {
    const climate = climateForBiome(biome);
    let prev = SURFACE_BASE;
    const mountainRidges = [];
    const volcanoCones = [];
    if (biome === 'mountains') {
      let cursor = Math.floor(rand(24, 42));
      while (cursor < WORLD_W - 24) {
        mountainRidges.push({
          center: cursor + Math.floor(rand(-8, 9)),
          width: Math.floor(rand(26, 58)),
          lift: rand(7, 15),
        });
        cursor += Math.floor(rand(36, 74));
      }
    }
    if (biome === 'volcano') {
      let cursor = Math.floor(rand(26, 48));
      while (cursor < WORLD_W - 26) {
        volcanoCones.push({
          center: cursor + Math.floor(rand(-6, 7)),
          width: Math.floor(rand(18, 34)),
          lift: rand(6, 11),
          crater: Math.random() < 0.58,
          lava: Math.random() < 0.45,
        });
        cursor += Math.floor(rand(40, 78));
      }
    }
    for (let x = 0; x < WORLD_W; x += 1) {
      let target = biome === 'plains' || biome === 'desert' || biome === 'snow_plains'
        ? SURFACE_BASE + rand(-0.6, 0.6)
        : SURFACE_BASE + rand(-1.2, 1.2);
      if (biome === 'mountains') {
        target = SURFACE_BASE + 4.6 + Math.sin(x / 23) * 1.1 + rand(-0.45, 0.45);
        for (const ridge of mountainRidges) {
          const dist = Math.abs(x - ridge.center) / Math.max(1, ridge.width);
          if (dist > 1) continue;
          const shape = Math.pow(1 - dist, 0.6);
          target -= ridge.lift * shape;
        }
      } else if (biome === 'forest') {
        target += Math.sin(x / 9) * 1.2 + rand(-0.4, 0.4);
      } else if (biome === 'desert') {
        target += Math.sin(x / 14) * 0.9 + rand(-0.25, 0.25);
      } else if (biome === 'snow_plains') {
        target += Math.sin(x / 12) * 0.7 + rand(-0.2, 0.2);
      } else if (biome === 'volcano') {
        target = SURFACE_BASE + 4.8 + Math.sin(x / 17) * 0.55 + rand(-0.22, 0.22);
        for (const cone of volcanoCones) {
          const dist = Math.abs(x - cone.center) / Math.max(1, cone.width);
          if (dist > 1) continue;
          const shape = Math.pow(1 - dist * dist, 0.5);
          target -= cone.lift * shape;
          if (cone.crater && Math.abs(x - cone.center) <= Math.max(2, Math.floor(cone.width * 0.16))) target += 3.2;
        }
      } else if (x % Math.floor(rand(12, 22)) === 0) {
        target += rand(-0.4, 0.4);
      }
      const maxStep = biome === 'mountains' ? 2.1 : biome === 'forest' ? 1.1 : biome === 'desert' ? 0.6 : biome === 'snow_plains' ? 0.55 : biome === 'volcano' ? 1.35 : 0.4;
      const minY = biome === 'mountains' ? 8 : biome === 'volcano' ? 10 : 20;
      const maxY = biome === 'mountains' ? 30 : biome === 'volcano' ? 34 : 36;
      state.surfaceAt[x] = Math.round(clamp(prev + clamp(target - prev, -maxStep, maxStep), minY, maxY));
      state.biomeAt[x] = biome;
      state.climateAt[x] = climate;
      prev = state.surfaceAt[x];
    }
  }

  function collectSingleBiomeVolcanoSegments(state) {
    const segments = [];
    let x = 0;
    while (x < WORLD_W) {
      if (state.surfaceAt[x] > SURFACE_BASE + 1) {
        x += 1;
        continue;
      }
      const start = x;
      while (x < WORLD_W && state.surfaceAt[x] <= SURFACE_BASE + 1) x += 1;
      const end = x - 1;
      if (end - start + 1 >= 12) segments.push({ start, end, center: Math.floor((start + end) / 2) });
    }
    if (segments.length === 0) {
      for (let center = 42; center < WORLD_W - 42; center += 64) {
        segments.push({ start: center - 12, end: center + 12, center });
      }
    }
    return segments;
  }

  function generateSingleBiomeFireWorld(state, biome) {
    state.world = createGrid();
    state.biomeAt = Array(WORLD_W).fill(biome);
    state.climateAt = Array(WORLD_W).fill(CLIMATE.WARM);
    state.surfaceAt = Array(WORLD_W).fill(8);
    state.animals = [];
    state.zombies = [];
    state.spiders = [];
    state.fireGuards = [];
    state.waterfolk = [];
    state.humans = [];
    state.dwarves = [];
    state.humanSettlements = { villages: [], nodes: [], edges: [] };
    state.dwarfColony = { homes: [], stockpiles: [], halls: [], shafts: [], worksites: [], nodes: [], edges: [], settlements: [] };
    state.foods = [];
    state.chests = {};
    state.furnaces = {};
    state.doors = {};
    state.fireCaves = { region: null, shrine: null };
    state.firePyramid = null;
    state.fireBoss = null;
    state.fireKing = null;
    state.fireDungeon = null;
    state.friendlyFireKing = null;
    state.waterCaves = null;
    state.airCaves = null;
    state.waterWell = null;
    state.airGuardian = null;
    state.kraken = null;
    state.quake = null;
    state.fireWorldMeta = null;
    state.waterWorldMeta = null;

    const lavaLakeStart = Math.floor(WORLD_H * 0.62);
    const ceil = Array(WORLD_W).fill(8);
    const floor = Array(WORLD_W).fill(lavaLakeStart - 22);
    for (let tx = 0; tx < WORLD_W; tx += 1) {
      const ceiling = Math.round(8 + Math.sin(tx / 21) * 1.8 + Math.sin(tx / 9) * 1.1);
      let floorY = Math.round(42 + Math.sin(tx / 29) * 3.8 + Math.sin(tx / 14) * 2.1);
      if (biome === 'lava_lake') floorY += 4;
      ceil[tx] = clamp(ceiling, 6, 13);
      floor[tx] = clamp(floorY, 34, lavaLakeStart - 6);
      state.surfaceAt[tx] = ceil[tx];
      for (let ty = 0; ty < WORLD_H; ty += 1) {
        if (ty === WORLD_H - 1) {
          setBlock(state, tx, ty, BLOCK.BEDROCK);
          continue;
        }
        if (ty >= lavaLakeStart) {
          setBlock(state, tx, ty, BLOCK.LAVA);
          continue;
        }
        if (ty <= ceil[tx] || ty >= floor[tx]) {
          setBlock(state, tx, ty, biome === 'red_land' ? BLOCK.RED_EARTH : BLOCK.BASALT);
        } else {
          setBlock(state, tx, ty, BLOCK.AIR);
        }
      }
      if (biome === 'lava_lake') {
        const lavaTop = floor[tx] - Math.floor(rand(2, 5));
        for (let ty = lavaTop; ty < floor[tx]; ty += 1) setBlock(state, tx, ty, BLOCK.LAVA);
        for (let ty = lavaTop - 2; ty < lavaTop; ty += 1) if (getBlock(state, tx, ty) !== BLOCK.LAVA) setBlock(state, tx, ty, BLOCK.BASALT);
      }
    }

    for (let i = 0; i < 18; i += 1) {
      const sx = rand(8, WORLD_W - 9);
      const sy = rand(12, lavaLakeStart - 10);
      carveTunnel(state, sx, sy, Math.floor(rand(24, 64)), Math.floor(rand(3, 5)), 8, lavaLakeStart - 8);
    }

    const spawnX = Math.floor(WORLD_W * 0.2);
    const spawnY = Math.floor((ceil[spawnX] + floor[spawnX]) / 2);
    carveRect(state, spawnX - 6, spawnY - 3, spawnX + 6, spawnY + 4, BLOCK.AIR);
    for (let tx = spawnX - 3; tx <= spawnX + 3; tx += 1) setBlock(state, tx, spawnY + 4, BLOCK.BASALT);
    state.player.x = spawnX * TILE;
    state.player.y = spawnY * TILE;
  }

  function generateSingleBiomeWaterWorld(state, biome) {
    state.world = createGrid();
    state.biomeAt = Array(WORLD_W).fill(biome);
    state.climateAt = Array(WORLD_W).fill(CLIMATE.ANY);
    state.surfaceAt = Array(WORLD_W).fill(6);
    state.animals = [];
    state.zombies = [];
    state.spiders = [];
    state.fireGuards = [];
    state.waterfolk = [];
    state.humans = [];
    state.dwarves = [];
    state.humanSettlements = { villages: [], nodes: [], edges: [] };
    state.dwarfColony = { homes: [], stockpiles: [], halls: [], shafts: [], worksites: [], nodes: [], edges: [], settlements: [] };
    state.foods = [];
    state.chests = {};
    state.furnaces = {};
    state.doors = {};
    state.fireCaves = { region: null, shrine: null };
    state.firePyramid = null;
    state.fireBoss = null;
    state.fireKing = null;
    state.fireDungeon = null;
    state.friendlyFireKing = null;
    state.waterCaves = null;
    state.airCaves = null;
    state.waterWell = null;
    state.goldenFlowerGuardian = null;
    state.airGuardian = null;
    state.kraken = null;
    state.quake = null;
    state.fireWorldMeta = null;
    state.waterWorldMeta = null;

    if (biome === 'golden_garden') {
      const groundBase = SURFACE_BASE + 2;
      for (let tx = 0; tx < WORLD_W; tx += 1) {
        const top = Math.round(groundBase + Math.sin(tx / 17) * 1.1 + Math.sin(tx / 8) * 0.5);
        state.surfaceAt[tx] = top;
        for (let ty = 0; ty < WORLD_H; ty += 1) {
          if (ty === WORLD_H - 1) setBlock(state, tx, ty, BLOCK.BEDROCK);
          else if (ty < top) setBlock(state, tx, ty, BLOCK.AIR);
          else if (ty === top) setBlock(state, tx, ty, BLOCK.GRASS);
          else if (ty <= top + 2) setBlock(state, tx, ty, BLOCK.DIRT);
          else setBlock(state, tx, ty, BLOCK.STONE);
        }
        if (Math.random() < 0.18 && tx > 6 && tx < WORLD_W - 6) plantGoldenFlower(state, tx, top - 1);
      }
      state.waterWorldMeta = {
        name: 'Сад золотых цветков',
        goldenGarden: {
          x0: 0,
          x1: WORLD_W - 1,
          y0: 0,
          y1: WORLD_H - 2,
          centerX: Math.floor(WORLD_W / 2),
          groundY: state.surfaceAt[Math.floor(WORLD_W / 2)],
          flowerTaken: false,
          guardianSpawned: false,
          guardianDefeated: false,
        },
      };
      const spawnX = Math.floor(WORLD_W * 0.2);
      state.player.x = spawnX * TILE;
      state.player.y = (state.surfaceAt[spawnX] - 3) * TILE;
      return;
    }

    const floorStart = biome === 'water_floor' ? Math.floor(WORLD_H * 0.36) : Math.floor(WORLD_H * 0.54);
    for (let tx = 0; tx < WORLD_W; tx += 1) {
      const floorY = biome === 'water_floor'
        ? Math.round(floorStart + Math.sin(tx / 23) * 2.4 + Math.sin(tx / 11) * 1.2)
        : Math.round(floorStart + Math.sin(tx / 31) * 1.5 + Math.sin(tx / 15) * 0.8);
      state.surfaceAt[tx] = 5;
      for (let ty = 0; ty < WORLD_H; ty += 1) {
        if (ty === WORLD_H - 1) {
          setBlock(state, tx, ty, BLOCK.BEDROCK);
        } else if (ty >= floorY) {
          setBlock(state, tx, ty, ty < floorY + 3 ? BLOCK.SAND : BLOCK.STONE);
        } else {
          setBlock(state, tx, ty, BLOCK.WATER);
        }
      }
      if (biome === 'water_floor') state.biomeAt[tx] = 'water_floor';
    }
    state.waterWorldMeta = {
      name: biome === 'water_floor' ? 'Дно' : 'Водная гладь',
      floorStart,
    };
    const spawnX = Math.floor(WORLD_W / 2);
    const spawnY = biome === 'water_floor' ? floorStart - 8 : 18;
    carveRect(state, spawnX - 5, spawnY - 3, spawnX + 5, spawnY + 4, BLOCK.WATER);
    state.player.x = spawnX * TILE;
    state.player.y = spawnY * TILE;
  }

  function generateSingleBiomeAirWorld(state, biome) {
    state.world = createGrid();
    state.biomeAt = Array(WORLD_W).fill(biome === 'air_isles' ? 'air_plains' : biome);
    state.climateAt = Array(WORLD_W).fill(CLIMATE.ANY);
    state.surfaceAt = Array(WORLD_W).fill(WORLD_H - 4);
    state.animals = [];
    state.zombies = [];
    state.spiders = [];
    state.fireGuards = [];
    state.waterfolk = [];
    state.windfolk = [];
    state.humans = [];
    state.dwarves = [];
    state.humanSettlements = { villages: [], nodes: [], edges: [] };
    state.dwarfColony = { homes: [], stockpiles: [], halls: [], shafts: [], worksites: [], nodes: [], edges: [], settlements: [] };
    state.foods = [];
    state.chests = {};
    state.furnaces = {};
    state.doors = {};
    state.fireCaves = { region: null, shrine: null };
    state.firePyramid = null;
    state.fireBoss = null;
    state.fireKing = null;
    state.fireDungeon = null;
    state.friendlyFireKing = null;
    state.waterCaves = null;
    state.airCaves = null;
    state.waterWell = null;
    state.goldenFlowerGuardian = null;
    state.airGuardian = null;
    state.airThief = null;
    state.kraken = null;
    state.quake = null;
    state.fireWorldMeta = null;
    state.waterWorldMeta = null;
    state.airWorldMeta = null;
    state.zombieSpawnTick = 0;
    state.zombieCaveSpawnTick = 0;
    state.spiderSpawnTick = 0;
    state.spiderCaveSpawnTick = 0;
    state.fluidTick = 0;

    const islands = [];
    const spawnCx = Math.floor(WORLD_W * 0.18);
    if (biome !== 'air_void') {
      islands.push(carveCloudIsland(state, spawnCx, 38, 34, 10, 9));
      const centers = [94, 162, 230, 298, 366, 434, 502, 570, 638, 706];
      for (let i = 0; i < centers.length; i += 1) {
        const cx = centers[i];
        const cy = 30 + (i % 4) * 8 + Math.floor(rand(0, 4));
        const rx = 22 + (i % 3) * 6;
        const ry = 6 + (i % 2) * 2;
        const thickness = 6 + (i % 3);
        islands.push(carveCloudIsland(state, cx, cy, rx, ry, thickness));
      }
    } else {
      islands.push(carveCloudIsland(state, spawnCx, 38, 18, 6, 6));
    }

    const spawnIsland = islands[0];
    state.player.x = spawnIsland.centerX * TILE;
    state.player.y = (spawnIsland.topY - 3) * TILE;
  }

  function generateFlatWorld(state) {
    state.biomeAt = Array(WORLD_W).fill('plains');
    state.climateAt = Array(WORLD_W).fill(CLIMATE.TEMPERATE);
    state.surfaceAt = Array(WORLD_W).fill(Math.round(SURFACE_BASE + 4));
    fillTerrain(state);
    reinforceSurfaceLayer(state, new Set());
    plantTrees(state, new Set());
    reinforceSurfaceLayer(state, new Set());
    generateVillages(state);
    generateWaterWell(state);
    state.firePyramid = null;
    for (let tx = 0; tx < WORLD_W; tx += 1) setBlock(state, tx, WORLD_H - 1, BLOCK.BEDROCK);
    const spawnX = chooseSpawnColumn(state, new Set());
    state.player.x = spawnX * TILE;
    state.player.y = (state.surfaceAt[spawnX] - 3) * TILE;
  }

  function generateSingleBiomeWorld(state, biome) {
    if (SINGLE_BIOME_CAVE_SET.has(biome)) {
      generateCavernWorld(state, biome);
      state.worldMeta.worldType = 'single_biome';
      return;
    }
    if (SINGLE_BIOME_FIRE_SET.has(biome)) {
      generateSingleBiomeFireWorld(state, biome);
      return;
    }
    if (SINGLE_BIOME_WATER_SET.has(biome)) {
      generateSingleBiomeWaterWorld(state, biome);
      return;
    }
    if (SINGLE_BIOME_AIR_SET.has(biome)) {
      generateSingleBiomeAirWorld(state, biome);
      return;
    }
    const basins = [];
    const surfaceFluidColumns = new Set();
    applySingleBiomeSurface(state, biome);
    smoothSurface(state, 1);
    if (biome === 'plains' || biome === 'desert' || biome === 'snow_plains') flattenPlains(state);
    if (biome === 'plains' || biome === 'desert' || biome === 'snow_plains') addPlainMicroRelief(state);

    const volcanoSegments = biome === 'volcano' ? collectSingleBiomeVolcanoSegments(state) : [];
    if (biome === 'volcano') shapeVolcanoes(state, volcanoSegments);

    if (biome === 'plains' || biome === 'forest') {
      const waterBasinCount = Math.floor(rand(10, 16));
      const lavaBasinCount = Math.floor(rand(3, 6));
      for (let i = 0; i < waterBasinCount; i += 1) {
        const basin = carveSurfaceBasin(state, { type: 'water', minX: 16, maxX: WORLD_W - 17, minRadius: 6, maxRadius: 11, minDepth: 3, maxDepth: 6 });
        if (basin && basin.stable) basins.push(basin);
      }
      for (let i = 0; i < lavaBasinCount; i += 1) {
        const basin = carveSurfaceBasin(state, { type: 'lava', minX: 22, maxX: WORLD_W - 23, minRadius: 4, maxRadius: 7, minDepth: 2, maxDepth: 4 });
        if (basin && basin.stable) basins.push(basin);
      }
      if (basins.filter((b) => b.type === 'water').length < 2) {
        const fallback = carveFallbackBasin(state, 'water');
        if (fallback) basins.push(fallback);
      }
      if (basins.filter((b) => b.type === 'lava').length < 1) {
        const fallback = carveFallbackBasin(state, 'lava');
        if (fallback) basins.push(fallback);
      }
      for (const basin of basins) {
        for (const tx of basin.filledColumns) surfaceFluidColumns.add(tx);
      }
    }

    fillTerrain(state);
    carveUpperCaves(state);
    generateMineshafts(state);
    generateMineEntranceShafts(state, surfaceFluidColumns);
    const dwarfSettlements = generateDwarfCaverns(state);
    generateDwarfEntrances(state, dwarfSettlements);
    generateFalseDwarfSeals(state, Math.floor(rand(2, 5)));
    generateDeepZones(state, volcanoSegments);
    generateFireCaves(state);
    generateWaterCaves(state);
    for (const segment of volcanoSegments) carveVolcanoCore(state, segment);
    generateCoalOre(state);
    generateIronOre(state);
    generateGoldOre(state);
    generateDeepOre(state);
    for (const basin of basins) fillSurfaceBasin(state, basin);
    reinforceSurfaceLayer(state, surfaceFluidColumns);
    plantTrees(state, surfaceFluidColumns);
    removeFloatingDebris(state);
    reinforceSurfaceLayer(state, surfaceFluidColumns);
    carveCaveEntrances(state, surfaceFluidColumns, Math.floor(rand(6, 10)));
    generateVillages(state);
    if (biome === 'snow_plains') generateWaterWell(state);
    else state.waterWell = null;
    if (biome === 'desert') generateFirePyramid(state);
    else state.firePyramid = null;
    if (biome === 'desert') plantDesertFlora(state, surfaceFluidColumns);

    for (let tx = 0; tx < WORLD_W; tx += 1) setBlock(state, tx, WORLD_H - 1, BLOCK.BEDROCK);

    const spawnX = chooseSpawnColumn(state, surfaceFluidColumns);
    state.player.x = spawnX * TILE;
    state.player.y = (state.surfaceAt[spawnX] - 3) * TILE;
  }

  function floatingSurfaceBlock(topBiome) {
    if (topBiome === 'snow_plains') return BLOCK.SNOW;
    if (topBiome === 'desert') return BLOCK.SAND;
    return BLOCK.GRASS;
  }

  function stampFloatingIsland(state, cx, cy, rx, ry, topBiome = 'plains') {
    const topBlock = floatingSurfaceBlock(topBiome);
    for (let tx = Math.floor(cx - rx - 1); tx <= Math.ceil(cx + rx + 1); tx += 1) {
      if (tx < 2 || tx >= WORLD_W - 2) continue;
      const nx = Math.abs(tx - cx) / Math.max(1, rx);
      if (nx > 1.05) continue;
      const arch = Math.pow(Math.max(0, 1 - nx * nx), 0.55);
      const topY = Math.round(cy - 1.2 - arch * (ry * 0.42) + Math.sin((tx - cx) / 3.2) * 0.35);
      const thickness = Math.max(3, Math.round(ry * (0.9 + arch * 1.35)));
      const bottomY = topY + thickness;
      for (let ty = topY; ty <= bottomY; ty += 1) {
        if (ty < 2 || ty >= WORLD_H - 2) continue;
        const depth = ty - topY;
        let block = BLOCK.STONE;
        if (depth === 0) block = topBlock;
        else if (depth <= 2) block = topBiome === 'desert' ? BLOCK.SANDSTONE : BLOCK.DIRT;
        if (depth > thickness - 2 && Math.random() < 0.18) continue;
        setBlock(state, tx, ty, block);
      }
      state.surfaceAt[tx] = Math.min(state.surfaceAt[tx], topY);
      state.biomeAt[tx] = topBiome;
      state.climateAt[tx] = climateForBiome(topBiome);
    }
  }

  function generateFloatingIslandsWorld(state) {
    state.biomeAt = Array(WORLD_W).fill('void');
    state.climateAt = Array(WORLD_W).fill(CLIMATE.ANY);
    state.surfaceAt = Array(WORLD_W).fill(WORLD_H - 4);
    const starter = { cx: Math.floor(WORLD_W * 0.18), cy: 22, rx: 18, ry: 7, biome: 'plains' };
    stampFloatingIsland(state, starter.cx, starter.cy, starter.rx, starter.ry, starter.biome);
    const biomes = ['plains', 'forest', 'snow_plains'];
    let cx = starter.cx + Math.floor(rand(16, 22));
    while (cx < WORLD_W - 12) {
      const rx = Math.floor(rand(9, 16));
      const ry = Math.floor(rand(4, 7));
      const cy = Math.floor(rand(18, 30));
      const biome = biomes[Math.floor(rand(0, biomes.length))];
      stampFloatingIsland(state, cx, cy, rx, ry, biome);
      if (Math.random() < 0.6) {
        const sideCx = cx + Math.floor(rand(-6, 7));
        const sideCy = cy + Math.floor(rand(8, 16));
        stampFloatingIsland(state, sideCx, sideCy, Math.floor(rand(4, 8)), Math.floor(rand(2, 4)), biome);
      }
      if (Math.random() < 0.72) {
        const lowerCx = cx + Math.floor(rand(-5, 6));
        const lowerCy = cy + Math.floor(rand(18, 28));
        stampFloatingIsland(state, lowerCx, lowerCy, Math.floor(rand(7, 12)), Math.floor(rand(3, 5)), biomes[Math.floor(rand(0, biomes.length))]);
        if (Math.random() < 0.4) {
          const lowerSideCx = lowerCx + Math.floor(rand(-7, 8));
          const lowerSideCy = lowerCy + Math.floor(rand(7, 13));
          stampFloatingIsland(state, lowerSideCx, lowerSideCy, Math.floor(rand(4, 7)), Math.floor(rand(2, 4)), biome);
        }
      }
      cx += rx + Math.floor(rand(12, 20));
    }
    generateCoalOre(state);
    generateIronOre(state);
    generateGoldOre(state);
    plantTrees(state, new Set());
    reinforceSurfaceLayer(state, new Set());
    state.player.x = starter.cx * TILE;
    state.player.y = (state.surfaceAt[starter.cx] - 3) * TILE;
  }

  function applyCavernBiomeBands(state, cavernBiome) {
    if (cavernBiome && cavernBiome !== 'mix') {
      state.biomeAt = Array(WORLD_W).fill(cavernBiome);
      state.climateAt = Array(WORLD_W).fill(cavernBiome === 'fire_caves' ? CLIMATE.WARM : CLIMATE.ANY);
      return;
    }
    const caveBiomes = ['cave', 'dwarf_caves', 'deep', 'fire_caves', 'water_caves'];
    let x = 0;
    while (x < WORLD_W) {
      const biome = caveBiomes[Math.floor(rand(0, caveBiomes.length))];
      const segLen = Math.floor(rand(48, 112));
      const end = Math.min(WORLD_W, x + segLen);
      for (let tx = x; tx < end; tx += 1) {
        state.biomeAt[tx] = biome;
        state.climateAt[tx] = biome === 'fire_caves' ? CLIMATE.WARM : CLIMATE.ANY;
      }
      x = end;
    }
  }

  function cavernHostBlockForBiome(biome, ty) {
    if (biome === 'fire_caves') return ty > WORLD_H - 20 ? BLOCK.BASALT : Math.random() < 0.22 ? BLOCK.BLACKSTONE : BLOCK.BASALT;
    if (biome === 'water_caves') return ty > WORLD_H - 18 ? BLOCK.DEEPSTONE : Math.random() < 0.22 ? BLOCK.STONE : BLOCK.DEEPSTONE;
    if (biome === 'deep') return BLOCK.DEEPSTONE;
    if (biome === 'dwarf_caves') return Math.random() < 0.25 ? BLOCK.BLACKSTONE : BLOCK.STONE;
    return BLOCK.STONE;
  }

  function generateCavernWorld(state, cavernBiome) {
    state.surfaceAt = Array(WORLD_W).fill(5);
    applyCavernBiomeBands(state, cavernBiome);
    for (let tx = 0; tx < WORLD_W; tx += 1) {
      for (let ty = 0; ty < WORLD_H - 1; ty += 1) {
        setBlock(state, tx, ty, cavernHostBlockForBiome(state.biomeAt[tx], ty));
      }
    }
    for (let tx = 0; tx < WORLD_W; tx += 1) setBlock(state, tx, WORLD_H - 1, BLOCK.BEDROCK);

    for (let i = 0; i < 36; i += 1) {
      const sx = rand(8, WORLD_W - 9);
      const sy = rand(10, WORLD_H - 16);
      carveTunnel(state, sx, sy, Math.floor(rand(36, 92)), Math.floor(rand(3, 5)), 8, WORLD_H - 12);
    }
    for (let i = 0; i < 16; i += 1) {
      carveCircle(state, rand(8, WORLD_W - 9), rand(12, WORLD_H - 16), Math.floor(rand(4, 8)));
    }

    const spawnX = Math.floor(WORLD_W * 0.2);
    const spawnY = 18;
    carveRect(state, spawnX - 6, spawnY - 3, spawnX + 6, spawnY + 4, BLOCK.AIR);
    setBlock(state, spawnX - 3, spawnY + 4, BLOCK.STONE);
    setBlock(state, spawnX - 2, spawnY + 4, BLOCK.STONE);
    setBlock(state, spawnX - 1, spawnY + 4, BLOCK.STONE);
    setBlock(state, spawnX, spawnY + 4, BLOCK.STONE);
    setBlock(state, spawnX + 1, spawnY + 4, BLOCK.STONE);
    setBlock(state, spawnX + 2, spawnY + 4, BLOCK.STONE);
    setBlock(state, spawnX + 3, spawnY + 4, BLOCK.STONE);

    for (let tx = 2; tx < WORLD_W - 2; tx += 1) {
      if (state.biomeAt[tx] !== 'fire_caves') continue;
      for (let ty = WORLD_H - 24; ty < WORLD_H - 2; ty += 1) {
        if (Math.random() < 0.18 && getBlock(state, tx, ty) === BLOCK.AIR) setBlock(state, tx, ty, BLOCK.LAVA);
      }
    }

    const allowMix = cavernBiome === 'mix';
    if (allowMix || cavernBiome === 'cave') {
      carveUpperCaves(state);
      generateMineshafts(state);
    }

    if (allowMix || cavernBiome === 'dwarf_caves') {
      generateDwarfCaverns(state);
      generateFalseDwarfSeals(state, Math.floor(rand(2, 5)));
    }

    if (allowMix || cavernBiome === 'deep' || cavernBiome === 'fire_caves') {
      generateDeepZones(state, []);
    }

    if (allowMix || cavernBiome === 'fire_caves') {
      generateFireCaves(state);
    }

    if (allowMix || cavernBiome === 'water_caves') {
      generateWaterCaves(state);
    }
    if (allowMix || cavernBiome === 'air_caves') {
      generateAirCaves(state);
    }

    generateCoalOre(state);
    generateIronOre(state);
    generateGoldOre(state);
    generateDeepOre(state);
    state.player.x = spawnX * TILE;
    state.player.y = spawnY * TILE;
  }

  function chooseSpawnColumn(state, blockedColumns) {
    const singleBiome = state.worldMeta && state.worldMeta.worldType === 'single_biome' ? state.worldMeta.singleBiome : null;
    const worldType = state.worldMeta && state.worldMeta.worldType ? state.worldMeta.worldType : 'normal';
    if (worldType === 'floating_islands') {
      for (let tx = 8; tx < WORLD_W - 8; tx += 1) {
        const s = state.surfaceAt[tx];
        if (!Number.isFinite(s) || s >= WORLD_H - 6) continue;
        const surfaceBlock = getBlock(state, tx, s);
        if (surfaceBlock !== BLOCK.GRASS && surfaceBlock !== BLOCK.SNOW && surfaceBlock !== BLOCK.SAND) continue;
        if (getBlock(state, tx, s - 1) !== BLOCK.AIR) continue;
        return tx;
      }
    }
    for (let tx = 20; tx < WORLD_W - 5; tx += 1) {
      const biome = state.biomeAt[tx];
      if (blockedColumns.has(tx)) continue;
      if (biome === 'mountains' && singleBiome !== 'mountains') continue;
      if (biome === 'volcano' && singleBiome !== 'volcano') continue;
      if ((state.humanSettlements.villages || []).some((village) => tx >= village.bounds.x0 && tx <= village.bounds.x1)) continue;
      if (state.firePyramid && state.firePyramid.bounds && tx >= state.firePyramid.bounds.x0 && tx <= state.firePyramid.bounds.x1) continue;
      const surfaceBlock = getBlock(state, tx, state.surfaceAt[tx]);
      if (surfaceBlock !== BLOCK.GRASS && surfaceBlock !== BLOCK.SAND && surfaceBlock !== BLOCK.SNOW && surfaceBlock !== BLOCK.BLACKSTONE && surfaceBlock !== BLOCK.STONE) continue;
      if (Math.abs(state.surfaceAt[tx] - state.surfaceAt[tx - 1]) > 1) continue;
      if (Math.abs(state.surfaceAt[tx] - state.surfaceAt[tx + 1]) > 1) continue;
      return tx;
    }
    return 20;
  }

  function generateWorld(state) {
    const worldType = state.worldMeta && state.worldMeta.worldType ? state.worldMeta.worldType : 'normal';
    const singleBiome = state.worldMeta && state.worldMeta.singleBiome ? state.worldMeta.singleBiome : 'forest';
    const cavernBiome = state.worldMeta && state.worldMeta.cavernBiome ? state.worldMeta.cavernBiome : 'mix';
    const basins = [];
    const surfaceFluidColumns = new Set();
    state.spiders.length = 0;
    state.humans.length = 0;
    state.dwarves.length = 0;
    state.doors = {};
    state.fireCaves = { region: null, shrine: null };
    state.firePyramid = null;
    state.fireBoss = null;
    state.waterWell = null;
    state.waterCaves = null;
    state.airCaves = null;
    state.airGuardian = null;
    state.kraken = null;
    state.quake = null;
    ensureClimateAt(state);
    state.humanSettlements = { villages: [], nodes: [], edges: [] };
    state.dwarfColony = {
      homes: [],
      stockpiles: [],
      halls: [],
      shafts: [],
      worksites: [],
      nodes: [],
      edges: [],
      settlements: [],
    };

    if (worldType === 'flat') {
      generateFlatWorld(state);
      return;
    }

    if (worldType === 'single_biome') {
      generateSingleBiomeWorld(state, singleBiome);
      return;
    }

    if (worldType === 'floating_islands') {
      generateFloatingIslandsWorld(state);
      return;
    }

    if (worldType === 'cavern') {
      generateCavernWorld(state, cavernBiome);
      return;
    }

    generateBiomeBands(state);
    ensureDesertSegment(state);
    ensureVolcanoSegment(state);
    smoothSurface(state, 1);
    flattenPlains(state);
    addPlainMicroRelief(state);

    const volcanoSegments = [];
    let x = 0;
    while (x < WORLD_W) {
      if (state.biomeAt[x] !== 'volcano') {
        x += 1;
        continue;
      }
      const start = x;
      while (x < WORLD_W && state.biomeAt[x] === 'volcano') x += 1;
      const end = x - 1;
      volcanoSegments.push({ start, end, center: Math.floor((start + end) / 2) });
    }
    shapeVolcanoes(state, volcanoSegments);

    const waterBasinCount = Math.floor(rand(10, 16));
    const lavaBasinCount = Math.floor(rand(3, 6));
    for (let i = 0; i < waterBasinCount; i += 1) {
      const basin = carveSurfaceBasin(state, { type: 'water', minX: 16, maxX: WORLD_W - 17, minRadius: 6, maxRadius: 11, minDepth: 3, maxDepth: 6 });
      if (basin && basin.stable) basins.push(basin);
    }
    for (let i = 0; i < lavaBasinCount; i += 1) {
      const basin = carveSurfaceBasin(state, { type: 'lava', minX: 22, maxX: WORLD_W - 23, minRadius: 4, maxRadius: 7, minDepth: 2, maxDepth: 4 });
      if (basin && basin.stable) basins.push(basin);
    }
    if (basins.filter((b) => b.type === 'water').length < 2) {
      const fallback = carveFallbackBasin(state, 'water');
      if (fallback) basins.push(fallback);
    }
    if (basins.filter((b) => b.type === 'lava').length < 1) {
      const fallback = carveFallbackBasin(state, 'lava');
      if (fallback) basins.push(fallback);
    }
    for (const basin of basins) {
      for (const tx of basin.filledColumns) surfaceFluidColumns.add(tx);
    }

    fillTerrain(state);
    carveUpperCaves(state);
    generateMineshafts(state);
    generateMineEntranceShafts(state, surfaceFluidColumns);
    const dwarfSettlements = generateDwarfCaverns(state);
    generateDwarfEntrances(state, dwarfSettlements);
    generateFalseDwarfSeals(state, Math.floor(rand(2, 5)));
    generateDeepZones(state, volcanoSegments);
    generateFireCaves(state);
    generateWaterCaves(state);
    generateAirCaves(state);
    for (const segment of volcanoSegments) carveVolcanoCore(state, segment);
    generateCoalOre(state);
    generateIronOre(state);
    generateGoldOre(state);
    generateDeepOre(state);
    for (const basin of basins) fillSurfaceBasin(state, basin);
    reinforceSurfaceLayer(state, surfaceFluidColumns);
    plantTrees(state, surfaceFluidColumns);
    removeFloatingDebris(state);
    reinforceSurfaceLayer(state, surfaceFluidColumns);
    carveCaveEntrances(state, surfaceFluidColumns, Math.floor(rand(6, 10)));
    generateVillages(state);
    generateWaterWell(state);
    generateFirePyramid(state);
    plantDesertFlora(state, surfaceFluidColumns);

    for (let tx = 0; tx < WORLD_W; tx += 1) setBlock(state, tx, WORLD_H - 1, BLOCK.BEDROCK);

    const spawnX = chooseSpawnColumn(state, surfaceFluidColumns);
    state.player.x = spawnX * TILE;
    state.player.y = (state.surfaceAt[spawnX] - 3) * TILE;
  }

  function carveFireArrivalChamber(state, centerX, portalY) {
    for (let tx = centerX - 10; tx <= centerX + 10; tx += 1) {
      if (tx < 0 || tx >= WORLD_W) continue;
      state.biomeAt[tx] = 'red_land';
    }
    for (let tx = centerX - 8; tx <= centerX + 8; tx += 1) {
      for (let ty = portalY - 7; ty <= portalY + 5; ty += 1) {
        if (tx <= 1 || tx >= WORLD_W - 2 || ty <= 1 || ty >= WORLD_H - 2) continue;
        const shell = tx === centerX - 8 || tx === centerX + 8 || ty === portalY - 7 || ty === portalY + 5;
        setBlock(state, tx, ty, shell ? BLOCK.BASALT : BLOCK.AIR);
      }
      setBlock(state, tx, portalY + 6, BLOCK.BASALT);
      if (tx >= centerX - 3 && tx <= centerX + 3) setBlock(state, tx, portalY + 4, BLOCK.BLACKSTONE);
    }
    setBlock(state, centerX, portalY, BLOCK.FIRE_PORTAL);
    setBlock(state, centerX - 4, portalY + 3, BLOCK.TORCH);
    setBlock(state, centerX + 4, portalY + 3, BLOCK.TORCH);
  }

  function spawnFireGuard(state, tx, walkFloor, dir = 1, role = 'guard') {
    state.fireGuards.push({
      x: tx * TILE + 1,
      y: (walkFloor - 2) * TILE,
      w: 14,
      h: 24,
      vx: 0,
      vy: 0,
      onGround: false,
      hp: 50,
      maxHp: 50,
      dir,
      attackCd: 0,
      jumpCd: 0,
      obstacleTimer: 0,
      patrolTimer: rand(1.2, 3.6),
      role,
      breakTimer: 0,
      miningSwing: 0,
    });
  }

  function carveFireCastleRoad(state, x0, x1, roadY) {
    for (let tx = x0; tx <= x1; tx += 1) {
      for (let ty = roadY - 1; ty <= roadY; ty += 1) setBlock(state, tx, ty, BLOCK.BLACKSTONE);
      if (tx % 8 === 0) {
        setBlock(state, tx, roadY - 2, BLOCK.PILLAR);
        setBlock(state, tx, roadY - 3, BLOCK.TORCH);
      }
      for (let ty = roadY - 8; ty < roadY - 1; ty += 1) {
        if (ty > 2) setBlock(state, tx, ty, BLOCK.AIR);
      }
    }
  }

  function buildFireKingCastle(state, centerX, roadY) {
    const width = 45;
    const x0 = centerX - Math.floor(width / 2);
    const x1 = x0 + width - 1;
    const baseY = roadY;
    const leftTowerX1 = x0 + 7;
    const rightTowerX0 = x1 - 7;
    const roofY = baseY - 22;
    const wallTopY = baseY - 15;

    for (let tx = x0; tx <= x1; tx += 1) {
      for (let ty = baseY - 1; ty <= baseY + 4; ty += 1) setBlock(state, tx, ty, BLOCK.BLACKSTONE);
    }

    for (let tx = x0; tx <= x1; tx += 1) {
      const tower = tx <= leftTowerX1 || tx >= rightTowerX0;
      const topY = tower ? roofY : wallTopY;
      for (let ty = topY; ty <= baseY - 2; ty += 1) {
        if (tx === x0 || tx === x1 || tx === leftTowerX1 || tx === rightTowerX0 || ty === topY || ty === baseY - 2) {
          setBlock(state, tx, ty, BLOCK.BLACKSTONE);
        } else if (tx < leftTowerX1 || tx > rightTowerX0) {
          setBlock(state, tx, ty, BLOCK.AIR);
        }
      }
    }

    for (let tx = leftTowerX1; tx <= rightTowerX0; tx += 1) {
      for (let ty = wallTopY; ty <= baseY - 2; ty += 1) {
        if (tx === leftTowerX1 || tx === rightTowerX0 || ty === wallTopY || ty === baseY - 2) {
          setBlock(state, tx, ty, BLOCK.BLACKSTONE);
        } else {
          setBlock(state, tx, ty, BLOCK.AIR);
        }
      }
    }

    for (let tx = x0; tx <= x1; tx += 2) {
      setBlock(state, tx, roofY, BLOCK.BLACKSTONE);
      setBlock(state, tx, wallTopY, BLOCK.BLACKSTONE);
    }

    for (let tx = centerX - 18; tx <= centerX + 18; tx += 1) {
      setBlock(state, tx, baseY - 2, BLOCK.BLACKSTONE);
    }
    for (let tx = centerX - 10; tx <= centerX + 10; tx += 1) {
      setBlock(state, tx, baseY - 7, BLOCK.BLACKSTONE);
      if (tx <= centerX - 7 || tx >= centerX + 7) setBlock(state, tx, baseY - 8, BLOCK.BLACKSTONE);
    }
    for (let tx = centerX - 2; tx <= centerX + 2; tx += 1) {
      setBlock(state, tx, baseY - 9, BLOCK.BLACKSTONE);
      setBlock(state, tx, baseY - 10, BLOCK.BLACKSTONE);
    }
    setBlock(state, centerX, baseY - 11, BLOCK.BLACKSTONE);
    setBlock(state, centerX - 8, baseY - 3, BLOCK.TORCH);
    setBlock(state, centerX + 8, baseY - 3, BLOCK.TORCH);
    setBlock(state, centerX - 15, baseY - 10, BLOCK.TORCH);
    setBlock(state, centerX + 15, baseY - 10, BLOCK.TORCH);
    setBlock(state, x0 + 4, baseY - 4, BLOCK.TORCH);
    setBlock(state, x1 - 4, baseY - 4, BLOCK.TORCH);
    setBlock(state, leftTowerX1 - 2, roofY + 2, BLOCK.TORCH);
    setBlock(state, rightTowerX0 + 2, roofY + 2, BLOCK.TORCH);

    for (let tx = x0 + 3; tx <= x1 - 3; tx += 1) {
      if ((tx - x0) % 6 === 0) {
        setBlock(state, tx, wallTopY + 2, BLOCK.BLACKSTONE);
        setBlock(state, tx, wallTopY + 3, BLOCK.BLACKSTONE);
      }
    }
    for (let tx = x0 + 2; tx <= x0 + 8; tx += 1) setBlock(state, tx, baseY - 9, BLOCK.BLACKSTONE);
    for (let tx = x1 - 8; tx <= x1 - 2; tx += 1) setBlock(state, tx, baseY - 9, BLOCK.BLACKSTONE);

    for (let tx = centerX - 16; tx <= centerX + 16; tx += 1) {
      for (let ty = roofY + 2; ty <= baseY - 3; ty += 1) {
        if (tx >= centerX - 12 && tx <= centerX + 12 && ty >= baseY - 12) setBlock(state, tx, ty, BLOCK.AIR);
      }
    }

    const gateY0 = baseY - 6;
    const gateY1 = baseY - 2;
    for (let tx = x0; tx <= x0 + 2; tx += 1) {
      for (let ty = gateY0; ty <= gateY1; ty += 1) setBlock(state, tx, ty, BLOCK.AIR);
    }

    return {
      x0,
      x1,
      baseY,
      throneFloorY: baseY - 12,
      throneX: centerX,
      throneY: baseY - 12,
      guardSpots: [
        { tx: x0 + 4, ty: baseY - 3 },
        { tx: x0 + 10, ty: baseY - 3 },
        { tx: centerX - 10, ty: baseY - 3 },
        { tx: centerX + 10, ty: baseY - 3 },
        { tx: x1 - 10, ty: baseY - 3 },
        { tx: x1 - 4, ty: baseY - 3 },
        { tx: leftTowerX1 - 2, ty: roofY - 1 },
        { tx: rightTowerX0 + 2, ty: roofY - 1 },
      ],
    };
  }

  function buildFireDungeon(state, centerX, baseY) {
    const width = 28;
    const x0 = centerX - Math.floor(width / 2);
    const x1 = x0 + width - 1;
    const roofY = baseY - 14;
    const cageX0 = centerX - 4;
    const cageX1 = centerX + 4;
    const cageY0 = baseY - 10;
    const cageY1 = baseY - 3;

    for (let tx = x0; tx <= x1; tx += 1) {
      for (let ty = roofY; ty <= baseY; ty += 1) setBlock(state, tx, ty, BLOCK.BLACKSTONE);
    }

    carveRect(state, x0 + 2, roofY + 2, x1 - 2, baseY - 2, BLOCK.AIR);
    for (let tx = x0; tx <= x1; tx += 2) setBlock(state, tx, roofY, BLOCK.BLACKSTONE);
    for (let tx = x0 + 2; tx <= x1 - 2; tx += 5) setBlock(state, tx, baseY - 4, BLOCK.TORCH);
    for (let tx = x0 + 3; tx <= x1 - 3; tx += 4) setBlock(state, tx, roofY + 4, BLOCK.BLACKSTONE);

    for (let ty = cageY0; ty <= cageY1; ty += 1) {
      setBlock(state, cageX0, ty, BLOCK.FIRE_SEAL);
      setBlock(state, cageX1, ty, BLOCK.FIRE_SEAL);
    }
    for (let tx = cageX0; tx <= cageX1; tx += 1) {
      setBlock(state, tx, cageY0, BLOCK.FIRE_SEAL);
      setBlock(state, tx, cageY1, BLOCK.FIRE_SEAL);
    }
    carveRect(state, cageX0 + 1, cageY0 + 1, cageX1 - 1, cageY1 - 1, BLOCK.AIR);
    setBlock(state, centerX, cageY1 - 1, BLOCK.FIRE_SEAL);

    return {
      x0,
      x1,
      y0: roofY,
      y1: baseY,
      centerX,
      centerY: Math.floor((roofY + baseY) / 2),
      cageX0,
      cageX1,
      cageY0,
      cageY1,
      sealX: centerX,
      sealY: cageY1 - 1,
    };
  }

  function carveFireDungeonAccess(state, dungeon, roadY) {
    const shaftX = dungeon.x0 + 3;
    const shaftTopY = roadY - 1;
    const shaftBottomY = dungeon.y0 + 3;
    for (let ty = shaftTopY; ty <= shaftBottomY; ty += 1) {
      setBlock(state, shaftX, ty, BLOCK.AIR);
      setBlock(state, shaftX + 1, ty, BLOCK.AIR);
      setBlock(state, shaftX - 1, ty, BLOCK.BLACKSTONE);
      setBlock(state, shaftX + 2, ty, BLOCK.BLACKSTONE);
      setBlock(state, shaftX, ty, BLOCK.LADDER);
    }
    for (let tx = shaftX; tx <= dungeon.x0 + 4; tx += 1) {
      setBlock(state, tx, shaftBottomY, BLOCK.AIR);
      setBlock(state, tx, shaftBottomY + 1, BLOCK.AIR);
      setBlock(state, tx, shaftBottomY + 2, BLOCK.BLACKSTONE);
    }
    setBlock(state, shaftX - 1, shaftTopY, BLOCK.TORCH);
    setBlock(state, dungeon.x0 + 4, shaftBottomY, BLOCK.TORCH);
    return { shaftX, shaftTopY, shaftBottomY };
  }

  function generateFireDimension(state) {
    state.world = createGrid();
    state.biomeAt = Array(WORLD_W).fill('red_land');
    state.climateAt = Array(WORLD_W).fill(CLIMATE.WARM);
    state.surfaceAt = Array(WORLD_W).fill(8);
    state.animals = [];
    state.zombies = [];
    state.spiders = [];
    state.fireGuards = [];
    state.humans = [];
    state.dwarves = [];
    state.humanSettlements = { villages: [], nodes: [], edges: [] };
    state.dwarfColony = { homes: [], stockpiles: [], halls: [], shafts: [], worksites: [], nodes: [], edges: [], settlements: [] };
    state.foods = [];
    state.chests = {};
    state.furnaces = {};
    state.doors = {};
    state.fireCaves = { region: null, shrine: null };
    state.firePyramid = null;
    state.fireBoss = null;
    state.fireKing = null;
    state.fireDungeon = null;
    state.friendlyFireKing = null;
    state.waterCaves = null;
    state.waterWell = null;
    state.kraken = null;
    state.quake = null;
    state.zombieSpawnTick = 0;
    state.zombieCaveSpawnTick = 0;
    state.spiderSpawnTick = 0;
    state.spiderCaveSpawnTick = 0;
    state.fluidTick = 0;

    const lavaLakeStart = Math.floor(WORLD_H * 0.56);
    const lavaSegments = [];
    let x = 20;
    while (x < WORLD_W - 24) {
      const warmGap = Math.floor(rand(52, 104));
      x += warmGap;
      if (x >= WORLD_W - 24) break;
      const len = Math.floor(rand(20, 42));
      lavaSegments.push({ x0: x, x1: Math.min(WORLD_W - 20, x + len) });
      x += len;
    }
    for (const segment of lavaSegments) {
      for (let tx = segment.x0; tx <= segment.x1; tx += 1) state.biomeAt[tx] = 'lava_lake';
    }

    const ceil = Array(WORLD_W).fill(8);
    const floor = Array(WORLD_W).fill(lavaLakeStart - 24);
    for (let tx = 0; tx < WORLD_W; tx += 1) {
      const ceiling = Math.round(8 + Math.sin(tx / 21) * 1.8 + Math.sin(tx / 9) * 1.1);
      let floorY = Math.round(40 + Math.sin(tx / 31) * 4 + Math.sin(tx / 14) * 2.3);
      if (state.biomeAt[tx] === 'lava_lake') floorY += 3;
      ceil[tx] = clamp(ceiling, 6, 13);
      floor[tx] = clamp(floorY, 32, lavaLakeStart - 6);
      state.surfaceAt[tx] = ceil[tx];
      for (let ty = 0; ty < WORLD_H; ty += 1) {
        if (ty === WORLD_H - 1) {
          setBlock(state, tx, ty, BLOCK.BEDROCK);
          continue;
        }
        if (ty >= lavaLakeStart) {
          setBlock(state, tx, ty, ty < WORLD_H - 1 ? BLOCK.LAVA : BLOCK.BEDROCK);
          continue;
        }
        if (ty <= ceil[tx] || ty >= floor[tx]) {
          const useRed = state.biomeAt[tx] === 'red_land' && (ty >= floor[tx] - 5 || (ty > ceil[tx] && Math.sin((tx + ty) / 8) > 0.35));
          setBlock(state, tx, ty, useRed ? BLOCK.RED_EARTH : BLOCK.BASALT);
        } else {
          setBlock(state, tx, ty, BLOCK.AIR);
        }
      }
      if (state.biomeAt[tx] === 'lava_lake') {
        const lavaTop = floor[tx] - Math.floor(rand(2, 5));
        for (let ty = lavaTop; ty < floor[tx]; ty += 1) setBlock(state, tx, ty, BLOCK.LAVA);
        for (let ty = lavaTop - 2; ty < lavaTop; ty += 1) if (getBlock(state, tx, ty) !== BLOCK.LAVA) setBlock(state, tx, ty, BLOCK.BASALT);
      }
    }

    for (let tx = 2; tx < WORLD_W - 2; tx += 1) {
      for (let ty = ceil[tx] + 1; ty < floor[tx] - 1; ty += 1) {
        const noise = Math.sin(tx / 19) + Math.sin(ty / 11) + Math.sin((tx + ty) / 17);
        if (state.biomeAt[tx] === 'red_land' && noise > 1.85 && ty > lavaLakeStart - 24) setBlock(state, tx, ty, BLOCK.RED_EARTH);
        if (state.biomeAt[tx] === 'lava_lake' && noise > 1.65 && ty < floor[tx] - 6) setBlock(state, tx, ty, BLOCK.BASALT);
      }
    }

    const portalX = Math.floor(WORLD_W / 2);
    const portalY = Math.floor((ceil[portalX] + floor[portalX]) / 2);
    carveFireArrivalChamber(state, portalX, portalY);
    for (let tx = portalX - 18; tx <= portalX + 18; tx += 1) {
      if (tx < 2 || tx >= WORLD_W - 2) continue;
      for (let ty = portalY - 6; ty <= portalY + 4; ty += 1) {
        if (ty > 1 && ty < lavaLakeStart - 1 && getBlock(state, tx, ty) !== BLOCK.LAVA) setBlock(state, tx, ty, BLOCK.AIR);
      }
      if (getBlock(state, tx, portalY + 5) === BLOCK.AIR) setBlock(state, tx, portalY + 5, BLOCK.BASALT);
    }

    const castleCenterX = WORLD_W - 72;
    const roadY = Math.min(lavaLakeStart - 10, Math.max(portalY + 9, floor[Math.min(WORLD_W - 1, castleCenterX)] - 2));
    carveFireCastleRoad(state, portalX + 12, castleCenterX - 23, roadY);
    const castle = buildFireKingCastle(state, castleCenterX, roadY);
    const dungeonCenterX = Math.max(52, portalX - 132);
    const dungeonBaseY = Math.min(lavaLakeStart - 10, Math.max(roadY + 18, floor[dungeonCenterX] + 10));
    const fireDungeon = buildFireDungeon(state, dungeonCenterX, dungeonBaseY);
    const dungeonAccess = carveFireDungeonAccess(state, fireDungeon, roadY);

    for (const spot of castle.guardSpots) {
      spawnFireGuard(state, spot.tx, spot.ty, spot.tx < castleCenterX ? 1 : -1);
    }
    for (let tx = portalX + 24; tx < castle.x0 - 4; tx += 18) {
      const role = tx < portalX + 80 ? 'destroyer' : 'guard';
      spawnFireGuard(state, tx, roadY - 1, Math.random() < 0.5 ? -1 : 1, role);
    }

    let guardsPlaced = 0;
    for (let attempt = 0; attempt < 120 && guardsPlaced < 7; attempt += 1) {
      const tx = Math.floor(rand(12, WORLD_W - 12));
      const walkFloor = floor[tx] - 1;
      if (state.biomeAt[tx] !== 'red_land') continue;
      if (Math.abs(tx - portalX) < 26) continue;
      if (tx >= castle.x0 - 8 && tx <= castle.x1 + 8) continue;
      if (walkFloor >= lavaLakeStart - 1 || walkFloor <= ceil[tx] + 3) continue;
      if (getBlock(state, tx, walkFloor - 1) !== BLOCK.AIR) continue;
      if (getBlock(state, tx, walkFloor) === BLOCK.LAVA || getBlock(state, tx, walkFloor + 1) === BLOCK.LAVA) continue;
      spawnFireGuard(state, tx, walkFloor, Math.random() < 0.5 ? -1 : 1);
      guardsPlaced += 1;
    }

    state.fireWorldMeta = {
      portalX,
      portalY,
      lavaLakeStart,
      castle,
      fireDungeon: { ...fireDungeon, access: dungeonAccess },
      road: { x0: portalX + 12, x1: castleCenterX - 23, y: roadY },
      name: 'Огненный мир',
    };
    state.fireDungeon = {
      ...fireDungeon,
      access: dungeonAccess,
      released: false,
      giftGiven: false,
    };
    state.friendlyFireKing = {
      x: fireDungeon.centerX * TILE - 16,
      y: (fireDungeon.sealY - 5) * TILE,
      w: 32,
      h: 56,
      freed: false,
      state: 'sealed',
      stateTimer: 0,
      name: 'Добрый огненный король',
    };
    state.fireKing = {
      x: castle.throneX * TILE - 40,
      y: (castle.baseY - 10) * TILE,
      w: 5 * TILE,
      h: 10 * TILE,
      vx: 0,
      vy: 0,
      onGround: false,
      hp: 100,
      maxHp: 100,
      attackCd: 0,
      phaseTimer: 0,
      phase: 'idle',
      dir: -1,
      awakened: false,
      summonStage: 0,
      castleCenterX: castle.throneX,
      castleBaseY: castle.baseY,
      isBoss: true,
      name: 'Огненный король',
    };
    state.player.x = portalX * TILE;
    state.player.y = (portalY - 2) * TILE;
  }

  function generateFireDimensionBundle(worldMeta, seed) {
    const temp = createGameState(worldMeta);
    withSeed(`${seed || ''}:fire`, () => generateFireDimension(temp));
    return captureDimensionState(temp);
  }

  function buildWaterHouse(state, centerX, baseY, width = 10, height = 6) {
    const x0 = centerX - Math.floor(width / 2);
    const x1 = x0 + width - 1;
    const y0 = baseY - height + 1;
    const y1 = baseY;
    for (let tx = x0; tx <= x1; tx += 1) {
      for (let ty = y0; ty <= y1; ty += 1) {
        const border = tx === x0 || tx === x1 || ty === y0 || ty === y1;
        setBlock(state, tx, ty, border ? BLOCK.WATER_WELL_FRAME : BLOCK.WATER);
      }
    }
    const doorX = centerX;
    for (let ty = y1 - 2; ty <= y1 - 1; ty += 1) setBlock(state, doorX, ty, BLOCK.WATER);
    for (let tx = x0 + 2; tx <= x1 - 2; tx += 3) {
      if (tx === doorX) continue;
      setBlock(state, tx, y0, BLOCK.WATER);
    }
    const bedX = x0 + 2;
    const bedY = y1 - 1;
    setBlock(state, bedX, bedY, BLOCK.PILLOW);
    return { x0, x1, y0, y1, centerX, baseY, bedX, bedY };
  }

  function buildWaterRoad(state, x0, x1, y) {
    for (let tx = x0; tx <= x1; tx += 1) {
      setBlock(state, tx, y, BLOCK.WATER_WELL_FRAME);
      if (tx % 7 === 0) {
        setBlock(state, tx, y - 1, BLOCK.WATER_WELL_FRAME);
      } else {
        setBlock(state, tx, y - 1, BLOCK.WATER);
      }
    }
  }

  function buildWaterTower(state, centerX, baseY, height = 18) {
    const x0 = centerX - 2;
    const x1 = centerX + 2;
    const topY = baseY - height;
    for (let tx = x0; tx <= x1; tx += 1) {
      for (let ty = topY; ty <= baseY; ty += 1) {
        const border = tx === x0 || tx === x1 || ty === topY || ty === baseY;
        setBlock(state, tx, ty, border ? BLOCK.WATER_WELL_FRAME : BLOCK.WATER);
      }
    }
    for (let ty = baseY - 1; ty >= topY + 1; ty -= 1) {
      setBlock(state, centerX, ty, BLOCK.LADDER);
    }
    for (let tx = x0 - 1; tx <= x1 + 1; tx += 1) {
      if (tx === x0 - 1 || tx === x1 + 1 || tx === centerX) setBlock(state, tx, topY - 1, BLOCK.WATER_WELL_FRAME);
    }
    return { x0, x1, topY, baseY, centerX };
  }

  function buildWaterCastle(state, centerX, baseY) {
    const width = 58;
    const x0 = centerX - Math.floor(width / 2);
    const x1 = x0 + width - 1;
    const floorY = baseY;
    const topY = baseY - 18;
    const hallY = baseY - 9;
    const throneY = baseY - 4;
    const rooms = [];

    for (let tx = x0; tx <= x1; tx += 1) {
      for (let ty = topY; ty <= floorY; ty += 1) {
        const border = tx === x0 || tx === x1 || ty === topY || ty === floorY;
        setBlock(state, tx, ty, border ? BLOCK.WATER_WELL_FRAME : BLOCK.WATER);
      }
    }

    for (let tx = x0 + 6; tx <= x1 - 6; tx += 1) {
      setBlock(state, tx, hallY, BLOCK.WATER_WELL_FRAME);
    }
    for (let tx = x0 + 20; tx <= x1 - 20; tx += 1) {
      setBlock(state, tx, topY + 5, BLOCK.WATER_WELL_FRAME);
    }

    for (let ty = topY + 2; ty <= floorY - 1; ty += 1) {
      setBlock(state, x0 + 14, ty, BLOCK.WATER_WELL_FRAME);
      setBlock(state, x1 - 14, ty, BLOCK.WATER_WELL_FRAME);
    }
    for (let ty = hallY - 2; ty <= hallY + 1; ty += 1) {
      setBlock(state, x0 + 14, ty, BLOCK.WATER);
      setBlock(state, x1 - 14, ty, BLOCK.WATER);
    }
    for (let ty = floorY - 4; ty <= floorY - 1; ty += 1) {
      setBlock(state, x0 + 14, ty, BLOCK.WATER);
      setBlock(state, x1 - 14, ty, BLOCK.WATER);
    }

    for (let tx = centerX - 4; tx <= centerX + 4; tx += 1) {
      for (let ty = floorY - 5; ty <= floorY - 1; ty += 1) setBlock(state, tx, ty, BLOCK.WATER);
    }
    for (let ty = floorY - 5; ty <= floorY - 1; ty += 1) {
      setBlock(state, x0, ty, BLOCK.WATER);
      setBlock(state, x1, ty, BLOCK.WATER);
    }
    for (let ty = floorY - 4; ty <= floorY - 2; ty += 1) {
      setBlock(state, x0 + 1, ty, BLOCK.WATER);
      setBlock(state, x1 - 1, ty, BLOCK.WATER);
    }

    for (let tx = centerX - 5; tx <= centerX + 5; tx += 1) {
      setBlock(state, tx, throneY + 2, BLOCK.WATER_WELL_FRAME);
    }
    for (let tx = centerX - 3; tx <= centerX + 3; tx += 1) {
      setBlock(state, tx, throneY + 1, BLOCK.WATER_WELL_FRAME);
    }
    for (let tx = centerX - 1; tx <= centerX + 1; tx += 1) {
      setBlock(state, tx, throneY, BLOCK.WATER_WELL_FRAME);
    }
    setBlock(state, centerX, throneY - 1, BLOCK.WATER_WELL_FRAME);

    const towers = [
      buildWaterTower(state, x0 + 5, floorY, 20),
      buildWaterTower(state, x1 - 5, floorY, 20),
      buildWaterTower(state, x0 + 18, hallY, 14),
      buildWaterTower(state, x1 - 18, hallY, 14),
    ];

    rooms.push({ x0: x0 + 2, x1: x0 + 13, y0: hallY + 1, y1: floorY - 1 });
    rooms.push({ x0: x1 - 13, x1: x1 - 2, y0: hallY + 1, y1: floorY - 1 });
    rooms.push({ x0: x0 + 16, x1: centerX - 8, y0: topY + 1, y1: hallY - 1 });
    rooms.push({ x0: centerX + 8, x1: x1 - 16, y0: topY + 1, y1: hallY - 1 });
    rooms.push({ x0: centerX - 7, x1: centerX + 7, y0: topY + 1, y1: floorY - 1, throne: true });

    for (let tx = x0 + 2; tx <= x1 - 2; tx += 4) {
      if (Math.abs(tx - centerX) <= 2) continue;
      setBlock(state, tx, topY, BLOCK.WATER);
      setBlock(state, tx, topY + 1, BLOCK.WATER);
    }

    return { x0, x1, baseY, centerX, throneX: centerX, topY, roadX: x0 + 1, towers, rooms, throneY };
  }

  function buildWaterArrivalDome(state, centerX, centerY) {
    const rx = 8;
    const ry = 5;
    const x0 = centerX - rx;
    const x1 = centerX + rx;
    const y0 = centerY - ry;
    const y1 = centerY + ry;
    for (let ty = y0; ty <= y1; ty += 1) {
      for (let tx = x0; tx <= x1; tx += 1) {
        if (tx < 2 || tx >= WORLD_W - 2 || ty < 2 || ty >= WORLD_H - 2) continue;
        const dx = (tx - centerX) / rx;
        const dy = (ty - centerY) / ry;
        const dist = dx * dx + dy * dy;
        if (dist > 1.08) continue;
        if (dist > 0.74) setBlock(state, tx, ty, BLOCK.WATER_WELL_FRAME);
        else setBlock(state, tx, ty, BLOCK.AIR);
      }
    }
    setBlock(state, centerX, centerY + 3, BLOCK.WATER_DIMENSION_PORTAL);
    return { cx: centerX, cy: centerY, rx, ry, x0, x1, y0, y1, active: true };
  }

  function plantGoldenFlower(state, tx, ty) {
    if (tx < 2 || tx >= WORLD_W - 2 || ty < 2 || ty >= WORLD_H - 2) return;
    setBlock(state, tx, ty, BLOCK.GOLDEN_FLOWER);
  }

  function buildGoldenGarden(state, centerX, floorStart) {
    const width = 42;
    const x0 = centerX - Math.floor(width / 2);
    const x1 = x0 + width - 1;
    const y0 = 2;
    const groundY = floorStart - 7;
    const y1 = groundY + 5;

    for (let tx = x0; tx <= x1; tx += 1) {
      for (let ty = y0; ty <= y1; ty += 1) {
        const border = tx === x0 || tx === x1 || ty === y0 || ty === y1;
        if (border) setBlock(state, tx, ty, BLOCK.GOLDEN_GARDEN_SHELL);
        else if (ty < groundY) setBlock(state, tx, ty, BLOCK.AIR);
        else if (ty === groundY) setBlock(state, tx, ty, BLOCK.GRASS);
        else if (ty <= groundY + 2) setBlock(state, tx, ty, BLOCK.DIRT);
        else setBlock(state, tx, ty, BLOCK.STONE);
      }
    }

    for (let tx = x0 + 4; tx <= x1 - 4; tx += 6) plantGoldenFlower(state, tx, groundY - 1);
    for (let tx = x0 + 7; tx <= x1 - 7; tx += 8) plantGoldenFlower(state, tx, groundY - 1);

    for (let tx = centerX - 2; tx <= centerX + 1; tx += 1) {
      setBlock(state, tx, groundY, BLOCK.WATER);
      setBlock(state, tx, groundY + 1, BLOCK.DIRT);
    }

    return {
      x0,
      x1,
      y0,
      y1,
      centerX,
      groundY,
      flowerTaken: false,
      guardianSpawned: false,
      guardianDefeated: false,
    };
  }

  function stampMainWell(state, centerX, floorY) {
    const frame = BLOCK.MAIN_WELL_FRAME;
    const x0 = centerX - 9;
    const x1 = centerX + 9;
    const y0 = floorY - 9;
    const y1 = floorY + 1;

    for (let tx = x0; tx <= x1; tx += 1) {
      for (let ty = y0; ty <= y1; ty += 1) {
        if (ty >= floorY) setBlock(state, tx, ty, BLOCK.STONE);
        else setBlock(state, tx, ty, BLOCK.WATER);
      }
    }

    for (let tx = x0; tx <= x1; tx += 1) {
      setBlock(state, tx, floorY, frame);
    }

    for (let ty = floorY - 6; ty <= floorY; ty += 1) {
      setBlock(state, x0, ty, frame);
      setBlock(state, x1, ty, frame);
    }

    for (let tx = centerX - 4; tx <= centerX + 4; tx += 1) {
      setBlock(state, tx, y0 + 2, frame);
    }
    for (let ty = y0 + 2; ty <= floorY - 3; ty += 1) {
      setBlock(state, centerX - 4, ty, frame);
      setBlock(state, centerX + 4, ty, frame);
    }

    for (let tx = centerX - 2; tx <= centerX + 2; tx += 1) {
      setBlock(state, tx, floorY - 1, BLOCK.WATER);
      setBlock(state, tx, floorY - 2, BLOCK.WATER);
      setBlock(state, tx, floorY - 3, BLOCK.WATER);
      setBlock(state, tx, floorY - 4, BLOCK.WATER);
    }

    for (let tx = centerX - 3; tx <= centerX + 3; tx += 1) {
      setBlock(state, tx, floorY - 5, frame);
    }
    for (let ty = floorY - 4; ty <= floorY - 1; ty += 1) {
      setBlock(state, centerX - 3, ty, frame);
      setBlock(state, centerX + 3, ty, frame);
    }

    for (let ty = floorY - 3; ty <= floorY - 1; ty += 1) {
      setBlock(state, x0, ty, BLOCK.WATER);
      setBlock(state, x0 + 1, ty, BLOCK.WATER);
      setBlock(state, x1, ty, BLOCK.WATER);
      setBlock(state, x1 - 1, ty, BLOCK.WATER);
    }
  }

  function generateWaterDimension(state) {
    state.world = createGrid();
    state.biomeAt = Array(WORLD_W).fill('water_surface');
    state.climateAt = Array(WORLD_W).fill(CLIMATE.ANY);
    state.surfaceAt = Array(WORLD_W).fill(6);
    state.animals = [];
    state.zombies = [];
    state.spiders = [];
    state.fireGuards = [];
    state.waterfolk = [];
    state.humans = [];
    state.dwarves = [];
    state.humanSettlements = { villages: [], nodes: [], edges: [] };
    state.dwarfColony = { homes: [], stockpiles: [], halls: [], shafts: [], worksites: [], nodes: [], edges: [], settlements: [] };
    state.foods = [];
    state.chests = {};
    state.furnaces = {};
    state.doors = {};
    state.fireCaves = { region: null, shrine: null };
    state.firePyramid = null;
    state.fireBoss = null;
    state.fireKing = null;
    state.fireDungeon = null;
    state.friendlyFireKing = null;
    state.waterCaves = null;
    state.airCaves = null;
    state.waterWell = null;
    state.goldenFlowerGuardian = null;
    state.airGuardian = null;
    state.kraken = null;
    state.quake = null;
    state.fireWorldMeta = null;
    state.waterWorldMeta = null;
    state.zombieSpawnTick = 0;
    state.zombieCaveSpawnTick = 0;
    state.spiderSpawnTick = 0;
    state.spiderCaveSpawnTick = 0;
    state.fluidTick = 0;

    const floorStart = Math.floor(WORLD_H * 0.52);
    for (let tx = 0; tx < WORLD_W; tx += 1) {
      state.surfaceAt[tx] = 5;
      for (let ty = 0; ty < WORLD_H; ty += 1) {
        if (ty === WORLD_H - 1) {
          setBlock(state, tx, ty, BLOCK.BEDROCK);
        } else if (ty >= floorStart) {
          state.biomeAt[tx] = 'water_surface';
          setBlock(state, tx, ty, ty < floorStart + 3 ? BLOCK.SAND : BLOCK.STONE);
        } else {
          setBlock(state, tx, ty, BLOCK.WATER);
        }
      }
    }

    const portalX = Math.floor(WORLD_W / 2);
    const portalY = 18;
    const arrivalDome = buildWaterArrivalDome(state, portalX, portalY);
    const goldenGarden = buildGoldenGarden(state, 56, floorStart);
    const castle = buildWaterCastle(state, WORLD_W - 74, floorStart - 1);
    const mainWellCenterX = Math.round((goldenGarden.centerX + castle.centerX) / 2);
    const mainWell = {
      centerX: mainWellCenterX,
      baseY: floorStart - 1,
      waterX0: mainWellCenterX - 2,
      waterX1: mainWellCenterX + 2,
      waterY0: floorStart - 4,
      waterY1: floorStart - 1,
      revealed: false,
      completed: false,
    };
    const roadStartX = portalX + 14;
    const roadEndX = castle.x0 + 2;
    buildWaterRoad(state, roadStartX, roadEndX, floorStart - 1);
    const houses = [
      buildWaterHouse(state, roadStartX + 18, floorStart - 1, 10, 6),
      buildWaterHouse(state, roadStartX + 38, floorStart - 2, 12, 7),
      buildWaterHouse(state, roadStartX + 60, floorStart - 1, 10, 6),
      buildWaterHouse(state, roadStartX + 82, floorStart - 2, 12, 7),
      buildWaterHouse(state, roadStartX + 104, floorStart - 1, 10, 6),
      buildWaterHouse(state, castle.x0 - 18, floorStart - 2, 12, 7),
      buildWaterHouse(state, castle.x0 - 34, floorStart - 1, 10, 6),
    ];

    for (const house of houses) {
      state.waterfolk.push({
        x: house.centerX * TILE - 7,
        y: (house.y0 + 2) * TILE,
        w: 14,
        h: 20,
        dir: Math.random() < 0.5 ? -1 : 1,
        dirTimer: 1.5 + Math.random() * 2,
        timer: Math.random() * Math.PI * 2,
        anchorPhase: Math.random() * Math.PI * 2,
        anchorX: house.centerX * TILE - 7,
        anchorY: (house.y0 + 2) * TILE,
        chief: false,
        sleeping: false,
        sleepBlockX: house.bedX * TILE,
        sleepBlockY: house.bedY * TILE,
      });
      state.waterfolk.push({
        x: (house.centerX + 2) * TILE - 7,
        y: (house.y0 + 3) * TILE,
        w: 14,
        h: 20,
        dir: Math.random() < 0.5 ? -1 : 1,
        dirTimer: 1.5 + Math.random() * 2,
        timer: Math.random() * Math.PI * 2,
        anchorPhase: Math.random() * Math.PI * 2,
        anchorX: (house.centerX + 2) * TILE - 7,
        anchorY: (house.y0 + 3) * TILE,
        chief: false,
        sleeping: false,
        sleepBlockX: house.bedX * TILE,
        sleepBlockY: house.bedY * TILE,
      });
    }

    const castleSubjects = [
      [castle.centerX - 10, castle.baseY - 4],
      [castle.centerX + 10, castle.baseY - 4],
      [castle.centerX - 16, castle.baseY - 10],
      [castle.centerX + 16, castle.baseY - 10],
      [castle.centerX - 22, castle.baseY - 3],
      [castle.centerX + 22, castle.baseY - 3],
      [castle.centerX - 5, castle.topY + 7],
      [castle.centerX + 5, castle.topY + 7],
    ];
    for (const [tx, ty] of castleSubjects) {
      state.waterfolk.push({
        x: tx * TILE - 7,
        y: ty * TILE,
        w: 14,
        h: 20,
        dir: Math.random() < 0.5 ? -1 : 1,
        dirTimer: 1.5 + Math.random() * 2,
        timer: Math.random() * Math.PI * 2,
        anchorPhase: Math.random() * Math.PI * 2,
        anchorX: tx * TILE - 7,
        anchorY: ty * TILE,
        chief: false,
        sleeping: false,
        sleepBlockX: null,
        sleepBlockY: null,
      });
    }
    state.waterfolk.push({
      x: castle.centerX * TILE - 7,
      y: (castle.throneY - 2) * TILE,
      w: 14,
      h: 20,
      dir: -1,
      dirTimer: 2.2,
      timer: 0,
      anchorPhase: 0.7,
      anchorX: castle.centerX * TILE - 7,
      anchorY: (castle.throneY - 2) * TILE,
      chief: true,
      sleeping: false,
      sleepBlockX: null,
      sleepBlockY: null,
    });

    state.waterWorldMeta = {
      name: 'Водное измерение',
      portalX,
      portalY: portalY + 3,
      floorStart,
      arrivalDome,
      domeReleased: false,
      questGiven: false,
      medicinePromptShown: false,
      medicineDelivered: false,
      mainWellMapGiven: false,
      returnAfterWellShown: false,
      steamAmuletGiven: false,
      goldenGarden,
      mainWell,
      castle,
      houses,
      road: { x0: roadStartX, x1: roadEndX, y: floorStart - 1 },
    };
    state.player.x = portalX * TILE;
    state.player.y = (portalY + 1) * TILE;
  }

  function generateWaterDimensionBundle(worldMeta, seed) {
    const temp = createGameState(worldMeta);
    withSeed(`${seed || ''}:water`, () => generateWaterDimension(temp));
    return captureDimensionState(temp);
  }

  function carveCloudIsland(state, centerX, centerY, rx, ry, thickness = 4) {
    const x0 = centerX - rx - 2;
    const x1 = centerX + rx + 2;
    const y0 = centerY - ry - 2;
    const y1 = centerY + ry + thickness + 2;
    for (let ty = y0; ty <= y1; ty += 1) {
      for (let tx = x0; tx <= x1; tx += 1) {
        if (tx < 2 || tx >= WORLD_W - 2 || ty < 2 || ty >= WORLD_H - 2) continue;
        const nx = (tx - centerX) / rx;
        const ny = (ty - centerY) / ry;
        const oval = nx * nx + ny * ny;
        const lower = (tx - centerX) * (tx - centerX) / ((rx + 2) * (rx + 2)) + (ty - (centerY + thickness)) * (ty - (centerY + thickness)) / ((ry + thickness + 1) * (ry + thickness + 1));
        if (oval <= 1.05 || lower <= 1.12) setBlock(state, tx, ty, BLOCK.CLOUD);
      }
    }
    return { x0, x1, y0, y1, centerX, centerY, rx, ry, topY: centerY - ry };
  }

  function cutAirRoom(state, x0, x1, y0, y1) {
    for (let ty = y0; ty <= y1; ty += 1) {
      for (let tx = x0; tx <= x1; tx += 1) {
        if (tx < 1 || tx >= WORLD_W - 1 || ty < 1 || ty >= WORLD_H - 1) continue;
        setBlock(state, tx, ty, BLOCK.AIR);
      }
    }
  }

  function buildAirHouse(state, centerX, baseY, width = 10, height = 6, withSteamAmulet = false) {
    const x0 = centerX - Math.floor(width / 2);
    const x1 = x0 + width - 1;
    const y0 = baseY - height + 1;
    const y1 = baseY;
    for (let tx = x0; tx <= x1; tx += 1) {
      for (let ty = y0; ty <= y1; ty += 1) {
        const border = tx === x0 || tx === x1 || ty === y0 || ty === y1;
        setBlock(state, tx, ty, border ? BLOCK.CLOUD : BLOCK.AIR);
      }
    }
    const doorX = centerX;
    setBlock(state, doorX, y1, BLOCK.AIR);
    setBlock(state, doorX, y1 - 1, BLOCK.AIR);
    setBlock(state, x0 + 2, y0 + 2, BLOCK.AIR);
    setBlock(state, x1 - 2, y0 + 2, BLOCK.AIR);
    const boxY = y1 + 1;
    setBlock(state, x0 + 2, boxY, BLOCK.CLOUD);
    setBlock(state, x0 + 2, boxY - 1, BLOCK.GOLDEN_FLOWER);
    setBlock(state, x1 - 2, boxY, BLOCK.CLOUD);
    setBlock(state, x1 - 2, boxY - 1, BLOCK.GOLDEN_FLOWER);
    const bedX = x0 + 2;
    const bedY = y1 - 1;
    setBlock(state, bedX, bedY, BLOCK.PILLOW);
    const chestX = x1 - 2;
    const chestY = y1 - 1;
    setBlock(state, chestX, chestY, BLOCK.CHEST);
    const chest = ensureChestAt(state, chestX, chestY, null);
    if (withSteamAmulet) chest.slots[0] = createItemStack(ITEM.STEAM_AMULET, 1);
    return { x0, x1, y0, y1, centerX, baseY, bedX, bedY, chestX, chestY, chestKey: chestKey(chestX, chestY) };
  }

  function buildAirCastle(state, centerX, baseY) {
    const width = 52;
    const x0 = centerX - Math.floor(width / 2);
    const x1 = x0 + width - 1;
    const topY = baseY - 16;
    for (let tx = x0; tx <= x1; tx += 1) {
      for (let ty = topY; ty <= baseY; ty += 1) {
        const border = tx === x0 || tx === x1 || ty === topY || ty === baseY;
        setBlock(state, tx, ty, border ? BLOCK.CLOUD : BLOCK.AIR);
      }
    }
    for (let tx = centerX - 4; tx <= centerX + 4; tx += 1) {
      setBlock(state, tx, baseY, BLOCK.AIR);
      setBlock(state, tx, baseY - 1, BLOCK.AIR);
      setBlock(state, tx, baseY - 2, BLOCK.AIR);
    }
    for (const towerX of [x0 + 5, x1 - 5]) {
      for (let tx = towerX - 2; tx <= towerX + 2; tx += 1) {
        for (let ty = topY - 8; ty <= baseY; ty += 1) {
          const border = tx === towerX - 2 || tx === towerX + 2 || ty === topY - 8 || ty === baseY;
          setBlock(state, tx, ty, border ? BLOCK.CLOUD : BLOCK.AIR);
        }
      }
      for (let ty = baseY - 1; ty >= topY - 7; ty -= 1) setBlock(state, towerX, ty, BLOCK.LADDER);
    }
    const throneX = centerX;
    const throneY = baseY - 3;
    for (let tx = throneX - 3; tx <= throneX + 3; tx += 1) setBlock(state, tx, throneY + 1, BLOCK.CLOUD);
    for (let tx = throneX - 1; tx <= throneX + 1; tx += 1) setBlock(state, tx, throneY, BLOCK.CLOUD);
    return { x0, x1, baseY, topY, centerX, throneX, throneY };
  }

  function buildUndergroundCastle(state, centerX, baseY) {
    const width = 46;
    const x0 = centerX - Math.floor(width / 2);
    const x1 = x0 + width - 1;
    const topY = baseY - 18;
    for (let tx = x0; tx <= x1; tx += 1) {
      for (let ty = topY; ty <= baseY; ty += 1) {
        const border = tx === x0 || tx === x1 || ty === topY || ty === baseY;
        setBlock(state, tx, ty, border ? BLOCK.BLACKSTONE : BLOCK.AIR);
      }
    }
    for (let tx = centerX - 5; tx <= centerX + 5; tx += 1) {
      setBlock(state, tx, baseY, BLOCK.AIR);
      setBlock(state, tx, baseY - 1, BLOCK.AIR);
      setBlock(state, tx, baseY - 2, BLOCK.AIR);
    }
    for (const towerX of [x0 + 6, x1 - 6]) {
      for (let tx = towerX - 2; tx <= towerX + 2; tx += 1) {
        for (let ty = topY - 7; ty <= baseY; ty += 1) {
          const border = tx === towerX - 2 || tx === towerX + 2 || ty === topY - 7 || ty === baseY;
          setBlock(state, tx, ty, border ? BLOCK.BLACKSTONE : BLOCK.AIR);
        }
      }
      for (let ty = baseY - 1; ty >= topY - 6; ty -= 1) setBlock(state, towerX, ty, BLOCK.LADDER);
    }
    const throneX = centerX;
    const throneY = baseY - 3;
    for (let tx = throneX - 3; tx <= throneX + 3; tx += 1) setBlock(state, tx, throneY + 1, BLOCK.BLACKSTONE);
    for (let tx = throneX - 1; tx <= throneX + 1; tx += 1) setBlock(state, tx, throneY, BLOCK.BLACKSTONE);
    return { x0, x1, baseY, topY, centerX, throneX, throneY };
  }

  function setMushroomCapBlock(state, tx, ty, blockId) {
    if (tx < 1 || tx >= WORLD_W - 1 || ty < 1 || ty >= WORLD_H - 1) return;
    setBlock(state, tx, ty, blockId);
  }

  function buildRoundMushroom(state, tx, terrainTop, stemBlock, capBlock, height, capRadius) {
    const stemTop = terrainTop - height;
    for (let yy = stemTop; yy < terrainTop; yy += 1) setBlock(state, tx, yy, stemBlock);
    for (let lx = tx - capRadius; lx <= tx + capRadius; lx += 1) {
      for (let ly = stemTop - Math.max(1, Math.floor(capRadius / 2)); ly <= stemTop + 1; ly += 1) {
        const nx = Math.abs(lx - tx) / Math.max(1, capRadius);
        const ny = Math.abs(ly - stemTop) / Math.max(1, Math.floor(capRadius / 2) + 1);
        if ((nx * nx) + (ny * ny) <= 1.28) setMushroomCapBlock(state, lx, ly, capBlock);
      }
    }
  }

  function buildBellMushroom(state, tx, terrainTop, stemBlock, capBlock, height, capRadius) {
    const stemTop = terrainTop - height;
    for (let yy = stemTop; yy < terrainTop; yy += 1) setBlock(state, tx, yy, stemBlock);
    for (let lx = tx - capRadius; lx <= tx + capRadius; lx += 1) {
      const dx = Math.abs(lx - tx);
      const topY = stemTop - 1 - Math.max(0, Math.floor((capRadius - dx) / 2));
      const bottomY = stemTop + 1 + Math.max(1, Math.floor(dx / 2));
      for (let ly = topY; ly <= bottomY; ly += 1) setMushroomCapBlock(state, lx, ly, capBlock);
    }
  }

  function buildMushroomCluster(state, tx, terrainTop) {
    const variants = [
      { dx: -2, block: BLOCK.SMALL_WHITE_MUSHROOM },
      { dx: 0, block: BLOCK.SMALL_FLY_AGARIC },
      { dx: 2, block: BLOCK.SMALL_GLOW_MUSHROOM },
    ];
    for (const variant of variants) {
      if (Math.random() < 0.72) setBlock(state, tx + variant.dx, terrainTop - 1, variant.block);
    }
  }

  function buildEchoTemple(state, centerX, baseY) {
    const width = 26;
    const height = 12;
    const x0 = centerX - Math.floor(width / 2);
    const x1 = x0 + width - 1;
    const y1 = baseY;
    const y0 = y1 - height + 1;
    for (let tx = x0; tx <= x1; tx += 1) {
      for (let ty = y0; ty <= y1; ty += 1) {
        const border = tx === x0 || tx === x1 || ty === y0 || ty === y1;
        setBlock(state, tx, ty, border ? BLOCK.BLACKSTONE : BLOCK.AIR);
      }
    }
    for (let tx = x0 + 3; tx <= x1 - 3; tx += 1) setBlock(state, tx, y1 - 1, BLOCK.DEEPSTONE);
    const coreX = centerX;
    const coreY = y1 - 2;
    setBlock(state, coreX, coreY, BLOCK.ECHO_CORE);
    return { x0, x1, y0, y1, centerX, coreX, coreY };
  }

  function buildRootShrine(state, centerX, baseY) {
    const width = 30;
    const height = 16;
    const x0 = centerX - Math.floor(width / 2);
    const x1 = x0 + width - 1;
    const y1 = baseY;
    const y0 = y1 - height + 1;
    for (let tx = x0; tx <= x1; tx += 1) {
      for (let ty = y0; ty <= y1; ty += 1) {
        const border = tx === x0 || tx === x1 || ty === y0 || ty === y1;
        setBlock(state, tx, ty, border ? BLOCK.ROOT_STONE : BLOCK.AIR);
      }
    }
    for (let tx = x0 + 2; tx <= x1 - 2; tx += 1) setBlock(state, tx, y1 - 1, BLOCK.ROOT_STONE);
    for (let ty = y0 + 2; ty <= y1 - 2; ty += 1) {
      setBlock(state, centerX - 10, ty, BLOCK.GREAT_TREE_WOOD);
      setBlock(state, centerX + 10, ty, BLOCK.GREAT_TREE_WOOD);
    }
    const nodes = [
      { tx: centerX - 9, ty: y1 - 2 },
      { tx: centerX, ty: y0 + 3 },
      { tx: centerX + 9, ty: y1 - 2 },
    ];
    for (const node of nodes) setBlock(state, node.tx, node.ty, BLOCK.ROOT_NODE);
    const coreX = centerX;
    const coreY = y1 - 2;
    setBlock(state, coreX, coreY, BLOCK.ROOT_CORE);
    return { x0, x1, y0, y1, centerX, coreX, coreY, nodes };
  }

  function generateUndergroundDimension(state) {
    state.world = createGrid();
    state.biomeAt = Array(WORLD_W).fill('underground_plains');
    state.climateAt = Array(WORLD_W).fill(CLIMATE.ANY);
    state.surfaceAt = Array(WORLD_W).fill(10);
    state.animals = [];
    state.zombies = [];
    state.spiders = [];
    state.fireGuards = [];
    state.waterfolk = [];
    state.windfolk = [];
    state.humans = [];
    state.dwarves = [];
    state.humanSettlements = { villages: [], nodes: [], edges: [] };
    state.dwarfColony = { homes: [], stockpiles: [], halls: [], shafts: [], worksites: [], nodes: [], edges: [], settlements: [] };
    state.foods = [];
    state.chests = {};
    state.furnaces = {};
    state.doors = {};
    state.fireCaves = { region: null, shrine: null };
    state.firePyramid = null;
    state.fireBoss = null;
    state.fireKing = null;
    state.fireDungeon = null;
    state.friendlyFireKing = null;
    state.waterCaves = null;
    state.airCaves = null;
    state.waterWell = null;
    state.goldenFlowerGuardian = null;
    state.airGuardian = null;
    state.airThief = null;
    state.kraken = null;
    state.quake = null;
    state.fireWorldMeta = null;
    state.waterWorldMeta = null;
    state.airWorldMeta = null;
    state.undergroundWorldMeta = null;
    state.temporaryEarthBlocks = [];
    state.zombieSpawnTick = 0;
    state.zombieCaveSpawnTick = 0;
    state.spiderSpawnTick = 0;
    state.spiderCaveSpawnTick = 0;
    state.fluidTick = 0;

    const baseY = 48;
    const lakeX0 = Math.floor(WORLD_W * 0.03);
    const lakeX1 = Math.floor(WORLD_W * 0.11);
    const lavaX0 = Math.floor(WORLD_W * 0.23);
    const lavaX1 = Math.floor(WORLD_W * 0.31);
    const crystalX0 = Math.floor(WORLD_W * 0.34);
    const crystalX1 = Math.floor(WORLD_W * 0.5);
    const rootsX0 = Math.floor(WORLD_W * 0.54);
    const rootsX1 = Math.floor(WORLD_W * 0.61);
    const gardenX0 = Math.floor(WORLD_W * 0.62);
    const gardenX1 = Math.floor(WORLD_W * 0.82);
    const mushroomX0 = Math.floor(WORLD_W * 0.84);
    const mushroomX1 = Math.floor(WORLD_W * 0.97);
    let gardenGroundY = baseY;
    for (let tx = 0; tx < WORLD_W; tx += 1) {
      const inLakes = tx >= lakeX0 && tx <= lakeX1;
      const inLava = tx >= lavaX0 && tx <= lavaX1;
      const inGarden = tx >= gardenX0 && tx <= gardenX1;
      const inCrystal = tx >= crystalX0 && tx <= crystalX1;
      const inRoots = !inGarden && tx >= rootsX0 && tx <= rootsX1;
      const inMushroom = tx >= mushroomX0 && tx <= mushroomX1;
      const terrainTop = Math.round(
        baseY
        + Math.sin(tx / 27) * 2
        + Math.sin(tx / 9) * 0.8
        + (inLakes ? 2.2 + Math.sin(tx / 4.5) * 1.3 : 0)
        + (inLava ? 1.4 + Math.cos(tx / 6) * 1.1 : 0)
        + (inRoots ? Math.sin(tx / 5.5) * 0.9 : 0)
        + (inCrystal ? Math.sin(tx / 12) * 0.4 : 0)
        + (inMushroom ? -1.3 + Math.sin(tx / 8) * 0.8 : 0)
      );
      state.surfaceAt[tx] = terrainTop;
      state.biomeAt[tx] = inGarden
        ? 'great_tree_garden'
        : inLakes
          ? 'underground_lakes'
          : inLava
            ? 'lava_fissures'
            : inMushroom
              ? 'mushroom_halls'
        : inCrystal
          ? 'crystal_vaults'
          : inRoots
            ? 'great_roots'
            : 'underground_plains';
      if (inGarden) gardenGroundY = Math.min(gardenGroundY, terrainTop);
      if (!inGarden) {
        const vaultTop = Math.max(
          3,
          Math.round(
            8
            + Math.sin(tx / 21) * 2
            + Math.sin(tx / 7) * 1.5
            + (inCrystal ? -1 : 0)
            + (inMushroom ? -2 : 0)
            + (inLakes ? 1 : 0)
          )
        );
        for (let ty = 0; ty <= vaultTop; ty += 1) {
          const ceilingBlock = inLava
            ? BLOCK.BASALT
            : inCrystal && ty >= vaultTop - 1
              ? BLOCK.BLACKSTONE
              : BLOCK.DEEPSTONE;
          setBlock(state, tx, ty, ceilingBlock);
        }
        if (inCrystal) {
          const spikeLen = 2 + Math.abs(Math.round(Math.sin(tx / 4))) + (tx % 3 === 0 ? 1 : 0);
          for (let step = 1; step <= spikeLen; step += 1) {
            const ore = step === spikeLen || (step > 1 && tx % 2 === 0) ? BLOCK.DIAMOND_ORE : BLOCK.DEEP_ORE;
            setBlock(state, tx, vaultTop + step, ore);
          }
        }
        if (inLava) {
          const fissureDepth = 3 + Math.abs(Math.round(Math.sin(tx / 5) * 3));
          for (let step = 0; step <= fissureDepth; step += 1) {
            const yy = terrainTop - step;
            if (yy <= vaultTop + 2) break;
            setBlock(state, tx, yy, step >= fissureDepth - 1 ? BLOCK.LAVA : BLOCK.BASALT);
          }
          if (tx % 6 === 0) {
            for (let step = 1; step <= 3; step += 1) {
              const yy = vaultTop + step;
              if (yy >= terrainTop - 2) break;
              setBlock(state, tx, yy, BLOCK.BASALT);
            }
          }
        }
        if (inRoots) {
          const rootStart = vaultTop + 1;
          const rootLen = 6 + Math.abs(Math.round(Math.sin(tx / 6) * 5));
          for (let step = 0; step < rootLen; step += 1) {
            setBlock(state, tx, rootStart + step, BLOCK.GREAT_TREE_WOOD);
            if (step > 2 && step % 3 === 0) {
              setBlock(state, tx + 1, rootStart + step, BLOCK.GREAT_TREE_WOOD);
            }
          }
        }
      }
      for (let ty = terrainTop; ty < WORLD_H; ty += 1) {
        if (ty === terrainTop) setBlock(state, tx, ty, inGarden ? BLOCK.GRASS : inMushroom ? BLOCK.MUSHROOM_SOIL : inLava ? BLOCK.BASALT : BLOCK.BLACKSTONE);
        else if (ty <= terrainTop + 2) setBlock(state, tx, ty, inGarden ? BLOCK.DIRT : inMushroom ? BLOCK.MUSHROOM_SOIL : inLava ? BLOCK.BASALT : BLOCK.STONE);
        else setBlock(state, tx, ty, inLava ? BLOCK.DEEPSTONE : BLOCK.STONE);
      }
      if (inLakes) {
        const lakeDepth = 3 + Math.abs(Math.round(Math.sin(tx / 7) * 2));
        for (let step = 0; step <= lakeDepth; step += 1) {
          const yy = terrainTop - step;
          if (yy <= 2) break;
          setBlock(state, tx, yy, step <= lakeDepth - 1 ? BLOCK.WATER : BLOCK.BLACKSTONE);
        }
        if (tx % 9 === 0) {
          setBlock(state, tx, Math.max(1, terrainTop - lakeDepth - 1), BLOCK.TORCH);
        }
      }
      if (inCrystal) {
        const floorSpikeLen = 2 + Math.abs(Math.round(Math.cos(tx / 5) * 2));
        for (let step = 1; step <= floorSpikeLen; step += 1) {
          const yy = terrainTop - step;
          if (yy <= 2) break;
          setBlock(state, tx, yy, step === floorSpikeLen ? BLOCK.DIAMOND_ORE : BLOCK.DEEP_ORE);
        }
      }
      if (inMushroom) {
        if (tx % 17 === 0) {
          buildRoundMushroom(
            state,
            tx,
            terrainTop,
            BLOCK.WHITE_MUSHROOM_STEM,
            BLOCK.WHITE_MUSHROOM_CAP,
            5 + Math.abs(Math.round(Math.sin(tx / 10) * 2)),
            4
          );
        } else if (tx % 19 === 0) {
          buildBellMushroom(
            state,
            tx,
            terrainTop,
            BLOCK.FLY_AGARIC_STEM,
            BLOCK.FLY_AGARIC_CAP,
            6 + Math.abs(Math.round(Math.cos(tx / 8) * 2)),
            4
          );
        } else if (tx % 23 === 0) {
          buildRoundMushroom(
            state,
            tx,
            terrainTop,
            BLOCK.GLOW_MUSHROOM_STEM,
            BLOCK.GLOW_MUSHROOM_CAP,
            4 + Math.abs(Math.round(Math.sin(tx / 7) * 2)),
            3
          );
        } else if (tx % 7 === 0) {
          buildMushroomCluster(state, tx, terrainTop);
        }
      }
      if (tx >= gardenX0 - 8 && tx <= gardenX1 + 8 && tx % 6 === 0) {
        const rootLen = 5 + Math.abs(Math.round(Math.sin(tx / 8) * 6));
        for (let step = 0; step < rootLen; step += 1) {
          const yy = terrainTop + 2 + step;
          if (yy >= WORLD_H) break;
          setBlock(state, tx, yy, BLOCK.GREAT_TREE_WOOD);
          if (step > 1 && step % 4 === 0) setBlock(state, tx + (tx % 12 === 0 ? 1 : -1), yy, BLOCK.GREAT_TREE_WOOD);
        }
      }
      if (inGarden && tx % 18 === 0) {
        const trunkTop = terrainTop - 8;
        for (let ty = trunkTop; ty < terrainTop; ty += 1) setBlock(state, tx, ty, BLOCK.WOOD);
        for (let lx = tx - 2; lx <= tx + 2; lx += 1) {
          for (let ly = trunkTop - 3; ly <= trunkTop; ly += 1) {
            if (Math.abs(lx - tx) + Math.abs(ly - (trunkTop - 1)) <= 3) setBlock(state, lx, ly, BLOCK.LEAF);
          }
        }
      }
    }

    const castle = buildUndergroundCastle(state, Math.floor(WORLD_W * 0.18), baseY - 1);
    const echoTemple = buildEchoTemple(state, Math.floor((crystalX0 + crystalX1) / 2), Math.min(state.surfaceAt[Math.floor((crystalX0 + crystalX1) / 2)] + 1, baseY + 1));
    const echoShardDepth = { tx: crystalX0 + 9, ty: Math.max(10, state.surfaceAt[crystalX0 + 9] - 4), itemId: ITEM.DEPTH_CRYSTAL };
    const echoShardLake = { tx: Math.floor((lakeX0 + lakeX1) / 2), ty: Math.max(10, state.surfaceAt[Math.floor((lakeX0 + lakeX1) / 2)] - 4), itemId: ITEM.LAKE_CRYSTAL };
    const echoShardRift = { tx: Math.floor((lavaX0 + lavaX1) / 2), ty: Math.max(10, state.surfaceAt[Math.floor((lavaX0 + lavaX1) / 2)] - 5), itemId: ITEM.RIFT_CRYSTAL };
    for (const shard of [echoShardDepth, echoShardLake, echoShardRift]) {
      setBlock(state, shard.tx, shard.ty + 1, BLOCK.ECHO_SHARD_PEDESTAL);
      setBlock(state, shard.tx, shard.ty, BLOCK.ECHO_CORE);
    }
    const rootShrine = buildRootShrine(state, Math.floor((rootsX0 + gardenX0) / 2), Math.min(WORLD_H - 10, gardenGroundY + 24));
    const keepers = [
      { x: Math.floor((lakeX0 + lakeX1) / 2) * TILE - 8, y: (state.surfaceAt[Math.floor((lakeX0 + lakeX1) / 2)] - 2) * TILE, w: 16, h: 24, dir: 1, kind: 'lake', anchorPhase: 0.15 },
      { x: Math.floor((crystalX0 + crystalX1) / 2) * TILE - 8, y: (Math.min(state.surfaceAt[Math.floor((crystalX0 + crystalX1) / 2)], baseY) - 2) * TILE, w: 16, h: 24, dir: 1, kind: 'crystal', anchorPhase: 0.4 },
      { x: (crystalX0 + 12) * TILE - 8, y: (state.surfaceAt[crystalX0 + 12] - 2) * TILE, w: 16, h: 24, dir: -1, kind: 'crystal', anchorPhase: 1.1 },
      { x: (rootsX0 + 8) * TILE - 8, y: (state.surfaceAt[rootsX0 + 8] - 2) * TILE, w: 16, h: 24, dir: 1, kind: 'roots', anchorPhase: 2.3 },
      { x: (rootsX1 - 6) * TILE - 8, y: (state.surfaceAt[rootsX1 - 6] - 2) * TILE, w: 16, h: 24, dir: -1, kind: 'roots', anchorPhase: 3.4 },
      { x: (mushroomX0 + 9) * TILE - 8, y: (state.surfaceAt[mushroomX0 + 9] - 2) * TILE, w: 16, h: 24, dir: 1, kind: 'mushroom', anchorPhase: 4.05 },
    ].map((keeper) => ({
      ...keeper,
      anchorX: keeper.x,
      anchorY: keeper.y,
      dirTimer: 1.4 + Math.random() * 1.8,
      timer: Math.random() * 2,
    }));
    state.undergroundWorldMeta = {
      name: 'Подземное измерение',
      castle,
      crystalVaults: {
        x0: crystalX0,
        x1: crystalX1,
        centerX: Math.floor((crystalX0 + crystalX1) / 2),
      },
      undergroundLakes: {
        x0: lakeX0,
        x1: lakeX1,
        centerX: Math.floor((lakeX0 + lakeX1) / 2),
      },
      lavaFissures: {
        x0: lavaX0,
        x1: lavaX1,
        centerX: Math.floor((lavaX0 + lavaX1) / 2),
      },
      rootGrove: {
        x0: rootsX0,
        x1: rootsX1,
        centerX: Math.floor((rootsX0 + rootsX1) / 2),
      },
      mushroomHalls: {
        x0: mushroomX0,
        x1: mushroomX1,
        centerX: Math.floor((mushroomX0 + mushroomX1) / 2),
      },
      echoTemple: {
        ...echoTemple,
        inserted: {
          [ITEM.DEPTH_CRYSTAL]: false,
          [ITEM.LAKE_CRYSTAL]: false,
          [ITEM.RIFT_CRYSTAL]: false,
        },
        rewardGiven: false,
      },
      echoShards: [
        { ...echoShardDepth, taken: false },
        { ...echoShardLake, taken: false },
        { ...echoShardRift, taken: false },
      ],
      rootShrine: {
        ...rootShrine,
        activated: [false, false, false],
        rewardGiven: false,
      },
      garden: {
        x0: gardenX0,
        x1: gardenX1,
        centerX: Math.floor((gardenX0 + gardenX1) / 2),
        groundY: gardenGroundY,
      },
      king: {
        x: castle.throneX * TILE - 8,
        y: (castle.throneY - 2) * TILE,
        w: 16,
        h: 24,
        dir: -1,
      },
      keepers,
      firstArrivalShown: false,
      saplingGiven: false,
      greatTreePlanted: false,
      finalAmuletDropped: false,
      spawnX: castle.throneX,
      spawnY: castle.throneY - 1,
    };
    state.player.x = castle.throneX * TILE - 6;
    state.player.y = (castle.throneY - 2) * TILE;
  }

  function buildAirThiefApartment(state, apartment) {
    const centerX = apartment.centerX;
    const roomX0 = apartment.roomX0;
    const roomX1 = apartment.roomX1;
    const roomY0 = apartment.roomY0;
    const roomY1 = apartment.roomY1;
    for (let tx = roomX0; tx <= roomX1; tx += 1) {
      for (let ty = roomY0; ty <= roomY1; ty += 1) {
        setBlock(state, tx, ty, BLOCK.AIR);
      }
    }
    const tunnelY = apartment.tunnelY;
    for (let tx = apartment.tunnelX0; tx <= apartment.tunnelX1; tx += 1) {
      setBlock(state, tx, tunnelY, BLOCK.AIR);
      setBlock(state, tx, tunnelY - 1, BLOCK.AIR);
    }
    setBlock(state, roomX0 + 1, roomY1 - 1, BLOCK.GOLDEN_FLOWER);
    setBlock(state, roomX1 - 1, roomY1 - 1, BLOCK.GOLDEN_FLOWER);
    if (apartment.withPortal) setBlock(state, apartment.portalX, apartment.portalY, BLOCK.AIR_THIEF_PORTAL);
    return apartment;
  }

  function clearAirThiefApartment(state, apartment) {
    for (let ty = apartment.roomY0; ty <= apartment.roomY1; ty += 1) {
      for (let tx = apartment.roomX0; tx <= apartment.roomX1; tx += 1) setBlock(state, tx, ty, BLOCK.CLOUD);
    }
    for (let tx = apartment.tunnelX0; tx <= apartment.tunnelX1; tx += 1) {
      setBlock(state, tx, apartment.tunnelY, BLOCK.CLOUD);
      setBlock(state, tx, apartment.tunnelY - 1, BLOCK.CLOUD);
    }
  }

  function buildAirThiefRefuge(state, centerX, baseY) {
    const width = 42;
    const height = 16;
    const x0 = centerX - Math.floor(width / 2);
    const x1 = x0 + width - 1;
    const y0 = baseY - height + 1;
    const y1 = baseY;
    for (let tx = x0; tx <= x1; tx += 1) {
      for (let ty = y0; ty <= y1; ty += 1) {
        const border = tx === x0 || tx === x1 || ty === y0 || ty === y1;
        setBlock(state, tx, ty, border ? BLOCK.CLOUD : BLOCK.AIR);
      }
    }
    for (let tx = x0 + 3; tx <= x1 - 3; tx += 1) setBlock(state, tx, y1 - 1, BLOCK.CLOUD);
    for (let tx = centerX - 5; tx <= centerX + 5; tx += 1) setBlock(state, tx, y1 - 5, BLOCK.CLOUD);
    for (let tx = centerX - 1; tx <= centerX + 1; tx += 1) setBlock(state, tx, y1 - 6, BLOCK.CLOUD);
    const portalX = x0 + 4;
    const portalY = y1 - 2;
    setBlock(state, portalX, portalY, BLOCK.AIR_THIEF_PORTAL);
    setBlock(state, portalX, portalY + 1, BLOCK.AIR);
    const thiefX = centerX;
    const thiefY = y1 - 7;
    const chestX = x1 - 5;
    const chestY = y1 - 2;
    return {
      centerX,
      baseY,
      x0,
      x1,
      y0,
      y1,
      portalX,
      portalY,
      thiefX,
      thiefY,
      chestX,
      chestY,
      cleared: false,
      chestSpawned: false,
    };
  }

  function revealAirThiefApartments(state) {
    const meta = state.airWorldMeta;
    if (!meta || !Array.isArray(meta.hiddenApartments) || meta.hiddenApartmentsVisible) return;
    for (const apartment of meta.hiddenApartments) buildAirThiefApartment(state, apartment);
    meta.hiddenApartmentsVisible = true;
  }

  function hideAirThiefApartments(state) {
    const meta = state.airWorldMeta;
    if (!meta || !Array.isArray(meta.hiddenApartments) || !meta.hiddenApartmentsVisible) return;
    for (const apartment of meta.hiddenApartments) clearAirThiefApartment(state, apartment);
    meta.hiddenApartmentsVisible = false;
  }

  function retrofitAirThiefQuest(state) {
    const meta = state.airWorldMeta;
    if (!meta || !Array.isArray(meta.islands) || !Array.isArray(meta.houses)) return false;
    const needsApartmentUpgrade = !Array.isArray(meta.hiddenApartments) || meta.hiddenApartments.some((apartment) => !Number.isFinite(apartment.roomX0));
    if (needsApartmentUpgrade) {
      const uninhabited = meta.islands.filter((island) => island.kind === 'wild' && !meta.houses.some((house) => house.centerX >= island.x0 && house.centerX <= island.x1));
      const apartmentIslands = uninhabited.slice(0, Math.min(4, uninhabited.length));
      meta.hiddenApartments = apartmentIslands.map((island, index) => {
        const roomX0 = island.centerX - 5;
        const roomX1 = island.centerX + 5;
        const roomY0 = island.centerY - 1;
        const roomY1 = roomY0 + 6;
        const tunnelY = roomY1 - 1;
        const tunnelX0 = island.x0 + 2;
        const tunnelX1 = roomX0;
        return {
          centerX: island.centerX,
          islandX0: island.x0,
          islandX1: island.x1,
          roomX0,
          roomX1,
          roomY0,
          roomY1,
          tunnelX0,
          tunnelX1,
          tunnelY,
          withPortal: index === 0,
          portalX: index === 0 ? island.centerX : null,
          portalY: index === 0 ? roomY1 - 1 : null,
        };
      });
    }
    if (typeof meta.hiddenApartmentsVisible !== 'boolean') meta.hiddenApartmentsVisible = false;
    if (!meta.thiefPortalApartment) meta.thiefPortalApartment = meta.hiddenApartments.find((entry) => entry.withPortal) || null;
    if (!meta.thiefRefuge) meta.thiefRefuge = buildAirThiefRefuge(state, 58, 34);
    if (typeof meta.thiefMagnetGiven !== 'boolean') meta.thiefMagnetGiven = false;
    if (typeof meta.thiefBossDefeated !== 'boolean') meta.thiefBossDefeated = false;
    if (typeof meta.lostWindsDelivered !== 'boolean') meta.lostWindsDelivered = false;
    if (typeof meta.invisibilityAmuletGiven !== 'boolean') meta.invisibilityAmuletGiven = false;
    if (typeof meta.invisibilityArmorCalled !== 'boolean') meta.invisibilityArmorCalled = false;
    if (typeof meta.homePortalSpawned !== 'boolean') meta.homePortalSpawned = false;
    if (typeof meta.castleLocked !== 'boolean') meta.castleLocked = false;
    return true;
  }

  function generateAirDimension(state) {
    state.world = createGrid();
    state.biomeAt = Array(WORLD_W).fill('air_plains');
    state.climateAt = Array(WORLD_W).fill(CLIMATE.ANY);
    state.surfaceAt = Array(WORLD_W).fill(18);
    state.animals = [];
    state.zombies = [];
    state.spiders = [];
    state.fireGuards = [];
    state.waterfolk = [];
    state.windfolk = [];
    state.humans = [];
    state.dwarves = [];
    state.humanSettlements = { villages: [], nodes: [], edges: [] };
    state.dwarfColony = { homes: [], stockpiles: [], halls: [], shafts: [], worksites: [], nodes: [], edges: [], settlements: [] };
    state.foods = [];
    state.chests = {};
    state.furnaces = {};
    state.doors = {};
    state.fireCaves = { region: null, shrine: null };
    state.firePyramid = null;
    state.fireBoss = null;
    state.fireKing = null;
    state.fireDungeon = null;
    state.friendlyFireKing = null;
    state.waterCaves = null;
    state.airCaves = null;
    state.waterWell = null;
    state.goldenFlowerGuardian = null;
    state.airGuardian = null;
    state.airThief = null;
    state.kraken = null;
    state.quake = null;
    state.fireWorldMeta = null;
    state.waterWorldMeta = null;
    state.airWorldMeta = null;
    state.zombieSpawnTick = 0;
    state.zombieCaveSpawnTick = 0;
    state.spiderSpawnTick = 0;
    state.spiderCaveSpawnTick = 0;
    state.fluidTick = 0;

    const voidStart = Math.floor(WORLD_H * 0.58);

    const islands = [];
    const startIsland = carveCloudIsland(state, Math.floor(WORLD_W / 2), 36, 40, 11, 10);
    const castleIsland = carveCloudIsland(state, WORLD_W - 90, 36, 52, 13, 12);
    islands.push({ ...startIsland, kind: 'start' });
    islands.push({ ...castleIsland, kind: 'castle' });
    const randomCenters = [46, 118, 190, 262, 334, 406, 478, 550, 622, 694];
    for (let i = 0; i < randomCenters.length; i += 1) {
      const cx = randomCenters[i];
      if (Math.abs(cx - startIsland.centerX) < 72 || Math.abs(cx - castleIsland.centerX) < 78) continue;
      const cy = 28 + (i % 4) * 7 + Math.floor(rand(0, 4));
      const rx = 22 + (i % 3) * 8;
      const ry = 7 + (i % 2) * 2;
      const thickness = 7 + (i % 3);
      islands.push({ ...carveCloudIsland(state, cx, cy, rx, ry, thickness), kind: 'wild' });
    }

    const houses = [];
    for (const island of islands) {
      if (island.kind === 'castle') continue;
      if (Math.random() < 0.18 && island.kind !== 'start') continue;
      const largeIsland = island.rx >= 30;
      const houseCount = island.kind === 'start' ? 3 : largeIsland ? (island.rx >= 38 ? 3 : 2) : 1;
      const offsets = houseCount === 1
        ? [0]
        : houseCount === 2
          ? [-12, 12]
          : [-16, 0, 16];
      for (let i = 0; i < offsets.length; i += 1) {
        const withSteamAmulet = island.kind === 'start' ? i === 1 : Math.random() < 0.35;
        const house = buildAirHouse(
          state,
          island.centerX + offsets[i],
          island.topY - 1,
          island.kind === 'start' ? 11 : 9,
          island.kind === 'start' ? 7 : 6,
          withSteamAmulet
        );
        houses.push({ ...house, islandKind: island.kind });
      }
    }

    const castle = buildAirCastle(state, castleIsland.centerX, castleIsland.topY - 1);
    const uninhabited = islands.filter((island) => island.kind === 'wild' && !houses.some((house) => house.centerX >= island.x0 && house.centerX <= island.x1));
    const apartmentIslands = uninhabited.slice(0, Math.min(4, uninhabited.length));
    const hiddenApartments = apartmentIslands.map((island, index) => {
      const roomX0 = island.centerX - 5;
      const roomX1 = island.centerX + 5;
      const roomY0 = island.centerY - 1;
      const roomY1 = roomY0 + 6;
      const tunnelY = roomY1 - 1;
      const tunnelX0 = island.x0 + 2;
      const tunnelX1 = roomX0;
      return {
        centerX: island.centerX,
        islandX0: island.x0,
        islandX1: island.x1,
        roomX0,
        roomX1,
        roomY0,
        roomY1,
        tunnelX0,
        tunnelX1,
        tunnelY,
        withPortal: index === 0,
        portalX: index === 0 ? island.centerX : null,
        portalY: index === 0 ? roomY1 - 1 : null,
      };
    });
    const thiefRefuge = buildAirThiefRefuge(state, 58, 34);
    const portalX = startIsland.centerX;
    const portalY = startIsland.topY - 1;
    setBlock(state, portalX, portalY, BLOCK.AIR_DIMENSION_PORTAL);

    for (const house of houses) {
      state.windfolk.push({
        x: house.centerX * TILE - 7,
        y: (house.y0 + 2) * TILE,
        w: 14,
        h: 20,
        dir: Math.random() < 0.5 ? -1 : 1,
        dirTimer: 1.5 + Math.random() * 2,
        timer: Math.random() * Math.PI * 2,
        anchorPhase: Math.random() * Math.PI * 2,
        anchorX: house.centerX * TILE - 7,
        anchorY: (house.y0 + 2) * TILE,
        chief: false,
        steamForm: false,
        chestKey: house.chestKey,
        sleeping: false,
        sleepBlockX: house.bedX * TILE,
        sleepBlockY: house.bedY * TILE,
      });
    }

    state.windfolk.push({
      x: castle.throneX * TILE - 7,
      y: (castle.throneY - 1) * TILE,
      w: 14,
      h: 20,
      dir: -1,
      dirTimer: 2.2,
      timer: 0,
      anchorPhase: 0.4,
      anchorX: castle.throneX * TILE - 7,
      anchorY: (castle.throneY - 1) * TILE,
      chief: true,
      steamForm: false,
      chestKey: null,
      sleeping: false,
      sleepBlockX: null,
      sleepBlockY: null,
    });

    state.airWorldMeta = {
      name: 'Воздушное измерение',
      portalX,
      portalY,
      voidStart,
      startIsland: {
        x0: startIsland.x0,
        x1: startIsland.x1,
        y0: startIsland.y0,
        y1: startIsland.y1 + 8,
        unlocked: false,
        guideShown: false,
      },
      castle,
      islands,
      houses,
      questGiven: false,
      thiefMagnetGiven: false,
      hiddenApartments,
      hiddenApartmentsVisible: false,
      thiefRefuge,
      thiefPortalApartment: hiddenApartments.find((entry) => entry.withPortal) || null,
      thiefBossDefeated: false,
      lostWindsDelivered: false,
      invisibilityAmuletGiven: false,
      invisibilityArmorCalled: false,
      homePortalSpawned: false,
      castleLocked: false,
    };
    state.player.x = portalX * TILE;
    state.player.y = (startIsland.topY - 4) * TILE;
  }

  function generateAirDimensionBundle(worldMeta, seed) {
    const temp = createGameState(worldMeta);
    withSeed(`${seed || ''}:air`, () => generateAirDimension(temp));
    return captureDimensionState(temp);
  }

  function generateUndergroundDimensionBundle(worldMeta, seed) {
    const temp = createGameState(worldMeta);
    withSeed(`${seed || ''}:underground`, () => generateUndergroundDimension(temp));
    return captureDimensionState(temp);
  }

  function stampEndTrunk(state, centerX, topY, bottomY, halfWidth) {
    for (let ty = topY; ty <= bottomY; ty += 1) {
      const progress = (ty - topY) / Math.max(1, bottomY - topY);
      const swell = Math.round(Math.sin(progress * Math.PI) * 2.5 + Math.sin(progress * 4.4) * 0.9);
      const baseWidth = halfWidth + Math.max(0, swell) + (ty > bottomY - 26 ? 1 : 0);
      const curve = Math.round(Math.sin(ty / 23) * 0.9);
      for (let tx = centerX - baseWidth + curve; tx <= centerX + baseWidth + curve; tx += 1) {
        setBlock(state, tx, ty, BLOCK.GREAT_TREE_WOOD);
      }
      if (ty % 26 === 9 || ty % 26 === 17) {
        const branchDir = ty % 44 < 22 ? -1 : 1;
        const branchStartX = centerX + curve + branchDir * (baseWidth - 2);
        const branchLen = 4 + Math.max(0, 2 - Math.floor(progress * 2.5));
        const branchRise = progress < 0.5 ? 1 : 0;
        for (let step = 1; step <= branchLen; step += 1) {
          const bx = branchStartX + step * branchDir;
          const by = ty - Math.floor(step / 3) * branchRise;
          setBlock(state, bx, by, BLOCK.GREAT_TREE_WOOD);
          if (step >= branchLen - 2) {
            setBlock(state, bx, by - 1, BLOCK.GREAT_TREE_WOOD);
          }
        }
      }
    }
  }

  function carveEndLedge(state, centerX, y, width, dir = 1) {
    const roomDepth = 4;
    const x0 = centerX + (dir < 0 ? -width - roomDepth : roomDepth);
    const x1 = centerX + (dir < 0 ? -roomDepth : width + roomDepth);
    const roomEdgeX = centerX + dir * 2;
    for (let tx = Math.min(x0, x1); tx <= Math.max(x0, x1); tx += 1) {
      for (let ty = y - 2; ty <= y + 2; ty += 1) {
        setBlock(state, tx, ty, BLOCK.AIR);
      }
      setBlock(state, tx, y + 3, BLOCK.GREAT_TREE_WOOD);
    }
    for (let tx = roomEdgeX; tx !== roomEdgeX + dir * roomDepth; tx += dir) {
      for (let ty = y - 1; ty <= y + 1; ty += 1) setBlock(state, tx, ty, BLOCK.AIR);
    }
    for (let step = 1; step <= width - 2; step += 1) {
      const bx = roomEdgeX + dir * (roomDepth + step);
      const by = y - Math.floor(step / 4);
      setBlock(state, bx, by, BLOCK.GREAT_TREE_WOOD);
      setBlock(state, bx, by + 1, BLOCK.GREAT_TREE_WOOD);
    }
  }

  function stampMossCrown(state, centerX, crownY) {
    const rx = 26;
    const ry = 12;
    const thickness = 9;
    for (let dx = -rx - 2; dx <= rx + 2; dx += 1) {
      for (let dy = -ry - 2; dy <= ry + thickness + 2; dy += 1) {
        const tx = centerX + dx;
        const ty = crownY + dy;
        if (tx < 2 || tx >= WORLD_W - 2 || ty < 2 || ty >= WORLD_H - 2) continue;
        const nx = dx / rx;
        const ny = dy / ry;
        const oval = nx * nx + ny * ny;
        const lower = (dx * dx) / ((rx + 3) * (rx + 3)) + ((dy - thickness) * (dy - thickness)) / ((ry + thickness + 2) * (ry + thickness + 2));
        if (oval <= 1.03 || lower <= 1.08) setBlock(state, tx, ty, BLOCK.MOSS);
      }
    }
    for (let tx = centerX - 12; tx <= centerX + 12; tx += 1) {
      setBlock(state, tx, crownY - 4, BLOCK.MOSS);
      setBlock(state, tx, crownY - 3, BLOCK.MOSS);
    }
  }

  function carveEndSpawnRoom(state, centerX, floorY) {
    const x0 = centerX - 6;
    const x1 = centerX + 6;
    const y0 = floorY - 6;
    const y1 = floorY;
    for (let ty = y0; ty <= y1; ty += 1) {
      for (let tx = x0; tx <= x1; tx += 1) {
        setBlock(state, tx, ty, BLOCK.AIR);
      }
    }
    for (let tx = x0 - 1; tx <= x1 + 1; tx += 1) setBlock(state, tx, y1 + 1, BLOCK.GREAT_TREE_WOOD);
    setBlock(state, centerX, y1, BLOCK.AIR);
    setBlock(state, centerX, y1 - 1, BLOCK.AIR);
    return { x0, x1, y0, y1 };
  }

  function carveEndCrownApproach(state, centerX, crownY) {
    for (let ty = crownY + 10; ty >= crownY - 2; ty -= 1) {
      for (let tx = centerX - 3; tx <= centerX + 3; tx += 1) {
        setBlock(state, tx, ty, BLOCK.AIR);
      }
      setBlock(state, centerX - 4, ty + 1, BLOCK.GREAT_TREE_WOOD);
      setBlock(state, centerX + 4, ty + 1, BLOCK.GREAT_TREE_WOOD);
    }
    for (let tx = centerX - 8; tx <= centerX + 8; tx += 1) {
      setBlock(state, tx, crownY + 1, BLOCK.MOSS);
      setBlock(state, tx, crownY + 2, BLOCK.MOSS);
    }
  }

  function generateEndDimension(state) {
    state.world = createGrid();
    state.biomeAt = Array(WORLD_W).fill('end_great_tree');
    state.climateAt = Array(WORLD_W).fill('any');
    state.surfaceAt = Array(WORLD_W).fill(0);
    state.animals = [];
    state.zombies = [];
    state.spiders = [];
    state.fireGuards = [];
    state.waterfolk = [];
    state.windfolk = [];
    state.humans = [];
    state.humanSettlements = { villages: [], nodes: [], edges: [] };
    state.dwarves = [];
    state.dwarfColony = { homes: [], stockpiles: [], halls: [], shafts: [], worksites: [], nodes: [], edges: [], settlements: [] };
    state.foods = [];
    state.chests = {};
    state.furnaces = {};
    state.doors = {};
    state.fireCaves = null;
    state.firePyramid = null;
    state.fireBoss = null;
    state.fireKing = null;
    state.fireDungeon = null;
    state.friendlyFireKing = null;
    state.waterCaves = null;
    state.airCaves = null;
    state.waterWell = null;
    state.goldenFlowerGuardian = null;
    state.airGuardian = null;
    state.airThief = null;
    state.kraken = null;
    state.quake = null;
    state.undergroundWorldMeta = null;
    state.airWorldMeta = null;
    state.fireWorldMeta = null;
    state.waterWorldMeta = null;

    const centerX = Math.floor(WORLD_W * 0.5);
    const trunkTopY = 14;
    const trunkBottomY = WORLD_H - 12;
    const trunkHalfWidth = 4;
    stampEndTrunk(state, centerX, trunkTopY, trunkBottomY, trunkHalfWidth);
    for (let i = 0; i < 8; i += 1) {
      carveEndLedge(state, centerX, trunkBottomY - 12 - i * 18, 8 + (i % 3) * 2, i % 2 === 0 ? -1 : 1);
    }

    const summitY = trunkTopY + 8;
    stampMossCrown(state, centerX, summitY);
    carveEndCrownApproach(state, centerX, summitY);
    const artifactChestX = centerX;
    const artifactChestY = summitY - 6;
    setBlock(state, artifactChestX, artifactChestY, BLOCK.CHEST);
    const artifactChest = ensureChestAt(state, artifactChestX, artifactChestY, null);
    artifactChest.slots[0] = createItemStack(ITEM.FOUR_ELEMENTS_ARTIFACT, 1);

    const spawnRoom = carveEndSpawnRoom(state, centerX, trunkBottomY - 10);
    const spawnX = centerX;
    const spawnY = spawnRoom.y0 + 2;
    const bossY = trunkTopY + 42;
    const summitLockY = summitY + 8;
    state.evilTrunk = {
      x: centerX * TILE - 18,
      y: bossY * TILE - 24,
      w: 36,
      h: 52,
      hp: 550,
      maxHp: 550,
      vx: 0,
      vy: 0,
      dir: 1,
      phaseTimer: 0,
      attackCooldown: 0,
      isBoss: true,
      name: 'Злой ствол',
      arena: {
        x0: 2 * TILE,
        x1: (WORLD_W - 2) * TILE,
        y0: 2 * TILE,
        y1: (WORLD_H - 6) * TILE,
      },
    };
    state.endWorldMeta = {
      name: 'Энд',
      spawnX,
      spawnY,
      centerX,
      trunk: {
        x: centerX,
        topY: trunkTopY,
        bottomY: trunkBottomY,
        halfWidth: trunkHalfWidth,
      },
      spawnRoom,
      summit: {
        x: centerX,
        y: summitY,
        lockY: summitLockY,
      },
      artifactChest: {
        tx: artifactChestX,
        ty: artifactChestY,
      },
      artifactObtained: false,
      elementalPortalSpawned: false,
      elementalPortal: null,
      bossDefeated: false,
    };
    state.player.x = spawnX * TILE;
    state.player.y = spawnY * TILE;
  }

  function generateEndDimensionBundle(worldMeta, seed) {
    const temp = createGameState(worldMeta);
    withSeed(`${seed || ''}:end`, () => generateEndDimension(temp));
    return captureDimensionState(temp);
  }

  Game.generation = {
    generateWorld,
    generateFireDimensionBundle,
    generateWaterDimensionBundle,
    generateAirDimensionBundle,
    generateUndergroundDimensionBundle,
    generateEndDimensionBundle,
    retrofitWorldFeatures,
    checkFireShrineActivation,
    stampMainWell,
    stampAirEntrance,
    spawnAirEntrance,
    revealAirThiefApartments,
    hideAirThiefApartments,
    retrofitAirThiefQuest,
  };
})();
