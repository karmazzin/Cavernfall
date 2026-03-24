(() => {
  const Game = window.MC2D;
  const { getCraftingLayout } = Game.crafting;
  const { drawItem, drawDurabilityBar } = Game.itemRenderer;
  const { getItemDefinition } = Game.items;
  const { RECIPES } = Game.craftingRecipes;
  const { getNearestFurnace } = Game.furnaceSystem;
  const { ARMOR_SLOT_ORDER, ensureArmorSlots } = Game.combat;
  const { isCreativeMode, getCreativeEntries } = Game.creativeInventory;
  const { getTraderOffers, getTraderTitle, canAfford } = Game.tradeSystem;
  const tooltipEl = document.getElementById('itemTooltip');

  function drawSlot(ctx, rect, slot, highlighted = false) {
    ctx.fillStyle = highlighted ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.45)';
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    ctx.strokeStyle = highlighted ? '#ffffff' : 'rgba(255,255,255,0.28)';
    ctx.lineWidth = highlighted ? 3 : 2;
    ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);

    if (!slot || slot.id == null || slot.count <= 0) return;
    const itemSize = Math.max(18, rect.w - 20);
    drawItem(ctx, slot.id, rect.x + Math.floor((rect.w - itemSize) / 2), rect.y + Math.floor((rect.h - itemSize) / 2) - 2, itemSize);
    if (slot.count > 1) {
      ctx.fillStyle = '#fff';
      ctx.font = '12px Arial';
      ctx.fillText(String(slot.count), rect.x + rect.w - 18, rect.y + rect.h - 10);
    }
    drawDurabilityBar(ctx, slot, rect.x, rect.y + rect.h, rect.w);
  }

  function showTooltip(canvas, anchorRect, title, subtitle) {
    if (!tooltipEl) return;
    const canvasRect = canvas.getBoundingClientRect();
    const width = Math.min(260, Math.max(140, Math.max(title.length * 8, subtitle ? subtitle.length * 7 : 0) + 24));
    const x = canvasRect.left + anchorRect.x + anchorRect.w + 12;
    const y = canvasRect.top + anchorRect.y + anchorRect.h / 2 - 12;
    tooltipEl.classList.remove('is-hidden');
    tooltipEl.style.left = `${Math.max(8, Math.min(x, window.innerWidth - width - 8))}px`;
    tooltipEl.style.top = `${Math.max(8, Math.min(y, window.innerHeight - 64))}px`;
    tooltipEl.style.width = `${width}px`;
    tooltipEl.innerHTML = `<div class="item-tooltip-title">${title}</div>${subtitle ? `<div class="item-tooltip-subtitle">${subtitle}</div>` : ''}`;
  }

  function hideTooltip() {
    if (!tooltipEl) return;
    tooltipEl.classList.add('is-hidden');
  }

  function slotTooltipText(slot) {
    if (!slot || slot.id == null || slot.count <= 0) return null;
    const def = getItemDefinition(slot.id);
    if (!def) return null;
    return {
      title: def.label,
      subtitle: `${slot.count} шт.`,
    };
  }

  function drawSectionTitle(ctx, text, x, y, mobile = false) {
    ctx.fillStyle = '#fff';
    ctx.font = `bold ${mobile ? 14 : 16}px Arial`;
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
    if (area.h <= 24) return;
    ctx.fillStyle = 'rgba(255,255,255,0.04)';
    ctx.fillRect(area.x, area.y, area.w, area.h);
    ctx.strokeStyle = 'rgba(255,255,255,0.16)';
    ctx.lineWidth = 2;
    ctx.strokeRect(area.x, area.y, area.w, area.h);

    ctx.fillStyle = '#fff';
    ctx.font = `bold ${layout.mobile ? 15 : 18}px Arial`;
    ctx.fillText('Подсказки рецептов', area.x + 16, area.y + 26);
    ctx.font = `${layout.mobile ? 11 : 12}px Arial`;
    ctx.fillStyle = 'rgba(255,255,255,0.82)';
    ctx.fillText('ЛКМ: весь стек', area.x + 16, area.y + 44);
    if (!layout.mobile) ctx.fillText('ПКМ: половина стека или 1 предмет', area.x + 16, area.y + 62);

    const cardW = layout.mobile ? Math.floor((area.w - 42) / 2) : 218;
    const cardH = layout.mobile ? 58 : 66;
    const gapY = layout.mobile ? 8 : 10;
    const startY = area.y + (layout.mobile ? 58 : 82);

    for (let i = 0; i < RECIPES.length; i += 1) {
      const x = layout.mobile ? area.x + 16 + (i % 2) * (cardW + 10) : area.x + 16;
      const y = layout.mobile ? startY + Math.floor(i / 2) * (cardH + gapY) : startY + i * (cardH + gapY);
      if (y + cardH > area.y + area.h - 8) break;
      drawRecipeCard(ctx, RECIPES[i], x, y, cardW, cardH);
    }
  }

  function drawFurnacePanel(ctx, layout, activeFurnace) {
    const panel = layout.furnace.panel;
    const furnace = activeFurnace.furnace;

    ctx.fillStyle = 'rgba(255,255,255,0.04)';
    ctx.fillRect(panel.x, panel.y, panel.w, panel.h);
    ctx.strokeStyle = 'rgba(255,255,255,0.16)';
    ctx.lineWidth = 2;
    ctx.strokeRect(panel.x, panel.y, panel.w, panel.h);

    ctx.fillStyle = '#fff';
    ctx.font = `bold ${layout.mobile ? 15 : 18}px Arial`;
    ctx.fillText('Печка', panel.x + 16, panel.y + 26);
    ctx.font = `${layout.mobile ? 10 : 12}px Arial`;
    ctx.fillStyle = 'rgba(255,255,255,0.82)';
    if (!layout.mobile) ctx.fillText('Доступна рядом с установленной печкой', panel.x + 16, panel.y + 44);

    drawSlot(ctx, layout.furnace.input, furnace.input);
    drawSlot(ctx, layout.furnace.fuel, furnace.fuel);
    drawSlot(ctx, layout.furnace.output, furnace.output);

    ctx.fillStyle = '#fff';
    ctx.font = '12px Arial';
    ctx.fillText('Вход', layout.furnace.input.x, layout.furnace.input.y - 6);
    ctx.fillText('Топл.', layout.furnace.fuel.x, layout.furnace.fuel.y - 6);
    ctx.fillText('Выход', layout.furnace.output.x, layout.furnace.output.y - 6);

    ctx.strokeStyle = 'rgba(255,255,255,0.45)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(panel.x + (layout.mobile ? 56 : 98), panel.y + (layout.mobile ? 95 : 164));
    ctx.lineTo(panel.x + (layout.mobile ? 86 : 144), panel.y + (layout.mobile ? 95 : 164));
    ctx.lineTo(panel.x + (layout.mobile ? 80 : 136), panel.y + (layout.mobile ? 87 : 156));
    ctx.moveTo(panel.x + (layout.mobile ? 86 : 144), panel.y + (layout.mobile ? 95 : 164));
    ctx.lineTo(panel.x + (layout.mobile ? 80 : 136), panel.y + (layout.mobile ? 103 : 172));
    ctx.stroke();

    const burnRatio = furnace.burnTotal > 0 ? Math.max(0, Math.min(1, furnace.burnTime / furnace.burnTotal)) : 0;
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(panel.x + (layout.mobile ? 22 : 48), panel.y + (layout.mobile ? 104 : 176), 12, layout.mobile ? 28 : 40);
    if (burnRatio > 0) {
      ctx.fillStyle = '#ffb347';
      const burnHeight = layout.mobile ? 26 : 38;
      const burnX = panel.x + (layout.mobile ? 23 : 49);
      const burnY = panel.y + (layout.mobile ? 105 : 177);
      ctx.fillRect(burnX, burnY + (burnHeight * (1 - burnRatio)), 10, burnHeight * burnRatio);
    }

    const recipe = furnace.input && furnace.input.id != null ? Game.furnaceSystem.getSmeltRecipe(furnace.input.id) : null;
    const progressRatio = recipe ? Math.max(0, Math.min(1, furnace.progress / recipe.time)) : 0;
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    const progressX = panel.x + (layout.mobile ? 72 : 112);
    const progressY = panel.y + (layout.mobile ? 88 : 156);
    const progressW = layout.mobile ? 42 : 58;
    const progressH = layout.mobile ? 12 : 16;
    ctx.fillRect(progressX, progressY, progressW, progressH);
    if (progressRatio > 0) {
      ctx.fillStyle = '#ffd36e';
      ctx.fillRect(progressX + 1, progressY + 1, (progressW - 2) * progressRatio, progressH - 2);
    }
  }

  function getChestSlotRects(layout) {
    const rects = [];
    const panel = layout.chest.panel;
    const slot = layout.mobile ? 28 : 38;
    const gap = layout.mobile ? 4 : 6;
    const startX = panel.x + 14;
    const startY = panel.y + 36;
    for (let row = 0; row < 3; row += 1) {
      for (let col = 0; col < 4; col += 1) rects.push({ x: startX + col * (slot + gap), y: startY + row * (slot + gap), w: slot, h: slot });
    }
    return rects;
  }

  function drawChestPanel(ctx, layout, activeChest) {
    const panel = layout.chest.panel;
    ctx.fillStyle = 'rgba(255,255,255,0.04)';
    ctx.fillRect(panel.x, panel.y, panel.w, panel.h);
    ctx.strokeStyle = 'rgba(255,255,255,0.16)';
    ctx.lineWidth = 2;
    ctx.strokeRect(panel.x, panel.y, panel.w, panel.h);
    ctx.fillStyle = '#fff';
    ctx.font = `bold ${layout.mobile ? 14 : 18}px Arial`;
    ctx.fillText('Сундук', panel.x + 12, panel.y + 22);
    const slots = getChestSlotRects(layout);
    for (let i = 0; i < slots.length; i += 1) drawSlot(ctx, slots[i], activeChest.chest.slots[i]);
  }

  function armorSlotLabel(slotId) {
    if (slotId === 'head') return 'Шлем';
    if (slotId === 'chest') return 'Тело';
    if (slotId === 'legs') return 'Ноги';
    return 'Ступни';
  }

  function drawArmorSlots(ctx, layout, state) {
    const armor = ensureArmorSlots(state.player);
    const entries = Game.crafting.getArmorSlotRects(layout);
    const titleX = layout.mobile ? layout.panel.x + 14 : layout.panel.x + 332;
    const titleY = layout.mobile ? entries[0].rect.y - 10 : layout.panel.y + 82;
    drawSectionTitle(ctx, 'Броня', titleX, titleY, layout.mobile);
    ctx.font = `${layout.mobile ? 10 : 11}px Arial`;
    ctx.fillStyle = 'rgba(255,255,255,0.75)';

    for (const entry of entries) {
      drawSlot(ctx, entry.rect, armor[entry.slotId]);
      if (layout.mobile) continue;
      ctx.fillText(armorSlotLabel(entry.slotId), entry.rect.x + 60, entry.rect.y + 28);
    }
  }

  function drawTradePanel(ctx, layout, state, trader) {
    const panel = layout.trade.panel;
    const offers = getTraderOffers(trader);
    ctx.fillStyle = 'rgba(255,255,255,0.04)';
    ctx.fillRect(panel.x, panel.y, panel.w, panel.h);
    ctx.strokeStyle = 'rgba(255,255,255,0.16)';
    ctx.lineWidth = 2;
    ctx.strokeRect(panel.x, panel.y, panel.w, panel.h);
    ctx.fillStyle = '#fff';
    ctx.font = `bold ${layout.mobile ? 14 : 18}px Arial`;
    ctx.fillText('Торговля', panel.x + 12, panel.y + 22);
    ctx.font = `${layout.mobile ? 10 : 12}px Arial`;
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.fillText(getTraderTitle(trader), panel.x + 12, panel.y + 38);
    const offerHeight = layout.mobile ? 26 : 34;
    const startX = panel.x + 10;
    const startY = panel.y + 46;
    for (let i = 0; i < offers.length; i += 1) {
      const offer = offers[i];
      const y = startY + i * (offerHeight + 6);
      ctx.fillStyle = canAfford(state, offer) ? 'rgba(88,122,88,0.28)' : 'rgba(100,100,100,0.18)';
      ctx.fillRect(startX, y, panel.w - 20, offerHeight);
      ctx.strokeStyle = 'rgba(255,255,255,0.15)';
      ctx.strokeRect(startX, y, panel.w - 20, offerHeight);
      ctx.fillStyle = '#fff';
      ctx.fillText(`${offer.cost} мон. -> ${offer.label}`, startX + 8, y + (layout.mobile ? 17 : 22));
    }
    if (state.crafting.tradeStatus) {
      ctx.fillStyle = '#ffd36e';
      ctx.fillText(state.crafting.tradeStatus, panel.x + 12, panel.y + panel.h - 10);
    }
  }

  function drawCraftingOverlay(ctx, canvas, state, input) {
    if (!state.crafting || !state.crafting.open) return;

    const layout = getCraftingLayout(canvas, state);
    const activeFurnace = getNearestFurnace(state, 5);
    const activeChest = Game.crafting.getActiveChest(state);
    const trader = Game.crafting.getActiveTrader(state) || Game.crafting.getActiveHumanTrader(state);
    const creative = isCreativeMode(state);
    let tooltipVisible = false;
    ctx.fillStyle = 'rgba(0,0,0,0.62)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = 'rgba(22,18,14,0.96)';
    ctx.fillRect(layout.panel.x, layout.panel.y, layout.panel.w, layout.panel.h);
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.lineWidth = 2;
    ctx.strokeRect(layout.panel.x, layout.panel.y, layout.panel.w, layout.panel.h);

    ctx.fillStyle = '#fff';
    ctx.font = `bold ${layout.mobile ? 18 : 24}px Arial`;
    ctx.fillText('Крафт и инвентарь', layout.panel.x + (layout.mobile ? 16 : 32), layout.panel.y + (layout.mobile ? 30 : 42));

    const activeTab = state.crafting.tab || 'craft';
    for (const [tabId, rect] of Object.entries(layout.tabs)) {
      if (tabId === 'creative' && !creative) continue;
      ctx.fillStyle = activeTab === tabId ? 'rgba(227,155,86,0.25)' : 'rgba(255,255,255,0.05)';
      ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
      ctx.strokeStyle = activeTab === tabId ? 'rgba(227,155,86,0.8)' : 'rgba(255,255,255,0.18)';
      ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
      ctx.fillStyle = '#fff';
      ctx.font = `${layout.mobile ? 12 : 14}px Arial`;
      ctx.fillText(tabId === 'creative' ? 'Творческий' : 'Крафт', rect.x + 10, rect.y + 18);
    }

    if (creative && activeTab === 'creative') {
      const area = layout.creative.area;
      ctx.fillStyle = 'rgba(255,255,255,0.04)';
      ctx.fillRect(area.x, area.y, area.w, area.h);
      ctx.strokeStyle = 'rgba(255,255,255,0.16)';
      ctx.strokeRect(area.x, area.y, area.w, area.h);
      ctx.fillStyle = '#fff';
      ctx.font = `bold ${layout.mobile ? 16 : 18}px Arial`;
      ctx.fillText('Творческий инвентарь', area.x + 12, area.y + 26);

      const entries = getCreativeEntries();
      const cols = layout.mobile ? 6 : 8;
      const cell = layout.mobile ? 34 : 44;
      const gap = layout.mobile ? 6 : 8;
      const startX = area.x + 12;
      const startY = area.y + 48;
      for (let i = 0; i < entries.length; i += 1) {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const rect = { x: startX + col * (cell + gap), y: startY + row * (cell + gap), w: cell, h: cell };
        if (rect.y + rect.h > area.y + area.h - 8) break;
        drawSlot(ctx, rect, entries[i]);
        if (input.mouse && input.mouse.x >= rect.x && input.mouse.x <= rect.x + rect.w && input.mouse.y >= rect.y && input.mouse.y <= rect.y + rect.h) {
          const tip = slotTooltipText(entries[i]);
          if (tip) {
            showTooltip(canvas, rect, tip.title, tip.subtitle);
            tooltipVisible = true;
          }
        }
      }

      if (state.crafting.cursor && state.crafting.cursor.id != null && state.crafting.cursor.count > 0) {
        const cursorRect = { x: input.mouse.x - 20, y: input.mouse.y - 20, w: 40, h: 40 };
        drawSlot(ctx, cursorRect, state.crafting.cursor, true);
      }
      return;
    }

    drawSectionTitle(ctx, 'Сетка крафта', layout.panel.x + (layout.mobile ? 16 : 32), layout.panel.y + (layout.mobile ? 52 : 64), layout.mobile);
    for (let i = 0; i < layout.grid.length; i += 1) drawSlot(ctx, layout.grid[i], state.crafting.grid[i]);

    ctx.strokeStyle = 'rgba(255,255,255,0.45)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(layout.mobile ? layout.panel.x + 140 : layout.panel.x + 212, layout.mobile ? layout.panel.y + 122 : layout.panel.y + 158);
    ctx.lineTo(layout.mobile ? layout.panel.x + 162 : layout.panel.x + 240, layout.mobile ? layout.panel.y + 122 : layout.panel.y + 158);
    ctx.lineTo(layout.mobile ? layout.panel.x + 156 : layout.panel.x + 232, layout.mobile ? layout.panel.y + 114 : layout.panel.y + 148);
    ctx.moveTo(layout.mobile ? layout.panel.x + 162 : layout.panel.x + 240, layout.mobile ? layout.panel.y + 122 : layout.panel.y + 158);
    ctx.lineTo(layout.mobile ? layout.panel.x + 156 : layout.panel.x + 232, layout.mobile ? layout.panel.y + 130 : layout.panel.y + 168);
    ctx.stroke();

    const resultSlot = state.crafting.result ? state.crafting.result.result : null;
    drawSlot(ctx, layout.result, resultSlot, !!resultSlot);
    drawSectionTitle(ctx, 'Результат', layout.result.x - 4, layout.result.y - 10, layout.mobile);

    drawSectionTitle(ctx, 'Инвентарь', layout.panel.x + (layout.mobile ? 14 : 32), layout.inventory[0].y - 12, layout.mobile);
    drawArmorSlots(ctx, layout, state);
    for (let i = 0; i < layout.inventory.length; i += 1) {
      drawSlot(ctx, layout.inventory[i], state.player.inventory[i]);
      if (input.mouse && input.mouse.x >= layout.inventory[i].x && input.mouse.x <= layout.inventory[i].x + layout.inventory[i].w && input.mouse.y >= layout.inventory[i].y && input.mouse.y <= layout.inventory[i].y + layout.inventory[i].h) {
        const tip = slotTooltipText(state.player.inventory[i]);
        if (tip) {
          showTooltip(canvas, layout.inventory[i], tip.title, tip.subtitle);
          tooltipVisible = true;
        }
      }
    }

    drawSectionTitle(ctx, 'Хотбар', layout.panel.x + (layout.mobile ? 14 : 32), layout.hotbar[0].y - 10, layout.mobile);
    for (let i = 0; i < layout.hotbar.length; i += 1) {
      drawSlot(ctx, layout.hotbar[i], state.player.hotbar[i], i === state.player.selectedSlot);
      if (input.mouse && input.mouse.x >= layout.hotbar[i].x && input.mouse.x <= layout.hotbar[i].x + layout.hotbar[i].w && input.mouse.y >= layout.hotbar[i].y && input.mouse.y <= layout.hotbar[i].y + layout.hotbar[i].h) {
        const tip = slotTooltipText(state.player.hotbar[i]);
        if (tip) {
          showTooltip(canvas, layout.hotbar[i], tip.title, tip.subtitle);
          tooltipVisible = true;
        }
      }
    }

    if (resultSlot) {
      const def = getItemDefinition(resultSlot.id);
      ctx.font = `${layout.mobile ? 11 : 13}px Arial`;
      ctx.fillStyle = '#fff';
      ctx.fillText(def ? def.label : 'Результат', layout.result.x - 6, layout.result.y + layout.result.h + 18);
    }

    drawRecipeHints(ctx, layout);
    if (activeFurnace) drawFurnacePanel(ctx, layout, activeFurnace);
    if (activeChest) drawChestPanel(ctx, layout, activeChest);
    if (trader) drawTradePanel(ctx, layout, state, trader);

    if (state.crafting.cursor && state.crafting.cursor.id != null && state.crafting.cursor.count > 0) {
      const cursorRect = { x: input.mouse.x - 20, y: input.mouse.y - 20, w: 40, h: 40 };
      drawSlot(ctx, cursorRect, state.crafting.cursor, true);
    }

    if (input.mouse) {
      const armor = ensureArmorSlots(state.player);
      for (const entry of Game.crafting.getArmorSlotRects(layout)) {
        if (input.mouse.x >= entry.rect.x && input.mouse.x <= entry.rect.x + entry.rect.w && input.mouse.y >= entry.rect.y && input.mouse.y <= entry.rect.y + entry.rect.h) {
          const tip = slotTooltipText(armor[entry.slotId]);
          if (tip) {
            showTooltip(canvas, entry.rect, tip.title, tip.subtitle);
            tooltipVisible = true;
          }
        }
      }
    }

    if (!tooltipVisible) hideTooltip();
  }

  Game.craftingRenderer = { drawCraftingOverlay };
})();
