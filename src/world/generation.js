(() => {
  const Game = window.MC2D;
  const { TILE, WORLD_H, WORLD_W, SURFACE_BASE, ANIMAL_SPAWN_ATTEMPTS, MAX_ZOMBIES } = Game.constants;
  const { BLOCK } = Game.blocks;
  const { rand, clamp } = Game.math;
  const { getBlock, setBlock, liquid } = Game.world;

  function generateWorld(state) {
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

    for (let tx = 8; tx < WORLD_W - 8; tx += 1) {
      const roll = Math.random();
      if (roll < 0.014) {
        const s = state.surfaceAt[tx];
        const width = Math.floor(rand(3, 7));
        for (let xx = 0; xx < width; xx += 1) {
          for (let yy = 0; yy < 2; yy += 1) setBlock(state, tx + xx, s - yy, BLOCK.WATER);
        }
      } else if (roll > 0.997) {
        const s = state.surfaceAt[tx];
        const width = Math.floor(rand(2, 5));
        for (let xx = 0; xx < width; xx += 1) {
          for (let yy = 0; yy < 2; yy += 1) setBlock(state, tx + xx, s - yy, BLOCK.LAVA);
        }
      }
    }

    for (let i = 0; i < 90; i += 1) {
      const tx = Math.floor(rand(6, WORLD_W - 9));
      const ty = Math.floor(rand(45, WORLD_H - 7));
      const id = Math.random() < 0.72 ? BLOCK.WATER : BLOCK.LAVA;
      const radius = id === BLOCK.WATER ? Math.floor(rand(2, 5)) : Math.floor(rand(1, 4));
      for (let yy = -radius; yy <= radius; yy += 1) {
        for (let xx = -radius; xx <= radius; xx += 1) {
          if (xx * xx + yy * yy <= radius * radius) {
            const nx = tx + xx;
            const ny = ty + yy;
            const current = getBlock(state, nx, ny);
            if (current === BLOCK.AIR || current === BLOCK.STONE) setBlock(state, nx, ny, id);
          }
        }
      }
    }

    for (let tx = 0; tx < WORLD_W; tx += 1) setBlock(state, tx, WORLD_H - 1, BLOCK.BEDROCK);

    const spawnX = 20;
    state.player.x = spawnX * TILE;
    state.player.y = (state.surfaceAt[spawnX] - 3) * TILE;
  }

  Game.generation = { generateWorld };
})();
