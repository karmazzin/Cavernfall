(() => {
  const Game = window.MC2D;
  const { WORLD_H, WORLD_W } = Game.constants;
  const { BLOCK } = Game.blocks;
  const { getBlock, setBlock, liquid, blockSolid } = Game.world;

  function reactFluidsAt(state, tx, ty) {
    const id = getBlock(state, tx, ty);
    if (!liquid(id)) return;

    const neighbors = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    for (const [dx, dy] of neighbors) {
      const other = getBlock(state, tx + dx, ty + dy);
      if ((id === BLOCK.WATER && other === BLOCK.LAVA) || (id === BLOCK.LAVA && other === BLOCK.WATER)) {
        setBlock(state, tx, ty, BLOCK.STONE);
        setBlock(state, tx + dx, ty + dy, BLOCK.STONE);
        return;
      }
    }
  }

  function updateFluids(state) {
    const moves = [];

    for (let ty = WORLD_H - 2; ty >= 0; ty -= 1) {
      for (let tx = 0; tx < WORLD_W; tx += 1) {
        const id = getBlock(state, tx, ty);
        if (!liquid(id)) continue;

        reactFluidsAt(state, tx, ty);
        if (getBlock(state, tx, ty) !== id) continue;

        const below = getBlock(state, tx, ty + 1);
        if (below === BLOCK.AIR) {
          moves.push({ fromX: tx, fromY: ty, toX: tx, toY: ty + 1, id });
          continue;
        }

        if ((id === BLOCK.WATER && below === BLOCK.LAVA) || (id === BLOCK.LAVA && below === BLOCK.WATER)) {
          moves.push({ stone: true, x: tx, y: ty + 1 });
          continue;
        }

        const dirs = Math.random() < 0.5 ? [-1, 1] : [1, -1];
        for (const dx of dirs) {
          const side = getBlock(state, tx + dx, ty);
          const sideDown = getBlock(state, tx + dx, ty + 1);
          if (side === BLOCK.AIR && (blockSolid(sideDown) || liquid(sideDown))) {
            moves.push({ fromX: tx, fromY: ty, toX: tx + dx, toY: ty, id });
            break;
          }

          if ((id === BLOCK.WATER && (side === BLOCK.LAVA || sideDown === BLOCK.LAVA)) || (id === BLOCK.LAVA && (side === BLOCK.WATER || sideDown === BLOCK.WATER))) {
            moves.push({ stone: true, x: tx + dx, y: ty });
            break;
          }
        }
      }
    }

    for (const move of moves) {
      if (move.stone) {
        if (move.x >= 0 && move.x < WORLD_W && move.y >= 0 && move.y < WORLD_H - 1) {
          setBlock(state, move.x, move.y, BLOCK.STONE);
        }
        continue;
      }

      if (getBlock(state, move.fromX, move.fromY) === move.id && getBlock(state, move.toX, move.toY) === BLOCK.AIR) {
        setBlock(state, move.toX, move.toY, move.id);
      }
    }

    for (let ty = 0; ty < WORLD_H; ty += 1) {
      for (let tx = 0; tx < WORLD_W; tx += 1) reactFluidsAt(state, tx, ty);
    }
  }

  Game.fluids = { reactFluidsAt, updateFluids };
})();
