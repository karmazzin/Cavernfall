(() => {
  const Game = window.MC2D;
  const { TILE } = Game.constants;
  const { BLOCK, BLOCK_COLORS } = Game.blocks;

  function drawBlock(ctx, id, x, y) {
    ctx.fillStyle = BLOCK_COLORS[id] || '#000';
    ctx.fillRect(x, y, TILE, TILE);

    if (id === BLOCK.GRASS) {
      ctx.fillStyle = '#6bd36b';
      ctx.fillRect(x, y, TILE, 4);
    } else if (id === BLOCK.WOOD) {
      ctx.fillStyle = '#5e3717';
      ctx.fillRect(x + 6, y, 4, TILE);
    } else if (id === BLOCK.STONE) {
      ctx.fillStyle = '#999';
      ctx.fillRect(x + 3, y + 3, 3, 3);
      ctx.fillRect(x + 10, y + 8, 2, 2);
    } else if (id === BLOCK.WATER) {
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      ctx.fillRect(x, y + 2, TILE, 2);
    } else if (id === BLOCK.LAVA) {
      ctx.fillStyle = 'rgba(255,255,0,0.25)';
      ctx.fillRect(x + 2, y + 2, TILE - 4, 3);
    } else if (id === BLOCK.LEAF) {
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      ctx.fillRect(x + 3, y + 3, 3, 3);
    }
  }

  Game.worldRenderer = { drawBlock };
})();
