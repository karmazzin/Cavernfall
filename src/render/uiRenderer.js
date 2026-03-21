(() => {
  const Game = window.MC2D;
  const { TILE, HOTBAR_SIZE, BREATH_MAX, BREATH_CELL_SECONDS } = Game.constants;
  const { getLocationInfo } = Game.world;
  const { getItemDefinition } = Game.items;
  const { drawItem, drawDurabilityBar } = Game.itemRenderer;

  function drawHotbar(ctx, canvas, state) {
    const box = 44;
    const gap = 6;
    const total = HOTBAR_SIZE * box + (HOTBAR_SIZE - 1) * gap;
    const startX = Math.floor((canvas.width - total) / 2);
    const y = canvas.height - 62;

    for (let i = 0; i < HOTBAR_SIZE; i += 1) {
      const x = startX + i * (box + gap);
      const slot = state.player.hotbar[i];
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(x, y, box, box);
      ctx.lineWidth = i === state.player.selectedSlot ? 3 : 2;
      ctx.strokeStyle = i === state.player.selectedSlot ? '#ffffff' : 'rgba(255,255,255,0.35)';
      ctx.strokeRect(x, y, box, box);
      ctx.fillStyle = '#fff';
      ctx.font = '12px Arial';
      ctx.fillText(String(i + 1), x + 4, y + 13);

      if (slot.id && slot.count > 0) {
        drawItem(ctx, slot.id, x + 10, y + 10, 24);
        if (slot.count > 1) {
          ctx.fillStyle = '#fff';
          ctx.font = '12px Arial';
          ctx.fillText(String(slot.count), x + 22, y + 36);
        }
        drawDurabilityBar(ctx, slot, x, y + box, box);
      }
    }
  }

  function drawBreath(ctx, state) {
    if (!state.player.inWater) return;

    const fullCells = Math.ceil(state.player.breath / BREATH_CELL_SECONDS);
    const x0 = 24;
    const y = 180;

    for (let i = 0; i < BREATH_MAX; i += 1) {
      ctx.strokeStyle = 'rgba(255,255,255,0.7)';
      ctx.strokeRect(x0 + i * 16, y, 12, 12);
      if (i < fullCells) {
        ctx.fillStyle = '#8fe8ff';
        ctx.fillRect(x0 + i * 16 + 1, y + 1, 10, 10);
      }
    }

    ctx.fillStyle = '#fff';
    ctx.font = '14px Arial';
    ctx.fillText('Дыхание', x0, y - 8);
  }

  function drawUI(ctx, canvas, state, phase) {
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(12, 12, 280, 110);

    ctx.fillStyle = '#fff';
    ctx.font = '16px Arial';
    ctx.fillText(`Жизни: ${Math.ceil(state.player.health)}/10`, 24, 36);
    ctx.fillText(`Сытость: ${Math.ceil(state.player.satiety)}/100`, 24, 58);
    ctx.fillText(`Еда: ${state.player.food}`, 24, 80);

    const tx = Math.floor((state.player.x + state.player.w / 2) / TILE);
    const ty = Math.floor((state.player.y + state.player.h / 2) / TILE);
    const biomeKey = getLocationInfo(state, tx, ty).biome;
    const biome = biomeKey === 'forest' ? 'Лес' : biomeKey === 'lake' ? 'Озеро' : biomeKey === 'cave' ? 'Пещера' : 'Равнина';
    ctx.fillText(`Биом: ${biome}`, 160, 36);
    ctx.fillText(`Фаза: ${phase.phase === 'day' ? 'День' : phase.phase === 'night' ? 'Ночь' : phase.phase === 'sunset' ? 'Закат' : 'Рассвет'}`, 160, 58);
    ctx.fillText(`В воде: ${state.player.inWater ? 'Да' : 'Нет'}`, 160, 80);

    ctx.fillStyle = '#444';
    ctx.fillRect(24, 130, 240, 12);
    ctx.fillStyle = '#e53935';
    ctx.fillRect(24, 130, 240 * (state.player.health / 10), 12);

    ctx.fillStyle = '#444';
    ctx.fillRect(24, 148, 240, 12);
    ctx.fillStyle = '#ffb300';
    ctx.fillRect(24, 148, 240 * (state.player.satiety / 100), 12);

    drawBreath(ctx, state);
    drawHotbar(ctx, canvas, state);
  }

  Game.uiRenderer = { drawHotbar, drawBreath, drawUI };
})();
