(() => {
  const Game = window.MC2D;
  const { getCraftingLayout } = Game.crafting;
  const { drawItem, drawDurabilityBar } = Game.itemRenderer;
  const { getItemDefinition } = Game.items;
  const { RECIPES } = Game.craftingRecipes;

  function drawSlot(ctx, rect, slot, highlighted = false) {
    ctx.fillStyle = highlighted ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.45)';
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    ctx.strokeStyle = highlighted ? '#ffffff' : 'rgba(255,255,255,0.28)';
    ctx.lineWidth = highlighted ? 3 : 2;
    ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);

    if (!slot || slot.id == null || slot.count <= 0) return;
    drawItem(ctx, slot.id, rect.x + 10, rect.y + 10, 28);
    if (slot.count > 1) {
      ctx.fillStyle = '#fff';
      ctx.font = '12px Arial';
      ctx.fillText(String(slot.count), rect.x + rect.w - 18, rect.y + rect.h - 10);
    }
    drawDurabilityBar(ctx, slot, rect.x, rect.y + rect.h, rect.w);
  }

  function drawSectionTitle(ctx, text, x, y) {
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 16px Arial';
    ctx.fillText(text, x, y);
  }

  function drawRecipeCard(ctx, recipe, x, y, w, h) {
    const cell = 12;
    const gap = 2;
    const startX = x + 10;
    const startY = y + 22;

    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, w, h);

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 11px Arial';
    ctx.fillText(recipe.name, x + 10, y + 14);

    for (let row = 0; row < 3; row += 1) {
      for (let col = 0; col < 3; col += 1) {
        const cellX = startX + col * (cell + gap);
        const cellY = startY + row * (cell + gap);
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.fillRect(cellX, cellY, cell, cell);
        ctx.strokeStyle = 'rgba(255,255,255,0.12)';
        ctx.strokeRect(cellX, cellY, cell, cell);

        const rowData = recipe.pattern[row];
        const itemId = rowData ? rowData[col] ?? null : null;
        if (itemId != null) drawItem(ctx, itemId, cellX, cellY, 12);
      }
    }

    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x + 57, y + 35);
    ctx.lineTo(x + 78, y + 35);
    ctx.lineTo(x + 72, y + 29);
    ctx.moveTo(x + 78, y + 35);
    ctx.lineTo(x + 72, y + 41);
    ctx.stroke();

    const resultRect = { x: x + 88, y: y + 20, w: 28, h: 28 };
    drawSlot(ctx, resultRect, recipe.result, true);
  }

  function drawRecipeHints(ctx, layout) {
    const area = layout.recipes;
    ctx.fillStyle = 'rgba(255,255,255,0.04)';
    ctx.fillRect(area.x, area.y, area.w, area.h);
    ctx.strokeStyle = 'rgba(255,255,255,0.16)';
    ctx.lineWidth = 2;
    ctx.strokeRect(area.x, area.y, area.w, area.h);

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 18px Arial';
    ctx.fillText('Подсказки рецептов', area.x + 16, area.y + 26);
    ctx.font = '12px Arial';
    ctx.fillStyle = 'rgba(255,255,255,0.82)';
    ctx.fillText('ЛКМ: взять/переместить весь стек', area.x + 16, area.y + 46);
    ctx.fillText('ПКМ: половина стека или 1 предмет', area.x + 16, area.y + 62);

    const cardW = 190;
    const cardH = 66;
    const gapX = 14;
    const gapY = 10;
    const startY = area.y + 82;

    for (let i = 0; i < RECIPES.length; i += 1) {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = area.x + 16 + col * (cardW + gapX);
      const y = startY + row * (cardH + gapY);
      drawRecipeCard(ctx, RECIPES[i], x, y, cardW, cardH);
    }
  }

  function drawCraftingOverlay(ctx, canvas, state, input) {
    if (!state.crafting || !state.crafting.open) return;

    const layout = getCraftingLayout(canvas);
    ctx.fillStyle = 'rgba(0,0,0,0.62)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = 'rgba(22,18,14,0.96)';
    ctx.fillRect(layout.panel.x, layout.panel.y, layout.panel.w, layout.panel.h);
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.lineWidth = 2;
    ctx.strokeRect(layout.panel.x, layout.panel.y, layout.panel.w, layout.panel.h);

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 24px Arial';
    ctx.fillText('Крафт и инвентарь', layout.panel.x + 32, layout.panel.y + 42);

    drawSectionTitle(ctx, 'Сетка крафта', layout.panel.x + 32, layout.panel.y + 64);
    for (let i = 0; i < layout.grid.length; i += 1) drawSlot(ctx, layout.grid[i], state.crafting.grid[i]);

    ctx.strokeStyle = 'rgba(255,255,255,0.45)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(layout.panel.x + 212, layout.panel.y + 158);
    ctx.lineTo(layout.panel.x + 240, layout.panel.y + 158);
    ctx.lineTo(layout.panel.x + 232, layout.panel.y + 148);
    ctx.moveTo(layout.panel.x + 240, layout.panel.y + 158);
    ctx.lineTo(layout.panel.x + 232, layout.panel.y + 168);
    ctx.stroke();

    const resultSlot = state.crafting.result ? state.crafting.result.result : null;
    drawSlot(ctx, layout.result, resultSlot, !!resultSlot);
    drawSectionTitle(ctx, 'Результат', layout.result.x - 4, layout.result.y - 12);

    drawSectionTitle(ctx, 'Инвентарь', layout.panel.x + 32, layout.panel.y + 258);
    for (let i = 0; i < layout.inventory.length; i += 1) {
      drawSlot(ctx, layout.inventory[i], state.player.inventory[i]);
    }

    drawSectionTitle(ctx, 'Хотбар', layout.panel.x + 32, layout.panel.y + 424);
    for (let i = 0; i < layout.hotbar.length; i += 1) {
      drawSlot(ctx, layout.hotbar[i], state.player.hotbar[i], i === state.player.selectedSlot);
    }

    if (resultSlot) {
      const def = getItemDefinition(resultSlot.id);
      ctx.font = '13px Arial';
      ctx.fillStyle = '#fff';
      ctx.fillText(def ? def.label : 'Результат', layout.result.x - 6, layout.result.y + layout.result.h + 18);
    }

    drawRecipeHints(ctx, layout);

    if (state.crafting.cursor && state.crafting.cursor.id != null && state.crafting.cursor.count > 0) {
      const cursorRect = { x: input.mouse.x - 20, y: input.mouse.y - 20, w: 40, h: 40 };
      drawSlot(ctx, cursorRect, state.crafting.cursor, true);
    }
  }

  Game.craftingRenderer = { drawCraftingOverlay };
})();
