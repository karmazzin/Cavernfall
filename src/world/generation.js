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
  const { rand, clamp } = Game.math;
  const { getBlock, setBlock } = Game.world;
  const { chestKey, createChestState, fillChestLoot, ensureChestAt } = Game.chestSystem;
  const { placeDoor } = Game.doorSystem;
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

  const CLIMATE = {
    ANY: 'any',
    COLD: 'cold',
    TEMPERATE: 'temperate',
    WARM: 'warm',
  };

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
    if (biome === 'mountains') return CLIMATE.COLD;
    if (biome === 'desert' || biome === 'volcano') return CLIMATE.WARM;
    if (biome === 'plains' || biome === 'forest') return CLIMATE.TEMPERATE;
    return CLIMATE.ANY;
  }

  function chooseBiomeForClimate(climate, lastBiome) {
    if (climate === CLIMATE.COLD) return 'mountains';
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
      if (state.biomeAt[tx] !== 'plains' && state.biomeAt[tx] !== 'desert') {
        tx += 1;
        continue;
      }

      const start = tx;
      while (tx < WORLD_W && (state.biomeAt[tx] === 'plains' || state.biomeAt[tx] === 'desert')) tx += 1;
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
      if (state.biomeAt[tx] !== 'plains' && state.biomeAt[tx] !== 'desert') continue;
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
      if (biome === 'forest') segLen = Math.floor(rand(72, 136));
      if (biome === 'desert') segLen = Math.floor(rand(112, 176));

      const segmentStart = x;
      const segmentEnd = Math.min(WORLD_W - 1, x + segLen - 1);
      const center = (segmentStart + segmentEnd) / 2;
      const half = Math.max(1, (segmentEnd - segmentStart) / 2);
      const peakLift = biome === 'mountains' ? rand(10, 18) : biome === 'forest' ? rand(1, 3) : biome === 'desert' ? rand(0, 1.4) : rand(0, 1.2);
      const segmentBase = biome === 'plains' || biome === 'desert' ? SURFACE_BASE + rand(-0.6, 0.6) : SURFACE_BASE + rand(-1.2, 1.2);

      for (; x <= segmentEnd; x += 1) {
        const prev = x > 0 ? state.surfaceAt[x - 1] : SURFACE_BASE;
        let target = segmentBase;
        if (biome === 'mountains') {
          const t = Math.abs((x - center) / half);
          const ridge = Math.pow(Math.max(0, 1 - t), 0.55);
          target = SURFACE_BASE - peakLift * ridge + rand(-0.6, 0.6);
        } else if (biome === 'forest') {
          target += Math.sin((x - segmentStart) / 9) * 1.2 + rand(-0.4, 0.4);
        } else if (biome === 'desert') {
          target += Math.sin((x - segmentStart) / 14) * 0.9 + rand(-0.25, 0.25);
        } else if ((x - segmentStart) % Math.floor(rand(12, 22)) === 0) {
          target += rand(-0.4, 0.4);
        }

        const maxStep = biome === 'mountains' ? 2 : biome === 'forest' ? 1.1 : biome === 'desert' ? 0.6 : 0.4;
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

  function plantTrees(state, surfaceFluidColumns) {
    for (let tx = 4; tx < WORLD_W - 4; tx += 1) {
      const biome = state.biomeAt[tx];
      if (biome === 'lake' || biome === 'mountains' || biome === 'volcano' || biome === 'desert' || surfaceFluidColumns.has(tx)) continue;
      const treeChance = biome === 'forest' ? 0.09 : 0.01;
      if (Math.random() >= treeChance) continue;
      const s = state.surfaceAt[tx];
      if (getBlock(state, tx, s) !== BLOCK.GRASS || getBlock(state, tx, s - 1) !== BLOCK.AIR) continue;
      if (Math.abs(state.surfaceAt[tx - 1] - s) > 1 || Math.abs(state.surfaceAt[tx + 1] - s) > 1) continue;
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
    const pool = type === 'mountain_village' ? MOUNTAIN_PROFESSIONS : type === 'desert_village' ? DESERT_PROFESSIONS : PLAINS_PROFESSIONS;
    return pool[Math.floor(rand(0, pool.length))];
  }

  function prepareVillageGround(state, x0, x1, baseY, type = 'plains_village') {
    const style = getVillageStyle(type);
    for (let tx = x0; tx <= x1; tx += 1) {
      if (tx < 3 || tx >= WORLD_W - 3) continue;
      state.surfaceAt[tx] = baseY;
      state.biomeAt[tx] = type === 'desert_village' ? 'desert' : state.biomeAt[tx];
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
      setBlock(state, workX - 1, baseY - 1, BLOCK.WOOD);
      setBlock(state, workX, baseY - 1, BLOCK.WOOD);
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
    const halfW = options.halfW || (role === 'guard' ? 3 : village.type === 'mountain_village' ? Math.floor(rand(4, 6)) : Math.floor(rand(4, 6)));
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
    const desiredCount = type === 'mountain_village' ? Math.floor(rand(6, 9)) : type === 'desert_village' ? Math.floor(rand(7, 10)) : Math.floor(rand(8, 11));
    const spacing = type === 'mountain_village' ? 16 : type === 'desert_village' ? 16 : 15;
    const minCount = type === 'mountain_village' ? 4 : type === 'desert_village' ? 5 : 6;
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
    const mountains = findBiomeSegments(state, 'mountains').filter((segment) => segment.end - segment.start >= 72);
    const deserts = findBiomeSegments(state, 'desert').filter((segment) => segment.end - segment.start >= 72);
    let index = 0;
    plains.sort((a, b) => (b.end - b.start) - (a.end - a.start));
    if (plains[0]) generateHumanVillage(state, plains[0], 'plains_village', index++);
    mountains.sort((a, b) => (b.end - b.start) - (a.end - a.start));
    if (mountains[0]) generateHumanVillage(state, mountains[0], 'mountain_village', index++);
    deserts.sort((a, b) => (b.end - b.start) - (a.end - a.start));
    if (deserts[0]) generateHumanVillage(state, deserts[0], 'desert_village', index++);
    if (plains[1]) generateHumanVillage(state, plains[1], 'plains_village', index++);
  }

  function chooseSpawnColumn(state, blockedColumns) {
    for (let tx = 20; tx < WORLD_W - 5; tx += 1) {
      const biome = state.biomeAt[tx];
      if (blockedColumns.has(tx) || biome === 'mountains' || biome === 'volcano') continue;
      if ((state.humanSettlements.villages || []).some((village) => tx >= village.bounds.x0 && tx <= village.bounds.x1)) continue;
      if (state.firePyramid && state.firePyramid.bounds && tx >= state.firePyramid.bounds.x0 && tx <= state.firePyramid.bounds.x1) continue;
      const surfaceBlock = getBlock(state, tx, state.surfaceAt[tx]);
      if (surfaceBlock !== BLOCK.GRASS && surfaceBlock !== BLOCK.SAND) continue;
      if (Math.abs(state.surfaceAt[tx] - state.surfaceAt[tx - 1]) > 1) continue;
      if (Math.abs(state.surfaceAt[tx] - state.surfaceAt[tx + 1]) > 1) continue;
      return tx;
    }
    return 20;
  }

  function generateWorld(state) {
    const basins = [];
    const surfaceFluidColumns = new Set();
    state.spiders.length = 0;
    state.humans.length = 0;
    state.dwarves.length = 0;
    state.doors = {};
    state.fireCaves = { region: null, shrine: null };
    state.firePyramid = null;
    state.fireBoss = null;
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
    for (const segment of volcanoSegments) carveVolcanoCore(state, segment);
    generateCoalOre(state);
    generateIronOre(state);
    generateGoldOre(state);
    generateDeepOre(state);
    for (const basin of basins) fillSurfaceBasin(state, basin);
    plantTrees(state, surfaceFluidColumns);
    reinforceSurfaceLayer(state, surfaceFluidColumns);
    removeFloatingDebris(state);
    reinforceSurfaceLayer(state, surfaceFluidColumns);
    carveCaveEntrances(state, surfaceFluidColumns, Math.floor(rand(6, 10)));
    generateVillages(state);
    generateFirePyramid(state);
    plantDesertFlora(state, surfaceFluidColumns);

    for (let tx = 0; tx < WORLD_W; tx += 1) setBlock(state, tx, WORLD_H - 1, BLOCK.BEDROCK);

    const spawnX = chooseSpawnColumn(state, surfaceFluidColumns);
    state.player.x = spawnX * TILE;
    state.player.y = (state.surfaceAt[spawnX] - 3) * TILE;
  }

  Game.generation = { generateWorld, retrofitWorldFeatures, checkFireShrineActivation };
})();
