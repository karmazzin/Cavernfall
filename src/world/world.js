(() => {
  const Game = window.MC2D;
  const { WORLD_H, WORLD_W, TILE } = Game.constants;
  const { BLOCK } = Game.blocks;

  function createGrid() {
    return Array.from({ length: WORLD_H }, () => Array(WORLD_W).fill(BLOCK.AIR));
  }

  function blockSolid(id) {
    return id !== BLOCK.AIR && id !== BLOCK.WATER && id !== BLOCK.LAVA && id !== BLOCK.COBWEB;
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
    return blockSolid(getBlock(state, tx, ty));
  }

  function getLocationInfo(state, tx, ty) {
    const safeTx = Math.max(0, Math.min(WORLD_W - 1, tx));
    const surfaceY = state.surfaceAt[safeTx];
    const block = getBlock(state, tx, ty);
    const airLike = block === BLOCK.AIR || block === BLOCK.COBWEB || liquid(block);
    const inCave = ty >= surfaceY + 8 && airLike;
    return {
      biome: inCave ? 'cave' : state.biomeAt[safeTx],
      inCave,
      surfaceY,
    };
  }

  Game.world = { createGrid, blockSolid, liquid, getBlock, setBlock, isSolidAtPixel, getLocationInfo };
})();
