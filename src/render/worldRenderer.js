(() => {
  const Game = window.MC2D;
  const { TILE } = Game.constants;
  const { BLOCK, BLOCK_COLORS } = Game.blocks;

  function drawDoor(ctx, x, y, open = false, upper = false) {
    if (open) {
      ctx.fillStyle = '#6f4a27';
      ctx.fillRect(x + 11, y + 1, 3, TILE - 1);
      ctx.fillStyle = '#9a6a3b';
      ctx.fillRect(x + 12, y + 2, 2, TILE - 3);
      ctx.fillStyle = 'rgba(255,233,186,0.14)';
      ctx.fillRect(x + 12, y + (upper ? 4 : 2), 1, upper ? 5 : 3);
      if (!upper) {
        ctx.fillStyle = '#5a3818';
        ctx.fillRect(x + 11, y + 7, 1, 2);
      }
      return;
    }

    ctx.fillStyle = '#6f4926';
    ctx.fillRect(x + 2, y, 12, TILE);
    ctx.fillStyle = '#8c5d32';
    ctx.fillRect(x + 3, y + 1, 10, TILE - 2);
    ctx.fillStyle = '#a97341';
    ctx.fillRect(x + 4, y + 2, 8, TILE - 4);
    ctx.fillStyle = '#5f3d1f';
    ctx.fillRect(x + 3, y + 1, 1, TILE - 2);
    ctx.fillRect(x + 11, y + 1, 1, TILE - 2);
    if (!upper) {
      ctx.fillStyle = '#5a3818';
      ctx.fillRect(x + 9, y + 8, 1, 2);
      ctx.fillStyle = 'rgba(52,31,15,0.25)';
      ctx.fillRect(x + 4, y + 6, 8, 1);
      ctx.fillRect(x + 4, y + 11, 8, 1);
    } else {
      ctx.fillStyle = 'rgba(255,236,196,0.18)';
      ctx.fillRect(x + 5, y + 4, 5, 4);
      ctx.fillStyle = 'rgba(92,61,28,0.45)';
      ctx.fillRect(x + 10, y + 4, 1, 4);
      ctx.fillRect(x + 5, y + 8, 6, 1);
    }
    ctx.strokeStyle = 'rgba(45,24,11,0.5)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 2.5, y + 0.5, 11, TILE - 1);
  }

  function drawBlock(ctx, id, x, y, time = 0) {
    if (id !== BLOCK.TORCH && id !== BLOCK.CACTUS && id !== BLOCK.DRY_BUSH) {
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
    } else if (id === BLOCK.IRON_ORE) {
      ctx.fillStyle = '#7f7b72';
      ctx.fillRect(x, y, TILE, TILE);
      ctx.fillStyle = '#c98f5a';
      ctx.fillRect(x + 3, y + 3, 4, 4);
      ctx.fillRect(x + 9, y + 4, 3, 3);
      ctx.fillRect(x + 7, y + 10, 4, 3);
    } else if (id === BLOCK.DIAMOND_ORE) {
      ctx.fillStyle = '#4a505b';
      ctx.fillRect(x, y, TILE, TILE);
      ctx.fillStyle = '#64d9ec';
      ctx.fillRect(x + 3, y + 3, 3, 4);
      ctx.fillRect(x + 9, y + 4, 4, 3);
      ctx.fillRect(x + 7, y + 10, 3, 3);
      ctx.fillStyle = 'rgba(230,255,255,0.24)';
      ctx.fillRect(x + 4, y + 4, 1, 2);
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
    } else if (id === BLOCK.BASALT) {
      ctx.fillStyle = '#474247';
      ctx.fillRect(x, y, TILE, TILE);
      ctx.fillStyle = '#5a545a';
      ctx.fillRect(x + 2, y + 2, 5, 3);
      ctx.fillRect(x + 9, y + 6, 4, 3);
      ctx.fillStyle = '#2d292d';
      ctx.fillRect(x + 5, y + 10, 6, 3);
    } else if (id === BLOCK.FIRE_SEAL) {
      ctx.fillStyle = '#5f352f';
      ctx.fillRect(x, y, TILE, TILE);
      ctx.fillStyle = '#7d4d43';
      ctx.fillRect(x + 1, y + 1, TILE - 2, TILE - 2);
      ctx.strokeStyle = '#b86b4c';
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 2.5, y + 2.5, TILE - 5, TILE - 5);
      ctx.beginPath();
      ctx.moveTo(x + 8, y + 4);
      ctx.lineTo(x + 11, y + 8);
      ctx.lineTo(x + 8, y + 12);
      ctx.lineTo(x + 5, y + 8);
      ctx.closePath();
      ctx.stroke();
    } else if (id === BLOCK.FIRE_PORTAL) {
      ctx.fillStyle = '#2b1014';
      ctx.fillRect(x + 2, y + 1, TILE - 4, TILE - 2);
      const pulse = 0.5 + 0.5 * Math.sin(time * 6 + x * 0.1);
      ctx.fillStyle = '#ff6f1d';
      ctx.fillRect(x + 4, y + 3, TILE - 8, TILE - 6);
      ctx.fillStyle = `rgba(255,208,92,${0.35 + pulse * 0.25})`;
      ctx.fillRect(x + 6, y + 4, TILE - 12, TILE - 8);
      ctx.strokeStyle = '#7a2518';
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 2.5, y + 1.5, TILE - 5, TILE - 3);
    } else if (id === BLOCK.RED_EARTH) {
      ctx.fillStyle = '#7d4133';
      ctx.fillRect(x, y, TILE, TILE);
      ctx.fillStyle = '#9a5645';
      ctx.fillRect(x + 2, y + 3, 5, 4);
      ctx.fillRect(x + 9, y + 5, 4, 3);
      ctx.fillStyle = '#5c2d25';
      ctx.fillRect(x + 5, y + 10, 6, 3);
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
    } else if (id === BLOCK.DOOR) {
      drawDoor(ctx, x, y, false, false);
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
    } else if (id === BLOCK.PATH) {
      ctx.fillStyle = '#8b7048';
      ctx.fillRect(x, y + 4, TILE, TILE - 4);
      ctx.fillStyle = '#a88b61';
      ctx.fillRect(x + 2, y + 6, 4, 2);
      ctx.fillRect(x + 9, y + 9, 4, 2);
      ctx.fillStyle = '#715736';
      ctx.fillRect(x, y + 12, TILE, 2);
    } else if (id === BLOCK.SAND) {
      ctx.fillStyle = '#dcc47d';
      ctx.fillRect(x, y, TILE, TILE);
      ctx.fillStyle = '#ead696';
      ctx.fillRect(x + 2, y + 3, 4, 2);
      ctx.fillRect(x + 9, y + 6, 3, 2);
      ctx.fillStyle = '#c2aa63';
      ctx.fillRect(x + 4, y + 10, 6, 2);
    } else if (id === BLOCK.SANDSTONE) {
      ctx.fillStyle = '#c09f60';
      ctx.fillRect(x, y, TILE, TILE);
      ctx.fillStyle = '#d8bb7d';
      ctx.fillRect(x + 1, y + 2, TILE - 2, 3);
      ctx.fillRect(x + 3, y + 8, TILE - 6, 2);
      ctx.fillStyle = '#9f834e';
      ctx.fillRect(x + 2, y + 12, TILE - 4, 2);
      ctx.strokeStyle = 'rgba(111,85,44,0.35)';
      ctx.strokeRect(x + 0.5, y + 0.5, TILE - 1, TILE - 1);
    } else if (id === BLOCK.CACTUS) {
      ctx.fillStyle = '#2f7d40';
      ctx.fillRect(x + 5, y, 6, TILE);
      ctx.fillStyle = '#4db05e';
      ctx.fillRect(x + 6, y + 1, 1, TILE - 2);
      ctx.fillRect(x + 9, y + 2, 1, TILE - 4);
      ctx.fillRect(x + 3, y + 6, 2, 4);
      ctx.fillRect(x + 11, y + 4, 2, 5);
      ctx.fillStyle = '#8fd08f';
      ctx.fillRect(x + 7, y + 3, 1, 1);
      ctx.fillRect(x + 7, y + 8, 1, 1);
      ctx.fillRect(x + 7, y + 12, 1, 1);
    } else if (id === BLOCK.DRY_BUSH) {
      ctx.strokeStyle = '#8a7146';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x + 8, y + 14);
      ctx.lineTo(x + 8, y + 9);
      ctx.lineTo(x + 5, y + 6);
      ctx.moveTo(x + 8, y + 10);
      ctx.lineTo(x + 11, y + 7);
      ctx.moveTo(x + 8, y + 11);
      ctx.lineTo(x + 4, y + 10);
      ctx.moveTo(x + 8, y + 12);
      ctx.lineTo(x + 12, y + 11);
      ctx.stroke();
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

  Game.worldRenderer = { drawBlock, drawDoor };
})();
