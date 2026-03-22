(() => {
  const Game = window.MC2D;
  const { TILE } = Game.constants;
  const { BLOCK, BLOCK_COLORS } = Game.blocks;

  function drawBlock(ctx, id, x, y, time = 0) {
    if (id !== BLOCK.TORCH) {
      ctx.fillStyle = BLOCK_COLORS[id] || '#000';
      ctx.fillRect(x, y, TILE, TILE);
    }

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
    } else if (id === BLOCK.COAL_ORE) {
      ctx.fillStyle = '#8b8b8b';
      ctx.fillRect(x, y, TILE, TILE);
      ctx.fillStyle = '#1e1e1e';
      ctx.fillRect(x + 3, y + 4, 3, 3);
      ctx.fillRect(x + 9, y + 3, 4, 4);
      ctx.fillRect(x + 7, y + 10, 3, 3);
    } else if (id === BLOCK.GOLD_ORE) {
      ctx.fillStyle = '#7f7b72';
      ctx.fillRect(x, y, TILE, TILE);
      ctx.fillStyle = '#d1b54a';
      ctx.fillRect(x + 3, y + 3, 4, 4);
      ctx.fillRect(x + 9, y + 4, 3, 3);
      ctx.fillRect(x + 7, y + 10, 4, 3);
    } else if (id === BLOCK.BLACKSTONE) {
      ctx.fillStyle = '#2f2f35';
      ctx.fillRect(x, y, TILE, TILE);
      ctx.fillStyle = '#3c3c46';
      ctx.fillRect(x + 2, y + 3, 5, 4);
      ctx.fillRect(x + 9, y + 2, 4, 3);
      ctx.fillStyle = '#1b1b20';
      ctx.fillRect(x + 5, y + 9, 6, 4);
    } else if (id === BLOCK.DEEPSTONE) {
      ctx.fillStyle = '#484f59';
      ctx.fillRect(x, y, TILE, TILE);
      ctx.fillStyle = '#5d6570';
      ctx.fillRect(x + 2, y + 2, 4, 4);
      ctx.fillRect(x + 10, y + 4, 3, 3);
      ctx.fillStyle = '#2a3037';
      ctx.fillRect(x + 6, y + 9, 5, 4);
    } else if (id === BLOCK.DEEP_ORE) {
      ctx.fillStyle = '#4a505b';
      ctx.fillRect(x, y, TILE, TILE);
      ctx.fillStyle = '#7a58b3';
      ctx.fillRect(x + 3, y + 3, 3, 4);
      ctx.fillRect(x + 9, y + 4, 4, 3);
      ctx.fillRect(x + 7, y + 10, 3, 3);
      ctx.fillStyle = 'rgba(245,236,255,0.18)';
      ctx.fillRect(x + 4, y + 4, 1, 2);
    } else if (id === BLOCK.TORCH) {
      const flicker = 0.5 + 0.5 * Math.sin(time * 9 + x * 0.17 + y * 0.11);
      const flameW = 3 + Math.round(flicker * 2);
      const flameX = x + 8 - Math.floor(flameW / 2);
      const flameY = y + 3 - Math.round(flicker);
      ctx.fillStyle = '#74451f';
      ctx.fillRect(x + 7, y + 6, 2, 8);
      ctx.fillStyle = '#986132';
      ctx.fillRect(x + 6, y + 11, 4, 2);
      ctx.fillStyle = '#ffb347';
      ctx.fillRect(flameX, flameY + 1, flameW, 4);
      ctx.fillStyle = '#ff7a21';
      ctx.fillRect(flameX + 1, flameY, Math.max(2, flameW - 2), 3);
      ctx.fillStyle = '#fff0b8';
      ctx.fillRect(x + 7, flameY + 1, 2, 2);
    } else if (id === BLOCK.WATER) {
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      ctx.fillRect(x, y + 2, TILE, 2);
    } else if (id === BLOCK.LAVA) {
      ctx.fillStyle = 'rgba(255,255,0,0.25)';
      ctx.fillRect(x + 2, y + 2, TILE - 4, 3);
    } else if (id === BLOCK.PLANK) {
      ctx.fillStyle = '#8d5d34';
      ctx.fillRect(x, y + 3, TILE, 2);
      ctx.fillRect(x, y + 8, TILE, 2);
      ctx.fillStyle = '#d0a06b';
      ctx.fillRect(x + 4, y, 1, TILE);
      ctx.fillRect(x + 10, y, 1, TILE);
    } else if (id === BLOCK.PILLAR) {
      ctx.fillStyle = '#7a4f2d';
      ctx.fillRect(x + 6, y, 4, TILE);
      ctx.fillStyle = '#c79a63';
      ctx.fillRect(x + 7, y, 1, TILE);
      ctx.fillRect(x + 9, y, 1, TILE);
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      ctx.fillRect(x + 5, y + 1, 6, 2);
    } else if (id === BLOCK.LADDER) {
      ctx.fillStyle = '#8a5a31';
      ctx.fillRect(x + 4, y, 2, TILE);
      ctx.fillRect(x + 10, y, 2, TILE);
      ctx.fillStyle = '#cf9b63';
      ctx.fillRect(x + 5, y + 3, 6, 2);
      ctx.fillRect(x + 5, y + 7, 6, 2);
      ctx.fillRect(x + 5, y + 11, 6, 2);
    } else if (id === BLOCK.CHEST) {
      ctx.fillStyle = '#8b5a2b';
      ctx.fillRect(x + 1, y + 4, TILE - 2, TILE - 5);
      ctx.fillStyle = '#b77a42';
      ctx.fillRect(x + 2, y + 5, TILE - 4, 4);
      ctx.fillStyle = '#5a3818';
      ctx.fillRect(x + 1, y + 9, TILE - 2, 1);
      ctx.fillRect(x + 7, y + 8, 2, 4);
    } else if (id === BLOCK.COBWEB) {
      ctx.strokeStyle = 'rgba(240,245,255,0.8)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x + 1, y + 1);
      ctx.lineTo(x + TILE - 1, y + TILE - 1);
      ctx.moveTo(x + TILE - 1, y + 1);
      ctx.lineTo(x + 1, y + TILE - 1);
      ctx.moveTo(x + TILE / 2, y + 1);
      ctx.lineTo(x + TILE / 2, y + TILE - 1);
      ctx.moveTo(x + 1, y + TILE / 2);
      ctx.lineTo(x + TILE - 1, y + TILE / 2);
      ctx.stroke();
    } else if (id === BLOCK.LEAF) {
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      ctx.fillRect(x + 3, y + 3, 3, 3);
    } else if (id === BLOCK.FURNACE) {
      ctx.fillStyle = '#5e5e5e';
      ctx.fillRect(x, y, TILE, TILE);
      ctx.fillStyle = '#808080';
      ctx.fillRect(x + 2, y + 2, TILE - 4, 3);
      ctx.strokeStyle = '#2e2e2e';
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 3, y + 7, TILE - 6, 6);
      ctx.fillStyle = '#2d2d2d';
      ctx.fillRect(x + 5, y + 9, TILE - 10, 2);
    }
  }

  Game.worldRenderer = { drawBlock };
})();
