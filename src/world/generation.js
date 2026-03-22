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
      const ty = Math.max(34, state.surfaceAt[tx] + Math.floor(rand(10, 22)));
      carveTunnel(state, tx, ty, Math.floor(rand(24, 52)), Math.floor(rand(2, 4)));
    }

    for (let i = 0; i < 14; i += 1) {
      const tx = Math.floor(rand(10, WORLD_W - 11));
      const ty = Math.floor(rand(42, WORLD_H - 16));
      carveCircle(state, tx, ty, Math.floor(rand(3, 7)));
    }
  }

  function generateCoalOre(state) {
    const veinCount = Math.floor(rand(90, 150));
    for (let i = 0; i < veinCount; i += 1) {
      const tx = Math.floor(rand(8, WORLD_W - 9));
      const ty = Math.floor(rand(34, WORLD_H - 14));

      if (getBlock(state, tx, ty) !== BLOCK.STONE) continue;

      const nearCave =
        getBlock(state, tx + 1, ty) === BLOCK.AIR ||
        getBlock(state, tx - 1, ty) === BLOCK.AIR ||
        getBlock(state, tx, ty + 1) === BLOCK.AIR ||
        getBlock(state, tx, ty - 1) === BLOCK.AIR;

      if (!nearCave && Math.random() < 0.75) continue;

      const veinSize = Math.floor(rand(4, 9));
      let x = tx;
      let y = ty;
      for (let j = 0; j < veinSize; j += 1) {
        if (getBlock(state, x, y) === BLOCK.STONE) setBlock(state, x, y, BLOCK.COAL_ORE);
        x = clamp(x + Math.floor(rand(-1, 2)), 4, WORLD_W - 5);
        y = clamp(y + Math.floor(rand(-1, 2)), 20, WORLD_H - 6);
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
      for (let ty = ceilingY + 1; ty <= floorY - 1; ty += 1) {
        setBlock(state, tx, ty, BLOCK.AIR);
      }

      if (tx % 7 === 0) {
        setBlock(state, tx, ceilingY + 1, BLOCK.COBWEB);
        if (Math.random() < 0.6) setBlock(state, tx, ceilingY + 2, BLOCK.COBWEB);
      } else if (Math.random() < 0.08) {
        setBlock(state, tx, ceilingY + 1 + Math.floor(rand(0, 3)), BLOCK.COBWEB);
      }
    }

    for (let tx = startX + 3; tx <= endX - 3; tx += 6) {
      addSpider(state, tx, ceilingY + 3);
    }
  }

  function generateMineshafts(state) {
    const shaftCount = Math.floor(rand(3, 6));
    let attempts = 0;
    let built = 0;

    while (attempts < 160 && built < shaftCount) {
      attempts += 1;
      const length = Math.floor(rand(18, 42));
      const startX = Math.floor(rand(10, WORLD_W - length - 10));
      const sampleX = startX + Math.floor(length / 2);
      const topY = Math.max(state.surfaceAt[sampleX] + 11, Math.floor(rand(42, WORLD_H - 22)));
      const midY = topY + 2;

      if (midY >= WORLD_H - 8) continue;
      if (getBlock(state, sampleX, midY) !== BLOCK.AIR) continue;

      let underground = true;
      for (let tx = startX; tx < startX + length; tx += 4) {
        if (topY <= state.surfaceAt[tx] + 8) {
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
    const center = Math.floor(rand(options.minX, options.maxX));
    const radius = Math.floor(rand(options.minRadius, options.maxRadius));
    const depth = Math.floor(rand(options.minDepth, options.maxDepth));
    const x0 = clamp(center - radius, 3, WORLD_W - 4);
    const x1 = clamp(center + radius, 3, WORLD_W - 4);
    const original = state.surfaceAt.slice(x0, x1 + 1);

    for (let tx = x0; tx <= x1; tx += 1) {
      const edgeDistance = Math.abs(tx - center) / Math.max(1, radius);
      const curve = 1 - edgeDistance * edgeDistance;
      const carve = Math.max(0, Math.round(depth * curve));
      state.surfaceAt[tx] = clamp(state.surfaceAt[tx] + carve, 20, 42);
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
      for (let ty = basin.liquidTop; ty < state.surfaceAt[tx]; ty += 1) {
        setBlock(state, tx, ty, fluidId);
      }
      if (basin.type === 'water') state.biomeAt[tx] = 'lake';
    }
  }

  function generateWorld(state) {
    const basins = [];
    const surfaceFluidColumns = new Set();
    state.spiders.length = 0;
    let x = 0;
    let surface = SURFACE_BASE;

    while (x < WORLD_W) {
      const biome = Math.random() < 0.5 ? 'plains' : 'forest';
      const segLen = Math.floor(rand(60, 121));

      for (let i = 0; i < segLen && x < WORLD_W; i += 1, x += 1) {
        state.biomeAt[x] = biome;
        surface += Math.floor(rand(-1, 2));
        surface = clamp(surface, 20, 38);
        state.surfaceAt[x] = surface;
      }
    }

    const waterBasinCount = Math.floor(rand(6, 11));
    const lavaBasinCount = Math.floor(rand(3, 6));
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

    for (let tx = 0; tx < WORLD_W; tx += 1) {
      const s = state.surfaceAt[tx];
      for (let ty = s; ty < WORLD_H; ty += 1) {
        if (ty === s) state.world[ty][tx] = BLOCK.GRASS;
        else if (ty < s + 4) state.world[ty][tx] = BLOCK.DIRT;
        else if (ty === WORLD_H - 1) state.world[ty][tx] = BLOCK.BEDROCK;
        else state.world[ty][tx] = BLOCK.STONE;
      }
    }

    carveConnectedCaves(state);
    generateCoalOre(state);

    for (let tx = 4; tx < WORLD_W - 4; tx += 1) {
      const biome = state.biomeAt[tx];
      if (biome === 'lake' || surfaceFluidColumns.has(tx)) continue;
      const treeChance = biome === 'forest' ? 0.11 : 0.025;
      if (Math.random() < treeChance) {
        const s = state.surfaceAt[tx];
        if (getBlock(state, tx, s) === BLOCK.GRASS && getBlock(state, tx, s - 1) === BLOCK.AIR) {
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
    }

    generateMineshafts(state);
    for (const basin of basins) fillSurfaceBasin(state, basin);

    for (let tx = 0; tx < WORLD_W; tx += 1) setBlock(state, tx, WORLD_H - 1, BLOCK.BEDROCK);

    let spawnX = 20;
    while (spawnX < WORLD_W - 2 && surfaceFluidColumns.has(spawnX)) spawnX += 1;
    state.player.x = spawnX * TILE;
    state.player.y = (state.surfaceAt[spawnX] - 3) * TILE;
  }

  Game.generation = { generateWorld };
})();
