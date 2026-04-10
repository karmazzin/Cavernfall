(() => {
  const Game = window.MC2D;
  const { ITEM, isBlockItem, getItemDefinition, getMaxDurability } = Game.items;
  const { drawBlock } = Game.worldRenderer;

  function drawToolHandle(ctx, x, y, size) {
    ctx.fillStyle = '#7a5432';
    ctx.fillRect(x + size * 0.44, y + size * 0.28, size * 0.12, size * 0.54);
  }

  function toolColor(tier, sword = false) {
    if (tier === 'friendship') return sword ? '#d6ffe0' : '#7be2af';
    if (tier === 'diamond') return sword ? '#9af2ff' : '#63d8ea';
    if (tier === 'iron') return sword ? '#dfe5ec' : '#b9c2cc';
    if (tier === 'stone') return sword ? '#c4ccd9' : '#9ca4b3';
    return sword ? '#d4b382' : '#c9a16b';
  }

  function drawArmorItem(ctx, def, x, y, size) {
    const friendship = typeof def.id === 'string' && def.id.startsWith('friendship_');
    ctx.fillStyle = friendship ? '#8ef0c1' : '#b8c1ca';
    ctx.strokeStyle = friendship ? '#2f8f63' : '#6f7b88';
    ctx.lineWidth = Math.max(1, size * 0.04);
    if (def.armorSlot === 'head') {
      ctx.beginPath();
      ctx.moveTo(x + size * 0.22, y + size * 0.60);
      ctx.lineTo(x + size * 0.30, y + size * 0.28);
      ctx.lineTo(x + size * 0.70, y + size * 0.28);
      ctx.lineTo(x + size * 0.78, y + size * 0.60);
      ctx.lineTo(x + size * 0.64, y + size * 0.60);
      ctx.lineTo(x + size * 0.58, y + size * 0.48);
      ctx.lineTo(x + size * 0.42, y + size * 0.48);
      ctx.lineTo(x + size * 0.36, y + size * 0.60);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      if (friendship) {
        ctx.fillStyle = '#d9fff0';
        ctx.fillRect(x + size * 0.43, y + size * 0.34, size * 0.14, size * 0.10);
      }
    } else if (def.armorSlot === 'chest') {
      ctx.fillRect(x + size * 0.24, y + size * 0.22, size * 0.52, size * 0.50);
      ctx.fillRect(x + size * 0.14, y + size * 0.26, size * 0.12, size * 0.28);
      ctx.fillRect(x + size * 0.74, y + size * 0.26, size * 0.12, size * 0.28);
      ctx.strokeRect(x + size * 0.24, y + size * 0.22, size * 0.52, size * 0.50);
      if (friendship) {
        ctx.fillStyle = '#d9fff0';
        ctx.fillRect(x + size * 0.45, y + size * 0.36, size * 0.10, size * 0.20);
      }
    } else if (def.armorSlot === 'legs') {
      ctx.fillRect(x + size * 0.28, y + size * 0.20, size * 0.18, size * 0.54);
      ctx.fillRect(x + size * 0.54, y + size * 0.20, size * 0.18, size * 0.54);
      ctx.fillRect(x + size * 0.28, y + size * 0.20, size * 0.44, size * 0.16);
      ctx.strokeRect(x + size * 0.28, y + size * 0.20, size * 0.18, size * 0.54);
      ctx.strokeRect(x + size * 0.54, y + size * 0.20, size * 0.18, size * 0.54);
      if (friendship) {
        ctx.fillStyle = '#d9fff0';
        ctx.fillRect(x + size * 0.44, y + size * 0.24, size * 0.12, size * 0.10);
      }
    } else if (def.armorSlot === 'feet') {
      ctx.fillRect(x + size * 0.22, y + size * 0.48, size * 0.20, size * 0.18);
      ctx.fillRect(x + size * 0.56, y + size * 0.48, size * 0.20, size * 0.18);
      ctx.fillRect(x + size * 0.22, y + size * 0.62, size * 0.28, size * 0.08);
      ctx.fillRect(x + size * 0.56, y + size * 0.62, size * 0.28, size * 0.08);
      if (friendship) {
        ctx.fillStyle = '#d9fff0';
        ctx.fillRect(x + size * 0.30, y + size * 0.52, size * 0.10, size * 0.06);
        ctx.fillRect(x + size * 0.64, y + size * 0.52, size * 0.10, size * 0.06);
      }
    }
  }

  function drawItem(ctx, itemId, x, y, size = 24) {
    if (itemId == null) return;

    if (isBlockItem(itemId)) {
      drawBlock(ctx, itemId, x, y);
      return;
    }

    const def = getItemDefinition(itemId);
    if (!def) return;

    if (def.kind === 'spawn_egg') {
      const colors = def.spawnEggColors || ['#d9d9d9', '#8c8c8c'];
      ctx.fillStyle = colors[0];
      ctx.beginPath();
      ctx.ellipse(x + size * 0.5, y + size * 0.5, size * 0.28, size * 0.34, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = colors[1];
      ctx.beginPath();
      ctx.arc(x + size * 0.42, y + size * 0.42, size * 0.07, 0, Math.PI * 2);
      ctx.arc(x + size * 0.58, y + size * 0.34, size * 0.06, 0, Math.PI * 2);
      ctx.arc(x + size * 0.60, y + size * 0.56, size * 0.08, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.25)';
      ctx.lineWidth = Math.max(1, size * 0.04);
      ctx.stroke();
      return;
    }

    if (itemId === ITEM.STICK) {
      ctx.fillStyle = '#8d623b';
      ctx.fillRect(x + size * 0.46, y + size * 0.18, size * 0.12, size * 0.62);
      return;
    }

    if (itemId === ITEM.COAL) {
      ctx.fillStyle = '#202020';
      ctx.beginPath();
      ctx.moveTo(x + size * 0.28, y + size * 0.62);
      ctx.lineTo(x + size * 0.36, y + size * 0.24);
      ctx.lineTo(x + size * 0.62, y + size * 0.18);
      ctx.lineTo(x + size * 0.74, y + size * 0.42);
      ctx.lineTo(x + size * 0.54, y + size * 0.72);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      ctx.fillRect(x + size * 0.48, y + size * 0.28, size * 0.08, size * 0.12);
      return;
    }

    if (itemId === ITEM.CHARCOAL) {
      ctx.fillStyle = '#2c241d';
      ctx.beginPath();
      ctx.moveTo(x + size * 0.26, y + size * 0.64);
      ctx.lineTo(x + size * 0.34, y + size * 0.26);
      ctx.lineTo(x + size * 0.60, y + size * 0.20);
      ctx.lineTo(x + size * 0.72, y + size * 0.44);
      ctx.lineTo(x + size * 0.52, y + size * 0.72);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = 'rgba(255,220,180,0.12)';
      ctx.fillRect(x + size * 0.47, y + size * 0.30, size * 0.08, size * 0.12);
      return;
    }

    if (itemId === ITEM.RAW_IRON) {
      ctx.fillStyle = '#9f8e7d';
      ctx.beginPath();
      ctx.moveTo(x + size * 0.26, y + size * 0.64);
      ctx.lineTo(x + size * 0.34, y + size * 0.28);
      ctx.lineTo(x + size * 0.62, y + size * 0.22);
      ctx.lineTo(x + size * 0.76, y + size * 0.42);
      ctx.lineTo(x + size * 0.56, y + size * 0.74);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = 'rgba(245,245,245,0.2)';
      ctx.fillRect(x + size * 0.46, y + size * 0.30, size * 0.10, size * 0.12);
      return;
    }

    if (itemId === ITEM.IRON_INGOT) {
      ctx.fillStyle = '#c5ced8';
      ctx.beginPath();
      ctx.moveTo(x + size * 0.20, y + size * 0.58);
      ctx.lineTo(x + size * 0.30, y + size * 0.34);
      ctx.lineTo(x + size * 0.70, y + size * 0.34);
      ctx.lineTo(x + size * 0.80, y + size * 0.58);
      ctx.lineTo(x + size * 0.68, y + size * 0.72);
      ctx.lineTo(x + size * 0.32, y + size * 0.72);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.fillRect(x + size * 0.32, y + size * 0.40, size * 0.32, size * 0.08);
      return;
    }

    if (itemId === ITEM.SMALL_DIAMOND) {
      ctx.fillStyle = '#59d8ef';
      ctx.beginPath();
      ctx.moveTo(x + size * 0.50, y + size * 0.16);
      ctx.lineTo(x + size * 0.68, y + size * 0.34);
      ctx.lineTo(x + size * 0.58, y + size * 0.70);
      ctx.lineTo(x + size * 0.42, y + size * 0.70);
      ctx.lineTo(x + size * 0.32, y + size * 0.34);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = 'rgba(235,255,255,0.32)';
      ctx.fillRect(x + size * 0.46, y + size * 0.26, size * 0.08, size * 0.14);
      return;
    }

    if (itemId === ITEM.BIG_DIAMOND) {
      ctx.fillStyle = '#5fe3f5';
      ctx.beginPath();
      ctx.moveTo(x + size * 0.50, y + size * 0.10);
      ctx.lineTo(x + size * 0.76, y + size * 0.34);
      ctx.lineTo(x + size * 0.64, y + size * 0.76);
      ctx.lineTo(x + size * 0.36, y + size * 0.76);
      ctx.lineTo(x + size * 0.24, y + size * 0.34);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = 'rgba(245,255,255,0.34)';
      ctx.fillRect(x + size * 0.45, y + size * 0.22, size * 0.10, size * 0.18);
      return;
    }

    if (itemId === ITEM.RAW_GOLD) {
      ctx.fillStyle = '#c59c3c';
      ctx.beginPath();
      ctx.moveTo(x + size * 0.28, y + size * 0.64);
      ctx.lineTo(x + size * 0.34, y + size * 0.30);
      ctx.lineTo(x + size * 0.58, y + size * 0.20);
      ctx.lineTo(x + size * 0.76, y + size * 0.40);
      ctx.lineTo(x + size * 0.60, y + size * 0.72);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = 'rgba(255,240,170,0.22)';
      ctx.fillRect(x + size * 0.46, y + size * 0.28, size * 0.10, size * 0.12);
      return;
    }

    if (itemId === ITEM.GOLD_INGOT) {
      ctx.fillStyle = '#d4af37';
      ctx.beginPath();
      ctx.moveTo(x + size * 0.20, y + size * 0.58);
      ctx.lineTo(x + size * 0.30, y + size * 0.34);
      ctx.lineTo(x + size * 0.70, y + size * 0.34);
      ctx.lineTo(x + size * 0.80, y + size * 0.58);
      ctx.lineTo(x + size * 0.68, y + size * 0.72);
      ctx.lineTo(x + size * 0.32, y + size * 0.72);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = 'rgba(255,248,200,0.28)';
      ctx.fillRect(x + size * 0.32, y + size * 0.40, size * 0.32, size * 0.08);
      return;
    }

    if (itemId === ITEM.COIN) {
      ctx.fillStyle = '#ddb847';
      ctx.beginPath();
      ctx.arc(x + size * 0.5, y + size * 0.48, size * 0.24, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#9e7b1f';
      ctx.lineWidth = Math.max(1, size * 0.05);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,245,180,0.35)';
      ctx.beginPath();
      ctx.arc(x + size * 0.44, y + size * 0.40, size * 0.08, 0, Math.PI * 2);
      ctx.fill();
      return;
    }

    if (itemId === ITEM.DEEP_CRYSTAL) {
      ctx.fillStyle = '#7b5ac9';
      ctx.beginPath();
      ctx.moveTo(x + size * 0.50, y + size * 0.12);
      ctx.lineTo(x + size * 0.72, y + size * 0.34);
      ctx.lineTo(x + size * 0.62, y + size * 0.74);
      ctx.lineTo(x + size * 0.38, y + size * 0.74);
      ctx.lineTo(x + size * 0.28, y + size * 0.34);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = 'rgba(238,224,255,0.35)';
      ctx.fillRect(x + size * 0.46, y + size * 0.24, size * 0.08, size * 0.18);
      return;
    }

    if (itemId === ITEM.DEEP_DIAMOND) {
      ctx.fillStyle = '#6ac9ff';
      ctx.beginPath();
      ctx.moveTo(x + size * 0.50, y + size * 0.08);
      ctx.lineTo(x + size * 0.78, y + size * 0.34);
      ctx.lineTo(x + size * 0.64, y + size * 0.80);
      ctx.lineTo(x + size * 0.36, y + size * 0.80);
      ctx.lineTo(x + size * 0.22, y + size * 0.34);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#8a63d4';
      ctx.fillRect(x + size * 0.44, y + size * 0.30, size * 0.12, size * 0.24);
      ctx.fillStyle = 'rgba(245,255,255,0.34)';
      ctx.fillRect(x + size * 0.47, y + size * 0.18, size * 0.08, size * 0.14);
      return;
    }

    if (itemId === ITEM.FIRE_CRYSTAL) {
      ctx.fillStyle = '#ff7a2a';
      ctx.beginPath();
      ctx.moveTo(x + size * 0.50, y + size * 0.12);
      ctx.lineTo(x + size * 0.74, y + size * 0.34);
      ctx.lineTo(x + size * 0.60, y + size * 0.78);
      ctx.lineTo(x + size * 0.40, y + size * 0.78);
      ctx.lineTo(x + size * 0.26, y + size * 0.34);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#ffd36e';
      ctx.fillRect(x + size * 0.45, y + size * 0.26, size * 0.10, size * 0.18);
      ctx.fillStyle = 'rgba(255,245,205,0.32)';
      ctx.fillRect(x + size * 0.48, y + size * 0.16, size * 0.06, size * 0.12);
      return;
    }

    if (itemId === ITEM.FIRE_DUNGEON_KEY) {
      ctx.fillStyle = '#d79a38';
      ctx.beginPath();
      ctx.arc(x + size * 0.34, y + size * 0.38, size * 0.14, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#341810';
      ctx.beginPath();
      ctx.arc(x + size * 0.34, y + size * 0.38, size * 0.06, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#d79a38';
      ctx.fillRect(x + size * 0.34, y + size * 0.34, size * 0.34, size * 0.08);
      ctx.fillRect(x + size * 0.56, y + size * 0.42, size * 0.08, size * 0.16);
      ctx.fillRect(x + size * 0.48, y + size * 0.46, size * 0.08, size * 0.10);
      ctx.fillStyle = '#ffd37c';
      ctx.fillRect(x + size * 0.26, y + size * 0.28, size * 0.08, size * 0.04);
      return;
    }

    if (itemId === ITEM.FRIENDSHIP_INGOT) {
      ctx.fillStyle = '#7fe1ae';
      ctx.beginPath();
      ctx.moveTo(x + size * 0.20, y + size * 0.58);
      ctx.lineTo(x + size * 0.30, y + size * 0.34);
      ctx.lineTo(x + size * 0.70, y + size * 0.34);
      ctx.lineTo(x + size * 0.80, y + size * 0.58);
      ctx.lineTo(x + size * 0.68, y + size * 0.72);
      ctx.lineTo(x + size * 0.32, y + size * 0.72);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = 'rgba(240,255,246,0.34)';
      ctx.fillRect(x + size * 0.33, y + size * 0.40, size * 0.30, size * 0.08);
      return;
    }

    if (itemId === ITEM.WHEAT) {
      ctx.fillStyle = '#c8ad4e';
      ctx.fillRect(x + size * 0.48, y + size * 0.18, size * 0.06, size * 0.56);
      for (let i = 0; i < 4; i += 1) {
        ctx.fillRect(x + size * (0.36 + i * 0.04), y + size * (0.24 + i * 0.09), size * 0.12, size * 0.06);
        ctx.fillRect(x + size * (0.52 - i * 0.04), y + size * (0.28 + i * 0.09), size * 0.12, size * 0.06);
      }
      return;
    }

    if (itemId === ITEM.CARROT) {
      ctx.fillStyle = '#d96d20';
      ctx.beginPath();
      ctx.moveTo(x + size * 0.52, y + size * 0.2);
      ctx.lineTo(x + size * 0.70, y + size * 0.34);
      ctx.lineTo(x + size * 0.56, y + size * 0.76);
      ctx.lineTo(x + size * 0.34, y + size * 0.36);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#6ea84a';
      ctx.fillRect(x + size * 0.45, y + size * 0.12, size * 0.04, size * 0.12);
      ctx.fillRect(x + size * 0.50, y + size * 0.10, size * 0.04, size * 0.14);
      ctx.fillRect(x + size * 0.55, y + size * 0.12, size * 0.04, size * 0.12);
      return;
    }

    if (itemId === ITEM.RAW_MUTTON) {
      ctx.fillStyle = '#cf6f7e';
      ctx.beginPath();
      ctx.ellipse(x + size * 0.48, y + size * 0.42, size * 0.26, size * 0.2, -0.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#f2c2c9';
      ctx.beginPath();
      ctx.ellipse(x + size * 0.55, y + size * 0.36, size * 0.11, size * 0.08, -0.5, 0, Math.PI * 2);
      ctx.fill();
      return;
    }

    if (def.kind === 'armor') {
      drawArmorItem(ctx, def, x, y, size);
      return;
    }

    drawToolHandle(ctx, x, y, size);

    if (def.toolType === 'pickaxe') {
      ctx.fillStyle = toolColor(def.tier);
      ctx.fillRect(x + size * 0.18, y + size * 0.12, size * 0.64, size * 0.14);
      ctx.fillRect(x + size * 0.26, y + size * 0.22, size * 0.14, size * 0.12);
      ctx.fillRect(x + size * 0.60, y + size * 0.22, size * 0.14, size * 0.12);
    } else if (def.toolType === 'axe') {
      ctx.fillStyle = toolColor(def.tier);
      ctx.fillRect(x + size * 0.18, y + size * 0.10, size * 0.32, size * 0.28);
      ctx.fillRect(x + size * 0.44, y + size * 0.16, size * 0.12, size * 0.1);
    } else if (def.toolType === 'shovel') {
      ctx.fillStyle = toolColor(def.tier);
      ctx.beginPath();
      ctx.ellipse(x + size * 0.50, y + size * 0.22, size * 0.16, size * 0.14, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (def.toolType === 'sword') {
      ctx.fillStyle = toolColor(def.tier, true);
      ctx.fillRect(x + size * 0.42, y + size * 0.08, size * 0.16, size * 0.48);
      ctx.fillStyle = '#7a5432';
      ctx.fillRect(x + size * 0.26, y + size * 0.54, size * 0.48, size * 0.08);
    }
  }

  function drawDurabilityBar(ctx, slot, x, y, w) {
    if (!slot || slot.id == null) return;
    const maxDurability = getMaxDurability(slot.id);
    if (maxDurability <= 0) return;

    const ratio = Math.max(0, Math.min(1, (slot.durability ?? maxDurability) / maxDurability));
    const barW = Math.max(12, w - 8);
    const color = ratio > 0.5 ? '#67d35f' : ratio > 0.22 ? '#e0c14d' : '#df5b5b';

    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    ctx.fillRect(x + 4, y - 8, barW, 5);
    ctx.fillStyle = color;
    ctx.fillRect(x + 5, y - 7, (barW - 2) * ratio, 3);
  }

  Game.itemRenderer = { drawItem, drawDurabilityBar };
})();
