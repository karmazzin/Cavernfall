(() => {
  const Game = window.MC2D;
  const { TILE, WORLD_H, WORLD_W, SURFACE_BASE } = Game.constants;
  const { BLOCK } = Game.blocks;
  const { rand, clamp } = Game.math;
  const { getBlock, setBlock } = Game.world;

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

    for (let ty = 35; ty < WORLD_H - 2; ty += 1) {
      for (let tx = 2; tx < WORLD_W - 2; tx += 1) {
        const caveChance = 0.03 + (ty / WORLD_H) * 0.11;
        if (Math.random() < caveChance) {
          const radius = ty > 80 ? Math.floor(rand(1, 5)) : Math.floor(rand(1, 4));
          for (let yy = -radius; yy <= radius; yy += 1) {
            for (let xx = -radius; xx <= radius; xx += 1) {
              if (xx * xx + yy * yy <= radius * radius + 1) {
                const nx = tx + xx;
                const ny = ty + yy;
                if (ny < WORLD_H - 1 && getBlock(state, nx, ny) !== BLOCK.BEDROCK) {
                  setBlock(state, nx, ny, BLOCK.AIR);
                }
              }
            }
          }
        }
      }
    }

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

    for (const basin of basins) fillSurfaceBasin(state, basin);

    for (let tx = 0; tx < WORLD_W; tx += 1) setBlock(state, tx, WORLD_H - 1, BLOCK.BEDROCK);

    let spawnX = 20;
    while (spawnX < WORLD_W - 2 && surfaceFluidColumns.has(spawnX)) spawnX += 1;
    state.player.x = spawnX * TILE;
    state.player.y = (state.surfaceAt[spawnX] - 3) * TILE;
  }

  Game.generation = { generateWorld };
})();
