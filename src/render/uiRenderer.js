(() => {
  const Game = window.MC2D;
  const { TILE, HOTBAR_SIZE, BREATH_MAX, BREATH_CELL_SECONDS } = Game.constants;
  const { getLocationInfo } = Game.world;
  const { drawItem, drawDurabilityBar } = Game.itemRenderer;
  const { getArmorValue } = Game.combat;

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
    if (biomeKey === 'mountains') return 'Горы';
    if (biomeKey === 'desert') return 'Пустыня';
    if (biomeKey === 'volcano') return 'Вулкан';
    return 'Равнина';
  }

  function phaseLabel(phase) {
    return phase === 'day' ? 'День' : phase === 'night' ? 'Ночь' : phase === 'sunset' ? 'Закат' : 'Рассвет';
  }

  function drawUI(ctx, canvas, state, phase) {
    const mobile = isMobileUi(canvas, state);
    const creative = !!(state.worldMeta && state.worldMeta.mode === 'creative');
    const panelW = mobile ? Math.min(canvas.width - 24, 252) : 280;
    const panelH = creative ? (mobile ? 54 : 72) : mobile ? 82 : 110;
    const panelX = 12;
    const panelY = mobile ? 12 : 12;

    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(panelX, panelY, panelW, panelH);

    ctx.fillStyle = '#fff';
    ctx.font = `${mobile ? 12 : 16}px Arial`;
    if (!creative) {
      ctx.fillText(`Жизни: ${Math.ceil(state.player.health)}/10`, panelX + 12, panelY + 20);
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
      ctx.fillRect(panelX + 12, healthBarY, barW * (state.player.health / 10), 10);

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
  }

  Game.uiRenderer = { drawHotbar, drawBreath, drawUI, getHotbarLayout, isMobileUi };
})();
