(() => {
  const Game = window.MC2D;
  const { TILE, WORLD_H, WORLD_W } = Game.constants;
  const { BLOCK } = Game.blocks;
  const { getBlock, setBlock, liquid, blockSolid } = Game.world;
  const BURNABLE = new Set([BLOCK.WOOD, BLOCK.SPRUCE_WOOD, BLOCK.LEAF, BLOCK.SPRUCE_LEAF, BLOCK.PLANK]);

  function igniteNeighbors(state, tx, ty) {
    const neighbors = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    for (const [dx, dy] of neighbors) {
      const nx = tx + dx;
      const ny = ty + dy;
      if (BURNABLE.has(getBlock(state, nx, ny))) setBlock(state, nx, ny, BLOCK.AIR);
    }
  }

  function hasNearbyFriendshipAmulet(state, tx, ty, radius = 6) {
    for (let yy = ty - radius; yy <= ty + radius; yy += 1) {
      for (let xx = tx - radius; xx <= tx + radius; xx += 1) {
        if (getBlock(state, xx, yy) !== BLOCK.FRIENDSHIP_AMULET) continue;
        if (Math.hypot(xx - tx, yy - ty) <= radius) return true;
      }
    }
    return false;
  }

  function createFriendshipOre(state, x0, y0, x1, y1) {
    setBlock(state, x0, y0, BLOCK.FRIENDSHIP_ORE);
    setBlock(state, x1, y1, BLOCK.FRIENDSHIP_ORE);
    if (Game.achievementsSystem) Game.achievementsSystem.recordEvent(state, 'create_friendship_ore');
  }

  function reactFluidsAt(state, tx, ty) {
    const id = getBlock(state, tx, ty);
    if (!liquid(id)) return;

    const neighbors = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    for (const [dx, dy] of neighbors) {
      const other = getBlock(state, tx + dx, ty + dy);
      if ((id === BLOCK.WATER && other === BLOCK.LAVA) || (id === BLOCK.LAVA && other === BLOCK.WATER)) {
        if (hasNearbyFriendshipAmulet(state, tx, ty) || hasNearbyFriendshipAmulet(state, tx + dx, ty + dy)) createFriendshipOre(state, tx, ty, tx + dx, ty + dy);
        else {
          setBlock(state, tx, ty, BLOCK.STONE);
          setBlock(state, tx + dx, ty + dy, BLOCK.STONE);
        }
        return;
      }
    }

    if (id === BLOCK.LAVA) igniteNeighbors(state, tx, ty);
  }

  function canSpreadSideways(state, tx, ty, dx, id) {
    const side = getBlock(state, tx + dx, ty);
    const sideDown = getBlock(state, tx + dx, ty + 1);
    const supportBelow = getBlock(state, tx, ty + 1);
    const nextSupport = blockSolid(sideDown) || liquid(sideDown);
    if (side !== BLOCK.AIR) return false;
    if (!nextSupport) return false;

    if (id === BLOCK.WATER) {
      const sourceSupport = blockSolid(supportBelow) || liquid(supportBelow);
      if (!sourceSupport) return false;
    }

    const sideUp = getBlock(state, tx + dx, ty - 1);
    if (sideUp === BLOCK.AIR && sideDown === BLOCK.AIR) return false;
    return true;
  }

  function addReactionPoint(points, x, y) {
    if (x < 0 || x >= WORLD_W || y < 0 || y >= WORLD_H) return;
    points.add(`${x},${y}`);
  }

  function updateFluids(state) {
    const moves = [];
    const reactionPoints = new Set();
    const playerTx = Math.floor((state.player.x + state.player.w / 2) / TILE);
    const playerTy = Math.floor((state.player.y + state.player.h / 2) / TILE);
    const minX = Math.max(1, playerTx - 56);
    const maxX = Math.min(WORLD_W - 2, playerTx + 56);
    const minY = Math.max(1, playerTy - 42);
    const maxY = Math.min(WORLD_H - 2, playerTy + 42);

    for (let ty = maxY; ty >= minY; ty -= 1) {
      for (let tx = minX; tx <= maxX; tx += 1) {
        const id = getBlock(state, tx, ty);
        if (!liquid(id)) continue;

        addReactionPoint(reactionPoints, tx, ty);
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
          if (canSpreadSideways(state, tx, ty, dx, id)) {
            moves.push({ fromX: tx, fromY: ty, toX: tx + dx, toY: ty, id });
            break;
          }

          const side = getBlock(state, tx + dx, ty);
          const sideDown = getBlock(state, tx + dx, ty + 1);
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
          if (hasNearbyFriendshipAmulet(state, move.x, move.y)) setBlock(state, move.x, move.y, BLOCK.FRIENDSHIP_ORE);
          else setBlock(state, move.x, move.y, BLOCK.STONE);
        }
        addReactionPoint(reactionPoints, move.x, move.y);
        continue;
      }

      if (getBlock(state, move.fromX, move.fromY) === move.id && getBlock(state, move.toX, move.toY) === BLOCK.AIR) {
        setBlock(state, move.toX, move.toY, move.id);
        addReactionPoint(reactionPoints, move.fromX, move.fromY);
        addReactionPoint(reactionPoints, move.toX, move.toY);
        addReactionPoint(reactionPoints, move.toX + 1, move.toY);
        addReactionPoint(reactionPoints, move.toX - 1, move.toY);
        addReactionPoint(reactionPoints, move.toX, move.toY + 1);
        addReactionPoint(reactionPoints, move.toX, move.toY - 1);
      }
    }

    for (const point of reactionPoints) {
      const [tx, ty] = point.split(',').map(Number);
      reactFluidsAt(state, tx, ty);
    }
  }

  Game.fluids = { reactFluidsAt, updateFluids };
})();
