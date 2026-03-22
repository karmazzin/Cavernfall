(() => {
  const Game = window.MC2D;
  const { TILE, WORLD_H, WORLD_W, SURFACE_BASE } = Game.constants;
  const { BLOCK } = Game.blocks;
  const { rand, clamp } = Game.math;
  const { getBlock, setBlock } = Game.world;

  function carveCircle(state, cx, cy, radius, blockId = BLOCK.AIR) {
    for (let yy = -radius; yy <= radius; yy += 1) {
      for (let xx = -radius; xx <= radius; xx += 1) {
        if (xx * xx + yy * yy > radius * radius + 1) continue;
        const tx = Math.round(cx + xx);
        const ty = Math.round(cy + yy);
        if (ty < 1 || ty >= WORLD_H - 1) continue;
        if (getBlock(state, tx, ty) !== BLOCK.BEDROCK) setBlock(state, tx, ty, blockId);
      }
    }
  }

  function carveTunnel(state, startX, startY, length, radius, depth = 0) {
    let x = startX;
    let y = startY;
    let angle = rand(-0.45, 0.45);
    let verticalDrift = rand(-0.08, 0.08);

    for (let step = 0; step < length; step += 1) {
      const r = Math.max(2, Math.round(radius + rand(-0.4, 0.8)));
      carveCircle(state, x, y, r);

      if (Math.random() < 0.08) carveCircle(state, x + rand(-1, 1), y + rand(-1, 1), r + 2);

      x += Math.cos(angle) * rand(1.6, 2.4);
      y += Math.sin(angle) * 1.2 + verticalDrift;
      angle += rand(-0.28, 0.28);
      verticalDrift = clamp(verticalDrift + rand(-0.04, 0.04), -0.18, 0.18);
      y = clamp(y, 34, WORLD_H - 12);
      x = clamp(x, 4, WORLD_W - 5);

      if (depth < 1 && step > 10 && Math.random() < 0.045) {
        carveTunnel(state, x, y + rand(-3, 3), Math.floor(length * rand(0.35, 0.55)), Math.max(2, radius - 1), depth + 1);
      }
    }
  }

  function carveConnectedCaves(state) {
    const networkCount = Math.floor(rand(24, 34));
    for (let i = 0; i < networkCount; i += 1) {
      const tx = Math.floor(rand(8, WORLD_W - 9));
      const biome = state.biomeAt[tx];
      const extraDepth = biome === 'mountains' ? rand(10, 20) : biome === 'volcano' ? rand(12, 24) : rand(12, 22);
      const ty = Math.max(36, state.surfaceAt[tx] + Math.floor(extraDepth));
      carveTunnel(state, tx, ty, Math.floor(rand(26, 58)), Math.floor(rand(2, 4)));
    }

    for (let i = 0; i < 18; i += 1) {
      const tx = Math.floor(rand(10, WORLD_W - 11));
      const ty = Math.floor(rand(44, WORLD_H - 16));
      carveCircle(state, tx, ty, Math.floor(rand(3, 7)));
    }
  }

  function generateCoalOre(state) {
    const veinCount = Math.floor(rand(150, 230));
    for (let i = 0; i < veinCount; i += 1) {
      const tx = Math.floor(rand(8, WORLD_W - 9));
      const ty = Math.floor(rand(20, WORLD_H - 14));
      const biome = state.biomeAt[tx];
      const hostBlock = biome === 'volcano' ? BLOCK.BLACKSTONE : BLOCK.STONE;
      if (getBlock(state, tx, ty) !== hostBlock) continue;

      const nearCave =
        getBlock(state, tx + 1, ty) === BLOCK.AIR ||
        getBlock(state, tx - 1, ty) === BLOCK.AIR ||
        getBlock(state, tx, ty + 1) === BLOCK.AIR ||
        getBlock(state, tx, ty - 1) === BLOCK.AIR;

      const richBiome = biome === 'mountains' || biome === 'volcano';
      if (!nearCave && Math.random() < (richBiome ? 0.3 : 0.68)) continue;

      const veinSize = Math.floor(rand(richBiome ? 5 : 4, richBiome ? 11 : 9));
      let x = tx;
      let y = ty;
      for (let j = 0; j < veinSize; j += 1) {
        if (getBlock(state, x, y) === hostBlock) setBlock(state, x, y, BLOCK.COAL_ORE);
        x = clamp(x + Math.floor(rand(-1, 2)), 4, WORLD_W - 5);
        y = clamp(y + Math.floor(rand(-1, 2)), 12, WORLD_H - 6);
      }
    }
  }

  function generateGoldOre(state) {
    const veinCount = Math.floor(rand(92, 144));
    for (let i = 0; i < veinCount; i += 1) {
      const tx = Math.floor(rand(8, WORLD_W - 9));
      const ty = Math.floor(rand(32, WORLD_H - 16));
      const biome = state.biomeAt[tx];
      const hostBlock = biome === 'volcano' ? BLOCK.BLACKSTONE : BLOCK.STONE;
      if (getBlock(state, tx, ty) !== hostBlock) continue;

      const nearCave =
        getBlock(state, tx + 1, ty) === BLOCK.AIR ||
        getBlock(state, tx - 1, ty) === BLOCK.AIR ||
        getBlock(state, tx, ty + 1) === BLOCK.AIR ||
        getBlock(state, tx, ty - 1) === BLOCK.AIR;
      if (!nearCave && Math.random() < 0.9) continue;

      const veinSize = Math.floor(rand(3, 7));
      let x = tx;
      let y = ty;
      for (let j = 0; j < veinSize; j += 1) {
        if (getBlock(state, x, y) === hostBlock) setBlock(state, x, y, BLOCK.GOLD_ORE);
        x = clamp(x + Math.floor(rand(-1, 2)), 4, WORLD_W - 5);
        y = clamp(y + Math.floor(rand(-1, 2)), 18, WORLD_H - 6);
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

  function retrofitWorldFeatures(state) {
    if (countBlockInWorld(state, BLOCK.GOLD_ORE) === 0) generateGoldOre(state);
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

  function buildMineshaft(state, startX, topY, length) {
    const endX = Math.min(WORLD_W - 5, startX + length);
    const ceilingY = topY;
    const floorY = topY + 5;

    for (let tx = startX; tx <= endX; tx += 1) {
      setBlock(state, tx, ceilingY, BLOCK.PLANK);
      setBlock(state, tx, floorY, BLOCK.PLANK);
      for (let ty = ceilingY + 1; ty <= floorY - 1; ty += 1) setBlock(state, tx, ty, BLOCK.AIR);

      if (tx % 7 === 0) {
        setBlock(state, tx, ceilingY + 1, BLOCK.COBWEB);
        if (Math.random() < 0.6) setBlock(state, tx, ceilingY + 2, BLOCK.COBWEB);
      } else if (Math.random() < 0.08) {
        setBlock(state, tx, ceilingY + 1 + Math.floor(rand(0, 3)), BLOCK.COBWEB);
      }
    }

    for (let tx = startX + 3; tx <= endX - 3; tx += 6) addSpider(state, tx, ceilingY + 3);
  }

  function isRockLike(blockId) {
    return blockId === BLOCK.STONE || blockId === BLOCK.BLACKSTONE || blockId === BLOCK.DIRT || blockId === BLOCK.GRASS || blockId === BLOCK.COAL_ORE || blockId === BLOCK.GOLD_ORE;
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
    if (topY < 18 || topY > WORLD_H - 14) return false;
    const around = countSolidNeighbors(state, tx, topY + 2, 4, 3);
    return around.solid / around.total >= 0.68;
  }

  function carveMineCell(state, tx, topY, withSupport = false) {
    const ceilingY = topY;
    const floorY = topY + 5;

    for (let ty = ceilingY + 1; ty <= floorY - 1; ty += 1) setBlock(state, tx, ty, BLOCK.AIR);
    setBlock(state, tx, ceilingY, BLOCK.PLANK);
    setBlock(state, tx, floorY, BLOCK.PLANK);

    if (withSupport) {
      setBlock(state, tx - 1, ceilingY + 1, BLOCK.PILLAR);
      setBlock(state, tx - 1, floorY - 1, BLOCK.PILLAR);
      setBlock(state, tx + 1, ceilingY + 1, BLOCK.PILLAR);
      setBlock(state, tx + 1, floorY - 1, BLOCK.PILLAR);
      for (let ty = ceilingY + 1; ty <= floorY - 1; ty += 1) {
        setBlock(state, tx - 1, ty, BLOCK.PILLAR);
        setBlock(state, tx + 1, ty, BLOCK.PILLAR);
      }
    }

    if (Math.random() < 0.18) setBlock(state, tx, ceilingY + 1 + Math.floor(rand(0, 3)), BLOCK.COBWEB);
  }

  function carveVerticalMineEntrance(state, centerX, surfaceY, topY) {
    const shaftHalfWidth = 1;
    for (let ty = surfaceY - 1; ty <= topY + 4; ty += 1) {
      for (let tx = centerX - shaftHalfWidth; tx <= centerX + shaftHalfWidth; tx += 1) {
        setBlock(state, tx, ty, BLOCK.AIR);
      }
      setBlock(state, centerX, ty, BLOCK.LADDER);

      if ((ty - surfaceY) % 5 === 0) {
        setBlock(state, centerX - 2, ty, BLOCK.PILLAR);
        setBlock(state, centerX + 2, ty, BLOCK.PILLAR);
        for (let tx = centerX - 2; tx <= centerX + 2; tx += 1) {
          if (tx < centerX - 1 || tx > centerX + 1) setBlock(state, tx, ty + 1, BLOCK.PILLAR);
        }
      }
    }

    for (let tx = centerX - 2; tx <= centerX + 2; tx += 1) carveMineCell(state, tx, topY, false);
  }

  function carveLadderShaft(state, centerX, minY, maxY) {
    for (let ty = minY; ty <= maxY; ty += 1) {
      for (let tx = centerX - 1; tx <= centerX + 1; tx += 1) setBlock(state, tx, ty, BLOCK.AIR);
      setBlock(state, centerX, ty, BLOCK.LADDER);

      if ((ty - minY) % 5 === 0) {
        setBlock(state, centerX - 2, ty, BLOCK.PILLAR);
        setBlock(state, centerX + 2, ty, BLOCK.PILLAR);
        setBlock(state, centerX - 2, ty + 1, BLOCK.PILLAR);
        setBlock(state, centerX + 2, ty + 1, BLOCK.PILLAR);
      }
    }
  }

  function carveMineConnector(state, tx, fromTopY, toTopY) {
    const minY = Math.min(fromTopY, toTopY) - 1;
    const maxY = Math.max(fromTopY, toTopY) + 6;
    carveLadderShaft(state, tx, minY, maxY);
  }

  function buildCurvedMineshaft(state, startX, topY, length, direction, depth = 0) {
    let x = startX;
    let y = topY;
    let carved = 0;
    let segmentSinceSupport = 0;
    const maxLength = Math.min(length, 120);

    while (carved < maxLength) {
      if (x < 5 || x >= WORLD_W - 5 || y < 18 || y >= WORLD_H - 12) break;

      const density = countSolidNeighbors(state, x, y + 2, 3, 2);
      if (density.solid / density.total < 0.58 && carved > 14) break;

      const support = segmentSinceSupport >= 6;
      carveMineCell(state, x, y, support);
      if (support) segmentSinceSupport = 0;
      else segmentSinceSupport += 1;

      if (carved > 4 && carved % 7 === 0 && Math.random() < 0.45) addSpider(state, x, y + 3);

      if (Math.random() < 0.14) {
        const cobwebY = y + 1 + Math.floor(rand(0, 3));
        setBlock(state, x + direction, cobwebY, BLOCK.COBWEB);
      }

      x += direction;
      if (Math.random() < 0.18) y += Math.random() < 0.5 ? -1 : 1;
      y = clamp(y, 18, WORLD_H - 12);

      if (depth < 2 && carved > 10 && carved % 12 === 0 && Math.random() < 0.42) {
        const branchTopY = clamp(y + (Math.random() < 0.5 ? -6 : 6), 18, WORLD_H - 16);
        const branchDensity = countSolidNeighbors(state, x, branchTopY + 2, 3, 2);
        if (branchDensity.solid / branchDensity.total >= 0.55) {
          carveMineConnector(state, x, y, branchTopY);
          buildCurvedMineshaft(
            state,
            x + direction,
            branchTopY,
            Math.floor(length * rand(0.5, 0.82)),
            Math.random() < 0.8 ? direction : -direction,
            depth + 1
          );
        }
      }
      carved += 1;
    }

    return carved;
  }

  function generateMineEntranceShafts(state, blockedColumns) {
    const target = Math.floor(rand(2, 4));
    let built = 0;
    let attempts = 0;

    while (built < target && attempts < 220) {
      attempts += 1;
      const tx = Math.floor(rand(12, WORLD_W - 13));
      const biome = state.biomeAt[tx];
      if (biome === 'volcano') continue;
      if (blockedColumns.has(tx) || blockedColumns.has(tx - 1) || blockedColumns.has(tx + 1)) continue;

      const surfaceY = state.surfaceAt[tx];
      const topY = clamp(surfaceY + Math.floor(rand(12, 22)), 22, WORLD_H - 20);
      if (!canHostMineRoom(state, tx, topY)) continue;

      const direction = Math.random() < 0.5 ? -1 : 1;
      const carved = buildCurvedMineshaft(state, tx + direction * 2, topY, Math.floor(rand(72, 120)), direction);
      if (carved < 18) continue;

      carveVerticalMineEntrance(state, tx, surfaceY, topY);
      built += 1;
    }

    if (built === 0) {
      const fallbackX = Math.floor(rand(20, WORLD_W - 21));
      const surfaceY = state.surfaceAt[fallbackX];
      const topY = clamp(surfaceY + 16, 24, WORLD_H - 22);
      carveVerticalMineEntrance(state, fallbackX, surfaceY, topY);
      buildCurvedMineshaft(state, fallbackX + 2, topY, 96, 1);
    }
  }

  function generateMineshafts(state) {
    const shaftCount = Math.floor(rand(4, 7));
    let attempts = 0;
    let built = 0;

    while (attempts < 220 && built < shaftCount) {
      attempts += 1;
      const length = Math.floor(rand(72, 128));
      const sampleX = Math.floor(rand(16, WORLD_W - 17));
      const biome = state.biomeAt[sampleX];
      if (biome === 'volcano') continue;

      const topY = Math.max(state.surfaceAt[sampleX] + 12, Math.floor(rand(42, WORLD_H - 24)));
      if (!canHostMineRoom(state, sampleX, topY)) continue;

      const direction = Math.random() < 0.5 ? -1 : 1;
      const carved = buildCurvedMineshaft(state, sampleX, topY, length, direction);
      if (carved < 20) continue;
      built += 1;
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
        const blend = biome === 'mountains' ? 2 : biome === 'forest' ? 3 : 4;
        next[tx] = clamp(Math.round((mid * blend + avg) / (blend + 1)), 6, 44);
      }
      state.surfaceAt = next;
    }
  }

  function flattenPlains(state) {
    let tx = 0;
    while (tx < WORLD_W) {
      const biome = state.biomeAt[tx];
      if (biome !== 'plains') {
        tx += 1;
        continue;
      }

      const start = tx;
      while (tx < WORLD_W && state.biomeAt[tx] === 'plains') tx += 1;
      const end = tx - 1;
      const len = end - start + 1;
      if (len < 18) continue;

      let cursor = start;
      while (cursor <= end) {
        const plateauLen = Math.min(end - cursor + 1, Math.floor(rand(8, 18)));
        const base = state.surfaceAt[Math.min(end, cursor + Math.floor(plateauLen / 2))];
        for (let px = cursor; px < cursor + plateauLen; px += 1) {
          const offset = px - cursor;
          const edgeOffset = offset === 0 || px === cursor + plateauLen - 1 ? Math.round(rand(0, 1)) : 0;
          const micro = offset > 0 && offset < plateauLen - 1 && Math.random() < 0.25 ? Math.round(rand(-1, 2)) : 0;
          state.surfaceAt[px] = clamp(base + edgeOffset + micro, 20, 37);
        }
        cursor += plateauLen;
      }
    }
  }

  function addPlainMicroRelief(state) {
    for (let tx = 3; tx < WORLD_W - 3; tx += 1) {
      if (state.biomeAt[tx] !== 'plains') continue;
      if (Math.random() < 0.78) continue;

      const prev = state.surfaceAt[tx - 1];
      const next = state.surfaceAt[tx + 1];
      const localMin = Math.min(prev, next);
      const localMax = Math.max(prev, next);
      const bump = Math.random() < 0.5 ? -1 : 1;
      state.surfaceAt[tx] = clamp(state.surfaceAt[tx] + bump, localMin - 1, localMax + 1);
    }
  }

  function applyVolcanoSegment(state, start, end) {
    const volcanoStart = clamp(start, 0, WORLD_W - 1);
    const volcanoEnd = clamp(end, volcanoStart + 1, WORLD_W - 1);
    const volcanoCenter = (volcanoStart + volcanoEnd) / 2;
    const volcanoHalf = Math.max(1, (volcanoEnd - volcanoStart) / 2);
    const volcanoLift = rand(16, 24);

    for (let x = volcanoStart; x <= volcanoEnd; x += 1) {
      const t = Math.abs((x - volcanoCenter) / volcanoHalf);
      const ridge = Math.pow(Math.max(0, 1 - t), 0.42);
      const target = SURFACE_BASE - volcanoLift * ridge + rand(-0.6, 0.6);
      const prev = x > 0 ? state.surfaceAt[x - 1] : SURFACE_BASE;
      state.surfaceAt[x] = Math.round(clamp(prev + clamp(target - prev, -2.2, 2.2), 6, 24));
      state.biomeAt[x] = 'volcano';
    }
  }

  function generateBiomeBands(state) {
    let x = 0;
    let lastBiome = 'plains';

    while (x < WORLD_W) {
      let biome;
      const mountainChance = lastBiome === 'mountains' ? 0.1 : 0.16;
      if (Math.random() < mountainChance) biome = 'mountains';
      else biome = Math.random() < 0.36 ? 'forest' : 'plains';

      let segLen = Math.floor(rand(90, 180));
      if (biome === 'mountains') segLen = Math.floor(rand(70, 130));
      if (biome === 'forest') segLen = Math.floor(rand(72, 140));

      const segmentStart = x;
      const segmentEnd = Math.min(WORLD_W - 1, x + segLen - 1);
      const center = (segmentStart + segmentEnd) / 2;
      const half = Math.max(1, (segmentEnd - segmentStart) / 2);
      const peakLift = biome === 'mountains' ? rand(12, 20) : biome === 'forest' ? rand(1, 3) : rand(0, 1.4);
      const segmentBase = biome === 'plains' ? SURFACE_BASE + rand(-0.8, 0.8) : SURFACE_BASE + rand(-1.5, 1.5);

      for (; x <= segmentEnd; x += 1) {
        const prev = x > 0 ? state.surfaceAt[x - 1] : SURFACE_BASE;
        let target = segmentBase;

        if (biome === 'mountains') {
          const t = Math.abs((x - center) / half);
          const ridge = Math.pow(Math.max(0, 1 - t), 0.5);
          target = SURFACE_BASE - peakLift * ridge + rand(-0.8, 0.8);
        } else if (biome === 'forest') {
          target += Math.sin((x - segmentStart) / 9) * 1.4 + rand(-0.6, 0.6);
        } else if ((x - segmentStart) % Math.floor(rand(12, 24)) === 0) {
          target += rand(-0.6, 0.6);
        }

        const maxStep = biome === 'mountains' ? 2 : biome === 'forest' ? 1.2 : 0.35;
        state.surfaceAt[x] = Math.round(clamp(prev + clamp(target - prev, -maxStep, maxStep), biome === 'mountains' ? 8 : 20, biome === 'mountains' ? 30 : 38));
        state.biomeAt[x] = biome;
      }

      if (biome === 'mountains' && Math.random() < 0.22) {
        const volcanoLen = Math.min(WORLD_W - x, Math.floor(rand(28, 52)));
        if (volcanoLen >= 24) {
          const volcanoStart = x;
          const volcanoEnd = Math.min(WORLD_W - 1, x + volcanoLen - 1);
          applyVolcanoSegment(state, volcanoStart, volcanoEnd);
          x = volcanoEnd + 1;
        }
      }

      lastBiome = biome;
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
      if (end - start + 1 >= 42) mountainSegments.push({ start, end });
    }

    if (mountainSegments.length > 0) {
      const host = mountainSegments[Math.floor(rand(0, mountainSegments.length))];
      const maxWidth = Math.min(46, host.end - host.start + 1);
      const minWidth = Math.min(28, maxWidth);
      const width = Math.max(24, Math.floor(rand(minWidth, maxWidth + 1)));
      const center = Math.floor((host.start + host.end) / 2);
      const start = clamp(center - Math.floor(width / 2), host.start, host.end - width + 1);
      const end = start + width - 1;
      applyVolcanoSegment(state, start, end);
      return;
    }

    const width = Math.floor(rand(30, 48));
    const center = Math.floor(rand(60, WORLD_W - 61));
    const start = clamp(center - Math.floor(width / 2), 20, WORLD_W - width - 20);
    const end = start + width - 1;
    applyVolcanoSegment(state, start, end);
  }

  function shapeVolcanoes(state, volcanoSegments) {
    for (const segment of volcanoSegments) {
      const radius = Math.max(10, Math.floor((segment.end - segment.start) / 2));
      for (let tx = segment.start; tx <= segment.end; tx += 1) {
        const edge = Math.abs(tx - segment.center) / radius;
        const cone = Math.max(0, 1 - edge * edge);
        const lift = Math.round(6 * cone + 4 * Math.sqrt(cone));
        state.surfaceAt[tx] = Math.max(5, state.surfaceAt[tx] - lift);
      }

      const craterHalf = Math.max(4, Math.floor(radius * 0.25));
      for (let tx = segment.center - craterHalf; tx <= segment.center + craterHalf; tx += 1) {
        if (tx < segment.start || tx > segment.end) continue;
        const depth = craterHalf - Math.abs(tx - segment.center) + 3;
        state.surfaceAt[tx] = clamp(state.surfaceAt[tx] + depth, 6, 26);
      }
    }
  }

  function fillTerrain(state) {
    for (let tx = 0; tx < WORLD_W; tx += 1) {
      const s = state.surfaceAt[tx];
      const biome = state.biomeAt[tx];
      for (let ty = s; ty < WORLD_H; ty += 1) {
        if (ty === WORLD_H - 1) {
          state.world[ty][tx] = BLOCK.BEDROCK;
        } else if (biome === 'mountains') {
          state.world[ty][tx] = BLOCK.STONE;
        } else if (biome === 'volcano') {
          state.world[ty][tx] = BLOCK.BLACKSTONE;
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

  function carveVolcanoCore(state, segment) {
    const center = segment.center;
    const mouthWidth = Math.max(5, Math.floor((segment.end - segment.start) * 0.15));
    const topY = state.surfaceAt[center] + 1;
    const bottomY = clamp(topY + Math.floor(rand(34, 50)), topY + 22, WORLD_H - 8);

    for (let ty = topY; ty <= bottomY; ty += 1) {
      const progress = (ty - topY) / Math.max(1, bottomY - topY);
      const width = Math.round(mouthWidth + progress * 4 + Math.sin(progress * Math.PI) * 5);
      for (let tx = center - width; tx <= center + width; tx += 1) {
        if (tx < 2 || tx >= WORLD_W - 2) continue;
        setBlock(state, tx, ty, BLOCK.AIR);
      }
    }

    const lavaTop = bottomY - Math.floor(rand(10, 16));
    for (let ty = lavaTop; ty <= bottomY; ty += 1) {
      const progress = (ty - topY) / Math.max(1, bottomY - topY);
      const width = Math.round(mouthWidth + progress * 4 + Math.sin(progress * Math.PI) * 5) - 1;
      for (let tx = center - width; tx <= center + width; tx += 1) {
        if (tx < 2 || tx >= WORLD_W - 2) continue;
        setBlock(state, tx, ty, BLOCK.LAVA);
      }
    }

    for (let tx = segment.start; tx <= segment.end; tx += 1) {
      if (Math.abs(tx - center) < mouthWidth + 1) continue;
      if (Math.random() < 0.06) {
        const pocketY = clamp(state.surfaceAt[tx] + Math.floor(rand(2, 7)), 8, WORLD_H - 10);
        carveCircle(state, tx, pocketY, Math.floor(rand(1, 3)), BLOCK.LAVA);
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
    const leftRim = original[0];
    const rightRim = original[original.length - 1];
    const rimDelta = Math.abs(leftRim - rightRim);
    if (rimDelta > 3) return null;

    for (let tx = x0; tx <= x1; tx += 1) {
      const edgeDistance = Math.abs(tx - center) / Math.max(1, radius);
      const curve = 1 - edgeDistance * edgeDistance;
      const carve = Math.max(0, Math.round(depth * curve));
      state.surfaceAt[tx] = clamp(state.surfaceAt[tx] + carve, 18, 42);
    }

    const liquidTop = Math.min(leftRim, rightRim);
    const filledColumns = [];
    for (let tx = x0 + 1; tx <= x1 - 1; tx += 1) {
      if (state.surfaceAt[tx] - 2 >= liquidTop) filledColumns.push(tx);
    }

    if (filledColumns.length < 4) return null;
    return { type: options.type, x0, x1, liquidTop, filledColumns, stable: !hasLeakPath(state, x0, x1, liquidTop) };
  }

  function fillSurfaceBasin(state, basin) {
    if (!basin.stable) return;
    const fluidId = basin.type === 'water' ? BLOCK.WATER : BLOCK.LAVA;
    for (const tx of basin.filledColumns) {
      for (let ty = basin.liquidTop; ty < state.surfaceAt[tx] - 1; ty += 1) setBlock(state, tx, ty, fluidId);
      if (basin.type === 'water') state.biomeAt[tx] = 'lake';
    }
  }

  function carveFallbackBasin(state, type) {
    const attempts = 48;
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      const center = Math.floor(rand(12, WORLD_W - 12));
      if (state.biomeAt[center] !== 'plains' && state.biomeAt[center] !== 'forest') continue;

      const radius = type === 'water' ? Math.floor(rand(4, 8)) : Math.floor(rand(3, 5));
      const depth = type === 'water' ? Math.floor(rand(2, 4)) : Math.floor(rand(2, 3));
      const x0 = center - radius;
      const x1 = center + radius;
      let valid = true;
      for (let tx = x0; tx <= x1; tx += 1) {
        if (tx < 3 || tx >= WORLD_W - 3) {
          valid = false;
          break;
        }
        const biome = state.biomeAt[tx];
        if (biome !== 'plains' && biome !== 'forest') {
          valid = false;
          break;
        }
      }
      if (!valid) continue;

      const rim = Math.round((state.surfaceAt[x0] + state.surfaceAt[x1]) / 2);
      for (let tx = x0; tx <= x1; tx += 1) {
        const dist = Math.abs(tx - center) / Math.max(1, radius);
        const carve = Math.max(0, Math.round(depth * (1 - dist * dist)));
        state.surfaceAt[tx] = clamp(Math.max(state.surfaceAt[tx], rim + carve), 18, 42);
      }

      const liquidTop = rim;
      const filledColumns = [];
      for (let tx = x0 + 1; tx <= x1 - 1; tx += 1) {
        if (state.surfaceAt[tx] - 2 >= liquidTop) filledColumns.push(tx);
      }
      if (filledColumns.length < 3) continue;
      return { type, x0, x1, liquidTop, filledColumns, stable: true };
    }
    return null;
  }

  function removeFloatingDebris(state) {
    for (let ty = 6; ty < WORLD_H - 2; ty += 1) {
      for (let tx = 2; tx < WORLD_W - 2; tx += 1) {
        const id = getBlock(state, tx, ty);
        if (id !== BLOCK.STONE && id !== BLOCK.BLACKSTONE && id !== BLOCK.DIRT && id !== BLOCK.GRASS) continue;
        if (ty <= state.surfaceAt[tx] + 2) continue;
        const below = getBlock(state, tx, ty + 1);
        if (below !== BLOCK.AIR && below !== BLOCK.WATER && below !== BLOCK.LAVA) continue;
        const supportCount = [
          getBlock(state, tx - 1, ty),
          getBlock(state, tx + 1, ty),
          getBlock(state, tx, ty - 1),
        ].filter((block) => block === id || block === BLOCK.STONE || block === BLOCK.BLACKSTONE || block === BLOCK.DIRT || block === BLOCK.GRASS).length;
        if (supportCount <= 1) setBlock(state, tx, ty, BLOCK.AIR);
      }
    }
  }

  function reinforceSurfaceLayer(state, surfaceFluidColumns = null) {
    for (let tx = 0; tx < WORLD_W; tx += 1) {
      if (
        surfaceFluidColumns &&
        (surfaceFluidColumns.has(tx) || surfaceFluidColumns.has(tx - 1) || surfaceFluidColumns.has(tx + 1))
      ) continue;
      const s = state.surfaceAt[tx];
      const biome = state.biomeAt[tx];
      const surfaceBlock = getBlock(state, tx, s);
      if (surfaceBlock === BLOCK.WATER || surfaceBlock === BLOCK.LAVA) continue;

      if (biome === 'mountains') setBlock(state, tx, s, BLOCK.STONE);
      else if (biome === 'volcano') setBlock(state, tx, s, BLOCK.BLACKSTONE);
      else setBlock(state, tx, s, BLOCK.GRASS);

      const filler =
        biome === 'volcano' ? BLOCK.BLACKSTONE : biome === 'mountains' ? BLOCK.STONE : BLOCK.DIRT;

      for (let ty = s + 1; ty <= Math.min(WORLD_H - 2, s + 2); ty += 1) {
        const below = getBlock(state, tx, ty);
        if (below === BLOCK.AIR) setBlock(state, tx, ty, filler);
      }
    }
  }

  function carveEntrance(state, centerX, surfaceY, width, depth) {
    const x0 = centerX - Math.floor(width / 2);
    const x1 = centerX + Math.floor(width / 2);
    const bottomY = Math.min(WORLD_H - 8, surfaceY + depth);
    for (let ty = surfaceY - 1; ty <= bottomY; ty += 1) {
      const progress = (ty - surfaceY + 1) / Math.max(1, depth + 1);
      const halfWidth = Math.max(1, Math.round(width / 2 + Math.sin(progress * Math.PI) * 1.5));
      for (let tx = centerX - halfWidth; tx <= centerX + halfWidth; tx += 1) {
        if (tx < 2 || tx >= WORLD_W - 2) continue;
        setBlock(state, tx, ty, BLOCK.AIR);
      }
    }
    for (let tx = x0; tx <= x1; tx += 1) {
      if (tx < 2 || tx >= WORLD_W - 2) continue;
      if (getBlock(state, tx, surfaceY) !== BLOCK.WATER && getBlock(state, tx, surfaceY) !== BLOCK.LAVA) {
        setBlock(state, tx, surfaceY, BLOCK.AIR);
      }
    }
  }

  function carveCaveEntrances(state, blockedColumns, count) {
    let carved = 0;
    let attempts = 0;
    while (carved < count && attempts < 220) {
      attempts += 1;
      const tx = Math.floor(rand(8, WORLD_W - 9));
      const biome = state.biomeAt[tx];
      if (biome === 'volcano' || blockedColumns.has(tx) || blockedColumns.has(tx - 1) || blockedColumns.has(tx + 1)) continue;

      const surfaceY = state.surfaceAt[tx];
      let caveY = -1;
      for (let ty = surfaceY + 5; ty <= Math.min(WORLD_H - 10, surfaceY + 26); ty += 1) {
        const airHere = getBlock(state, tx, ty) === BLOCK.AIR;
        const airLeft = getBlock(state, tx - 1, ty) === BLOCK.AIR;
        const airRight = getBlock(state, tx + 1, ty) === BLOCK.AIR;
        if (airHere || airLeft || airRight) {
          caveY = ty;
          break;
        }
      }
      if (caveY < 0) continue;

      const width = biome === 'mountains' ? 3 : 2;
      carveEntrance(state, tx, surfaceY, width, caveY - surfaceY + 1);
      carved += 1;
    }
  }

  function plantTrees(state, surfaceFluidColumns) {
    for (let tx = 4; tx < WORLD_W - 4; tx += 1) {
      const biome = state.biomeAt[tx];
      if (biome === 'lake' || biome === 'mountains' || biome === 'volcano' || surfaceFluidColumns.has(tx)) continue;
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
          if (Math.abs(xx) + Math.abs(yy) < 4 && getBlock(state, tx + xx, topY + yy) === BLOCK.AIR) {
            setBlock(state, tx + xx, topY + yy, BLOCK.LEAF);
          }
        }
      }
    }
  }

  function chooseSpawnColumn(state, blockedColumns) {
    for (let tx = 20; tx < WORLD_W - 5; tx += 1) {
      const biome = state.biomeAt[tx];
      if (blockedColumns.has(tx)) continue;
      if (biome === 'mountains' || biome === 'volcano') continue;
      if (getBlock(state, tx, state.surfaceAt[tx]) !== BLOCK.GRASS) continue;
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

    generateBiomeBands(state);
    ensureVolcanoSegment(state);
    smoothSurface(state, 1);
    flattenPlains(state);
    addPlainMicroRelief(state);

    const detectedVolcanoes = [];
    let x = 0;
    while (x < WORLD_W) {
      if (state.biomeAt[x] !== 'volcano') {
        x += 1;
        continue;
      }
      const start = x;
      while (x < WORLD_W && state.biomeAt[x] === 'volcano') x += 1;
      const end = x - 1;
      detectedVolcanoes.push({ start, end, center: Math.floor((start + end) / 2) });
    }
    shapeVolcanoes(state, detectedVolcanoes);

    const waterBasinCount = Math.floor(rand(12, 20));
    const lavaBasinCount = Math.floor(rand(4, 7));
    for (let i = 0; i < waterBasinCount; i += 1) {
      const basin = carveSurfaceBasin(state, {
        type: 'water',
        minX: 16,
        maxX: WORLD_W - 17,
        minRadius: 6,
        maxRadius: 12,
        minDepth: 3,
        maxDepth: 6,
      });
      if (basin && basin.stable) basins.push(basin);
    }
    if (basins.filter((basin) => basin.type === 'water').length < 2) {
      const fallback = carveFallbackBasin(state, 'water');
      if (fallback) basins.push(fallback);
    }
    for (let i = 0; i < lavaBasinCount; i += 1) {
      const basin = carveSurfaceBasin(state, {
        type: 'lava',
        minX: 22,
        maxX: WORLD_W - 23,
        minRadius: 4,
        maxRadius: 7,
        minDepth: 2,
        maxDepth: 4,
      });
      if (basin && basin.stable) basins.push(basin);
    }
    if (basins.filter((basin) => basin.type === 'lava').length < 1) {
      const fallback = carveFallbackBasin(state, 'lava');
      if (fallback) basins.push(fallback);
    }
    for (const basin of basins) {
      for (const tx of basin.filledColumns) surfaceFluidColumns.add(tx);
    }

    fillTerrain(state);
    carveConnectedCaves(state);
    for (const segment of detectedVolcanoes) carveVolcanoCore(state, segment);
    generateCoalOre(state);
    generateGoldOre(state);
    generateMineshafts(state);
    generateMineEntranceShafts(state, surfaceFluidColumns);
    for (const basin of basins) fillSurfaceBasin(state, basin);
    plantTrees(state, surfaceFluidColumns);
    reinforceSurfaceLayer(state, surfaceFluidColumns);
    removeFloatingDebris(state);
    reinforceSurfaceLayer(state, surfaceFluidColumns);
    carveCaveEntrances(state, surfaceFluidColumns, Math.floor(rand(8, 14)));

    for (let tx = 0; tx < WORLD_W; tx += 1) setBlock(state, tx, WORLD_H - 1, BLOCK.BEDROCK);

    const spawnX = chooseSpawnColumn(state, surfaceFluidColumns);
    state.player.x = spawnX * TILE;
    state.player.y = (state.surfaceAt[spawnX] - 3) * TILE;
  }

  Game.generation = { generateWorld, retrofitWorldFeatures };
})();
