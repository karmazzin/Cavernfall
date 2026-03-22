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
      y = clamp(y, 32, WORLD_H - 12);
      x = clamp(x, 4, WORLD_W - 5);

      if (depth < 1 && step > 8 && Math.random() < 0.05) {
        carveTunnel(state, x, y + rand(-3, 3), Math.floor(length * rand(0.35, 0.55)), Math.max(2, radius - 1), depth + 1);
      }
    }
  }

  function carveConnectedCaves(state) {
    const networkCount = Math.floor(rand(18, 28));
    for (let i = 0; i < networkCount; i += 1) {
      const tx = Math.floor(rand(8, WORLD_W - 9));
      const biome = state.biomeAt[tx];
      const extraDepth = biome === 'mountains' ? rand(8, 18) : biome === 'volcano' ? rand(10, 22) : rand(10, 22);
      const ty = Math.max(34, state.surfaceAt[tx] + Math.floor(extraDepth));
      carveTunnel(state, tx, ty, Math.floor(rand(24, 52)), Math.floor(rand(2, 4)));
    }

    for (let i = 0; i < 14; i += 1) {
      const tx = Math.floor(rand(10, WORLD_W - 11));
      const ty = Math.floor(rand(42, WORLD_H - 16));
      carveCircle(state, tx, ty, Math.floor(rand(3, 7)));
    }
  }

  function generateCoalOre(state) {
    const veinCount = Math.floor(rand(110, 180));
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
      if (!nearCave && Math.random() < (richBiome ? 0.35 : 0.72)) continue;

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

  function generateMineshafts(state) {
    const shaftCount = Math.floor(rand(3, 6));
    let attempts = 0;
    let built = 0;

    while (attempts < 180 && built < shaftCount) {
      attempts += 1;
      const length = Math.floor(rand(18, 42));
      const startX = Math.floor(rand(10, WORLD_W - length - 10));
      const sampleX = startX + Math.floor(length / 2);
      const biome = state.biomeAt[sampleX];
      if (biome === 'volcano') continue;

      const topY = Math.max(state.surfaceAt[sampleX] + 11, Math.floor(rand(42, WORLD_H - 22)));
      const midY = topY + 2;
      if (midY >= WORLD_H - 8) continue;
      if (getBlock(state, sampleX, midY) !== BLOCK.AIR) continue;

      let underground = true;
      for (let tx = startX; tx < startX + length; tx += 4) {
        if (state.biomeAt[tx] === 'volcano' || topY <= state.surfaceAt[tx] + 8) {
          underground = false;
          break;
        }
      }
      if (!underground) continue;

      buildMineshaft(state, startX, topY, length);
      built += 1;
    }
  }

  function carveSurfaceBasin(state, options) {
    const allowedCenters = [];
    for (let tx = options.minX; tx <= options.maxX; tx += 1) {
      const biome = state.biomeAt[tx];
      if (biome === 'plains' || biome === 'forest') allowedCenters.push(tx);
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
    for (let tx = x0; tx <= x1; tx += 1) {
      const edgeDistance = Math.abs(tx - center) / Math.max(1, radius);
      const curve = 1 - edgeDistance * edgeDistance;
      const carve = Math.max(0, Math.round(depth * curve));
      state.surfaceAt[tx] = clamp(state.surfaceAt[tx] + carve, 18, 42);
    }

    const liquidTop = Math.min(...original) + 1;
    const filledColumns = [];
    for (let tx = x0; tx <= x1; tx += 1) {
      if (state.surfaceAt[tx] - 1 >= liquidTop) filledColumns.push(tx);
    }

    if (filledColumns.length < 3) return null;
    return { type: options.type, x0, x1, liquidTop, filledColumns };
  }

  function fillSurfaceBasin(state, basin) {
    const fluidId = basin.type === 'water' ? BLOCK.WATER : BLOCK.LAVA;
    for (const tx of basin.filledColumns) {
      for (let ty = basin.liquidTop; ty < state.surfaceAt[tx]; ty += 1) setBlock(state, tx, ty, fluidId);
      if (basin.type === 'water') state.biomeAt[tx] = 'lake';
    }
  }

  function generateBiomeBands(state) {
    const volcanoSegments = [];
    let x = 0;
    let lastBiome = 'plains';

    while (x < WORLD_W) {
      let biome;
      const mountainChance = lastBiome === 'mountains' ? 0.12 : 0.2;
      if (Math.random() < mountainChance) biome = 'mountains';
      else biome = Math.random() < 0.4 ? 'forest' : 'plains';

      let segLen = Math.floor(rand(48, 116));
      if (biome === 'mountains') segLen = Math.floor(rand(34, 76));

      const segmentStart = x;
      const segmentEnd = Math.min(WORLD_W - 1, x + segLen - 1);
      const center = (segmentStart + segmentEnd) / 2;
      const half = Math.max(1, (segmentEnd - segmentStart) / 2);
      const peakLift = biome === 'mountains' ? rand(10, 18) : rand(0, 3);

      for (; x <= segmentEnd; x += 1) {
        const t = Math.abs((x - center) / half);
        const ridge = biome === 'mountains' ? Math.pow(Math.max(0, 1 - t), 0.55) : 0;
        const target = biome === 'mountains'
          ? SURFACE_BASE - peakLift * ridge + rand(-1.2, 1.2)
          : SURFACE_BASE + rand(-2.2, 2.2);
        const prev = x > 0 ? state.surfaceAt[x - 1] : SURFACE_BASE;
        const maxStep = biome === 'mountains' ? 2.6 : 1.3;
        state.surfaceAt[x] = Math.round(clamp(prev + clamp(target - prev, -maxStep, maxStep), biome === 'mountains' ? 8 : 20, biome === 'mountains' ? 28 : 38));
        state.biomeAt[x] = biome;
      }

      if (biome === 'mountains' && Math.random() < 0.42) {
        const volcanoLen = Math.min(WORLD_W - x, Math.floor(rand(20, 42)));
        if (volcanoLen >= 16) {
          const volcanoStart = x;
          const volcanoEnd = Math.min(WORLD_W - 1, x + volcanoLen - 1);
          const volcanoCenter = (volcanoStart + volcanoEnd) / 2;
          const volcanoHalf = Math.max(1, (volcanoEnd - volcanoStart) / 2);
          const volcanoLift = rand(14, 22);

          for (; x <= volcanoEnd; x += 1) {
            const t = Math.abs((x - volcanoCenter) / volcanoHalf);
            const ridge = Math.pow(Math.max(0, 1 - t), 0.42);
            const target = SURFACE_BASE - volcanoLift * ridge + rand(-0.8, 0.8);
            const prev = x > 0 ? state.surfaceAt[x - 1] : SURFACE_BASE;
            state.surfaceAt[x] = Math.round(clamp(prev + clamp(target - prev, -2.4, 2.4), 6, 24));
            state.biomeAt[x] = 'volcano';
          }

          volcanoSegments.push({ start: volcanoStart, end: volcanoEnd, center: Math.round(volcanoCenter) });
        }
      }

      lastBiome = biome;
    }

    return volcanoSegments;
  }

  function shapeVolcanoes(state, volcanoSegments) {
    for (const segment of volcanoSegments) {
      const radius = Math.max(8, Math.floor((segment.end - segment.start) / 2));
      for (let tx = segment.start; tx <= segment.end; tx += 1) {
        const edge = Math.abs(tx - segment.center) / radius;
        const cone = Math.max(0, 1 - edge * edge);
        const lift = Math.round(6 * cone + 3 * Math.sqrt(cone));
        state.surfaceAt[tx] = Math.max(5, state.surfaceAt[tx] - lift);
      }

      const craterHalf = Math.max(3, Math.floor(radius * 0.28));
      for (let tx = segment.center - craterHalf; tx <= segment.center + craterHalf; tx += 1) {
        if (tx < segment.start || tx > segment.end) continue;
        const depth = craterHalf - Math.abs(tx - segment.center) + 2;
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
    const mouthWidth = Math.max(4, Math.floor((segment.end - segment.start) * 0.16));
    const topY = state.surfaceAt[center] + 1;
    const bottomY = clamp(topY + Math.floor(rand(30, 44)), topY + 18, WORLD_H - 8);

    for (let ty = topY; ty <= bottomY; ty += 1) {
      const progress = (ty - topY) / Math.max(1, bottomY - topY);
      const width = Math.round(mouthWidth + progress * 3 + Math.sin(progress * Math.PI) * 4);
      for (let tx = center - width; tx <= center + width; tx += 1) {
        if (tx < 2 || tx >= WORLD_W - 2) continue;
        setBlock(state, tx, ty, BLOCK.AIR);
      }
    }

    const lavaTop = bottomY - Math.floor(rand(8, 14));
    for (let ty = lavaTop; ty <= bottomY; ty += 1) {
      const progress = (ty - topY) / Math.max(1, bottomY - topY);
      const width = Math.round(mouthWidth + progress * 3 + Math.sin(progress * Math.PI) * 4) - 1;
      for (let tx = center - width; tx <= center + width; tx += 1) {
        if (tx < 2 || tx >= WORLD_W - 2) continue;
        setBlock(state, tx, ty, BLOCK.LAVA);
      }
    }

    for (let tx = segment.start; tx <= segment.end; tx += 1) {
      if (Math.abs(tx - center) < mouthWidth + 1) continue;
      if (Math.random() < 0.08) {
        const pocketY = clamp(state.surfaceAt[tx] + Math.floor(rand(2, 7)), 8, WORLD_H - 10);
        carveCircle(state, tx, pocketY, Math.floor(rand(1, 3)), BLOCK.LAVA);
      }
    }
  }

  function plantTrees(state, surfaceFluidColumns) {
    for (let tx = 4; tx < WORLD_W - 4; tx += 1) {
      const biome = state.biomeAt[tx];
      if (biome === 'lake' || biome === 'mountains' || biome === 'volcano' || surfaceFluidColumns.has(tx)) continue;
      const treeChance = biome === 'forest' ? 0.11 : 0.025;
      if (Math.random() >= treeChance) continue;

      const s = state.surfaceAt[tx];
      if (getBlock(state, tx, s) !== BLOCK.GRASS || getBlock(state, tx, s - 1) !== BLOCK.AIR) continue;

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
      return tx;
    }
    return 20;
  }

  function generateWorld(state) {
    const basins = [];
    const surfaceFluidColumns = new Set();
    state.spiders.length = 0;

    const volcanoSegments = generateBiomeBands(state);
    shapeVolcanoes(state, volcanoSegments);

    const waterBasinCount = Math.floor(rand(5, 9));
    const lavaBasinCount = Math.floor(rand(2, 4));
    for (let i = 0; i < waterBasinCount; i += 1) {
      const basin = carveSurfaceBasin(state, {
        type: 'water',
        minX: 12,
        maxX: WORLD_W - 13,
        minRadius: 4,
        maxRadius: 10,
        minDepth: 3,
        maxDepth: 6,
      });
      if (basin) basins.push(basin);
    }
    for (let i = 0; i < lavaBasinCount; i += 1) {
      const basin = carveSurfaceBasin(state, {
        type: 'lava',
        minX: 18,
        maxX: WORLD_W - 19,
        minRadius: 3,
        maxRadius: 7,
        minDepth: 2,
        maxDepth: 4,
      });
      if (basin) basins.push(basin);
    }
    for (const basin of basins) {
      for (const tx of basin.filledColumns) surfaceFluidColumns.add(tx);
    }

    fillTerrain(state);
    carveConnectedCaves(state);
    for (const segment of volcanoSegments) carveVolcanoCore(state, segment);
    generateCoalOre(state);
    plantTrees(state, surfaceFluidColumns);
    generateMineshafts(state);
    for (const basin of basins) fillSurfaceBasin(state, basin);

    for (let tx = 0; tx < WORLD_W; tx += 1) setBlock(state, tx, WORLD_H - 1, BLOCK.BEDROCK);

    const spawnX = chooseSpawnColumn(state, surfaceFluidColumns);
    state.player.x = spawnX * TILE;
    state.player.y = (state.surfaceAt[spawnX] - 3) * TILE;
  }

  Game.generation = { generateWorld };
})();
