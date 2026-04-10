(() => {
  const Game = window.MC2D;
  const { TILE, HOTBAR_SIZE, BREATH_MAX, BREATH_CELL_SECONDS } = Game.constants;
  const { getLocationInfo } = Game.world;
  const { drawItem, drawDurabilityBar } = Game.itemRenderer;
  const { getArmorValue, getMaxHealth } = Game.combat;

  function isMobileUi(canvas, state) {
    return !!(state.ui && state.ui.controlMode === 'touch') || canvas.width < 900;
  }

  function getHotbarLayout(canvas, state) {
    const mobile = isMobileUi(canvas, state);
    const box = mobile ? 36 : 44;
    const gap = mobile ? 4 : 6;
    const total = HOTBAR_SIZE * box + (HOTBAR_SIZE - 1) * gap;
    const startX = Math.floor((canvas.width - total) / 2);
    const y = canvas.height - (mobile ? 54 : 62);
    const slots = [];
    for (let i = 0; i < HOTBAR_SIZE; i += 1) slots.push({ x: startX + i * (box + gap), y, w: box, h: box });
    return { mobile, box, gap, startX, y, slots };
  }

  function drawHotbar(ctx, canvas, state) {
    const layout = getHotbarLayout(canvas, state);

    for (let i = 0; i < HOTBAR_SIZE; i += 1) {
      const rect = layout.slots[i];
      const slot = state.player.hotbar[i];
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
      ctx.lineWidth = i === state.player.selectedSlot ? 3 : 2;
      ctx.strokeStyle = i === state.player.selectedSlot ? '#ffffff' : 'rgba(255,255,255,0.35)';
      ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
      ctx.fillStyle = '#fff';
      ctx.font = `${layout.mobile ? 10 : 12}px Arial`;
      ctx.fillText(String(i + 1), rect.x + 4, rect.y + (layout.mobile ? 11 : 13));

      if (slot.id && slot.count > 0) {
        const itemSize = layout.mobile ? 20 : 24;
        drawItem(ctx, slot.id, rect.x + (rect.w - itemSize) / 2, rect.y + 8, itemSize);
        if (slot.count > 1) {
          ctx.fillStyle = '#fff';
          ctx.font = `${layout.mobile ? 10 : 12}px Arial`;
          ctx.fillText(String(slot.count), rect.x + rect.w - (layout.mobile ? 14 : 18), rect.y + rect.h - 7);
        }
        drawDurabilityBar(ctx, slot, rect.x, rect.y + rect.h, rect.w);
      }
    }
  }

  function drawBreath(ctx, canvas, state) {
    if (!state.player.inWater) return;
    const mobile = isMobileUi(canvas, state);
    const fullCells = Math.ceil(state.player.breath / BREATH_CELL_SECONDS);
    const x0 = 24;
    const y = mobile ? 118 : 180;
    const cellSize = mobile ? 10 : 12;
    const step = mobile ? 14 : 16;

    for (let i = 0; i < BREATH_MAX; i += 1) {
      ctx.strokeStyle = 'rgba(255,255,255,0.7)';
      ctx.strokeRect(x0 + i * step, y, cellSize, cellSize);
      if (i < fullCells) {
        ctx.fillStyle = '#8fe8ff';
        ctx.fillRect(x0 + i * step + 1, y + 1, cellSize - 2, cellSize - 2);
      }
    }

    ctx.fillStyle = '#fff';
    ctx.font = `${mobile ? 12 : 14}px Arial`;
    ctx.fillText('Дыхание', x0, y - 8);
  }

  function biomeLabel(biomeKey) {
    if (biomeKey === 'forest') return 'Лес';
    if (biomeKey === 'lake') return 'Озеро';
    if (biomeKey === 'cave') return 'Пещера';
    if (biomeKey === 'dwarf_caves') return 'Пещеры гномов';
    if (biomeKey === 'deep') return 'Глубины';
    if (biomeKey === 'fire_caves') return 'Огненные пещеры';
    if (biomeKey === 'water_caves') return 'Водные пещеры';
    if (biomeKey === 'void') return 'Пустота';
    if (biomeKey === 'red_land') return 'Красная земля';
    if (biomeKey === 'lava_lake') return 'Лавовое озеро';
    if (biomeKey === 'mountains') return 'Горы';
    if (biomeKey === 'snow_plains') return 'Снежная равнина';
    if (biomeKey === 'desert') return 'Пустыня';
    if (biomeKey === 'volcano') return 'Вулкан';
    return 'Равнина';
  }

  function getTrackedCompassTarget(state, key) {
    if (key === 'fire_pyramid') {
      const pyramid = state.firePyramid;
      if (!pyramid) return null;
      return {
        label: 'Пирамида огня',
        x: pyramid.centerX * TILE,
        y: pyramid.baseY * TILE,
      };
    }
    if (key === 'fire_caves') {
      const region = state.fireCaves && state.fireCaves.region;
      if (!region) return null;
      return {
        label: 'Огненные пещеры',
        x: ((region.x0 + region.x1) / 2) * TILE,
        y: ((region.y0 + region.y1) / 2) * TILE,
      };
    }
    if (key === 'water_caves') {
      const region = state.waterCaves && state.waterCaves.region;
      if (!region) return null;
      return {
        label: 'Водные пещеры',
        x: ((region.x0 + region.x1) / 2) * TILE,
        y: ((region.y0 + region.y1) / 2) * TILE,
      };
    }
    if (key === 'fire_castle') {
      const castle = state.fireWorldMeta && state.fireWorldMeta.castle;
      if (!castle) return null;
      return {
        label: 'Замок огненного короля',
        x: castle.throneX * TILE,
        y: castle.baseY * TILE,
      };
    }
    if (key === 'fire_dungeon') {
      const dungeon = state.fireDungeon || (state.fireWorldMeta && state.fireWorldMeta.fireDungeon);
      if (!dungeon) return null;
      return {
        label: 'Огненная темница',
        x: dungeon.centerX * TILE,
        y: dungeon.centerY * TILE,
      };
    }
    if (key === 'water_well') {
      const well = state.waterWell;
      if (!well) return null;
      return {
        label: 'Водный колодец',
        x: well.centerX * TILE,
        y: well.baseY * TILE,
      };
    }
    return null;
  }

  function drawCompassArrow(ctx, x, y, dx, dy, scale = 1) {
    const len = 24 * scale;
    const angle = Math.atan2(dy, dx);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.strokeStyle = 'rgba(255,210,150,0.96)';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-len * 0.5, 0);
    ctx.lineTo(len * 0.28, 0);
    ctx.stroke();
    ctx.fillStyle = '#ffd48a';
    ctx.beginPath();
    ctx.moveTo(len * 0.5, 0);
    ctx.lineTo(len * 0.16, -7 * scale);
    ctx.lineTo(len * 0.16, 7 * scale);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawTrackedCompass(ctx, canvas, state) {
    const targetKey = state.pause && state.pause.activeCompassTarget;
    if (!targetKey) return;
    const target = getTrackedCompassTarget(state, targetKey);
    if (!target) return;
    const mobile = isMobileUi(canvas, state);
    const layout = getHotbarLayout(canvas, state);
    const px = state.player.x + state.player.w / 2;
    const py = state.player.y + state.player.h / 2;
    const dx = target.x - px;
    const dy = target.y - py;
    const dist = Math.round(Math.hypot(dx, dy) / TILE);
    const boxW = mobile ? 208 : 250;
    const boxH = mobile ? 34 : 40;
    const boxX = Math.floor((canvas.width - boxW) / 2);
    const boxY = layout.y - (mobile ? 40 : 48);
    ctx.fillStyle = 'rgba(18,14,10,0.9)';
    ctx.fillRect(boxX, boxY, boxW, boxH);
    ctx.strokeStyle = 'rgba(255,196,128,0.45)';
    ctx.strokeRect(boxX + 0.5, boxY + 0.5, boxW - 1, boxH - 1);
    drawCompassArrow(ctx, boxX + 24, boxY + boxH / 2, dx, dy, mobile ? 0.85 : 1);
    ctx.fillStyle = '#ffe8d0';
    ctx.font = `${mobile ? 11 : 13}px Arial`;
    ctx.fillText(target.label, boxX + 44, boxY + (mobile ? 14 : 16));
    ctx.fillStyle = 'rgba(255,210,150,0.95)';
    ctx.fillText(`${dist} блоков`, boxX + 44, boxY + (mobile ? 28 : 32));
  }

  function phaseLabel(phase) {
    return phase === 'day' ? 'День' : phase === 'night' ? 'Ночь' : phase === 'sunset' ? 'Закат' : 'Рассвет';
  }

  function drawUI(ctx, canvas, state, phase) {
    const mobile = isMobileUi(canvas, state);
    const creative = !!(state.worldMeta && state.worldMeta.mode === 'creative');
    const spectator = !!(state.worldMeta && state.worldMeta.mode === 'spectator');
    if (spectator) return;
    const panelW = mobile ? Math.min(canvas.width - 24, 252) : 280;
    const panelH = creative ? (mobile ? 54 : 72) : mobile ? 82 : 110;
    const panelX = 12;
    const panelY = mobile ? 12 : 12;

    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(panelX, panelY, panelW, panelH);

    ctx.fillStyle = '#fff';
    ctx.font = `${mobile ? 12 : 16}px Arial`;
    const maxHealth = getMaxHealth(state);
    if (!creative) {
      ctx.fillText(`Жизни: ${Math.ceil(state.player.health)}/${maxHealth}`, panelX + 12, panelY + 20);
      ctx.fillText(`Сытость: ${Math.ceil(state.player.satiety)}/100`, panelX + 12, panelY + 38);
    } else {
      const flight = (mobile || state.player.creativeFlight) ? 'вкл' : 'выкл';
      ctx.fillText(`Творческий • Полет: ${flight}`, panelX + 12, panelY + 26);
    }

    const tx = Math.floor((state.player.x + state.player.w / 2) / TILE);
    const ty = Math.floor((state.player.y + state.player.h / 2) / TILE);
    const biome = biomeLabel(getLocationInfo(state, tx, ty).biome);
    const infoX = mobile ? panelX + 132 : panelX + 148;
    const infoY1 = mobile ? panelY + 20 : panelY + 24;
    const infoY2 = mobile ? panelY + (creative ? 36 : 38) : panelY + (creative ? 46 : 46);
    const infoY3 = mobile ? panelY + 56 : panelY + 68;
    ctx.font = `${mobile ? 11 : 16}px Arial`;
    ctx.fillText(`Биом: ${biome}`, infoX, infoY1);
    ctx.fillText(`Фаза: ${phaseLabel(phase.phase)}`, infoX, infoY2);
    if (!creative) ctx.fillText(`Броня: ${getArmorValue(state)}`, infoX, infoY3);
    if (!mobile && !creative) ctx.fillText(`В воде: ${state.player.inWater ? 'Да' : 'Нет'}`, panelX + 148, infoY3);

    if (!creative) {
      const barW = mobile ? panelW - 24 : 240;
      const healthBarY = panelY + (mobile ? 52 : 118);
      const satietyBarY = panelY + (mobile ? 66 : 136);
      ctx.fillStyle = '#444';
      ctx.fillRect(panelX + 12, healthBarY, barW, 10);
      ctx.fillStyle = '#e53935';
      ctx.fillRect(panelX + 12, healthBarY, barW * Math.max(0, Math.min(1, state.player.health / maxHealth)), 10);

      ctx.fillStyle = '#444';
      ctx.fillRect(panelX + 12, satietyBarY, barW, 10);
      ctx.fillStyle = '#ffb300';
      ctx.fillRect(panelX + 12, satietyBarY, barW * (state.player.satiety / 100), 10);
    }

    const fpsBoxW = mobile ? 54 : 60;
    const fpsBoxH = mobile ? 22 : 24;
    const fpsBoxX = panelX + panelW + 10;
    const fpsBoxY = panelY;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(fpsBoxX, fpsBoxY, fpsBoxW, fpsBoxH);
    ctx.strokeStyle = 'rgba(255,255,255,0.22)';
    ctx.strokeRect(fpsBoxX, fpsBoxY, fpsBoxW, fpsBoxH);
    ctx.fillStyle = '#fff';
    ctx.font = `${mobile ? 10 : 11}px Arial`;
    ctx.fillText(`FPS ${Math.round(state.ui.fps || 0)}`, fpsBoxX + 8, fpsBoxY + (mobile ? 14 : 16));

    if (!creative) drawBreath(ctx, canvas, state);
    drawHotbar(ctx, canvas, state);
    drawTrackedCompass(ctx, canvas, state);

    if (state.ui && state.ui.noticeText) {
      const text = state.ui.noticeText;
      ctx.font = `${mobile ? 13 : 16}px Arial`;
      const textW = ctx.measureText(text).width;
      const boxW = textW + 22;
      const boxH = mobile ? 28 : 32;
      const boxX = Math.floor((canvas.width - boxW) / 2);
      const boxY = mobile ? 76 : 88;
      ctx.fillStyle = 'rgba(18,14,10,0.9)';
      ctx.fillRect(boxX, boxY, boxW, boxH);
      ctx.strokeStyle = 'rgba(255,196,128,0.5)';
      ctx.strokeRect(boxX + 0.5, boxY + 0.5, boxW - 1, boxH - 1);
      ctx.fillStyle = '#ffe8d0';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, canvas.width / 2, boxY + boxH / 2 + 1);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
    }
  }

  Game.uiRenderer = { drawHotbar, drawBreath, drawUI, getHotbarLayout, isMobileUi };
})();
