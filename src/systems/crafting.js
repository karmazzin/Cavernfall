(() => {
  const Game = window.MC2D;
  const {
    createSlot,
    createItemStack,
    cloneSlot,
    copySlot,
    isSlotEmpty,
    normalizeSlot,
    getItemStackLimit,
    getStorageSlots,
    addItemStackToSlots,
  } = Game.inventory;
  const { findMatchingRecipe } = Game.craftingRecipes;
  const { getNearestFurnace } = Game.furnaceSystem;
  const { isCreativeMode, getCreativeEntries } = Game.creativeInventory;

  function ensureCraftingState(state) {
    if (state.crafting) return state.crafting;
    state.crafting = {
      open: false,
      tab: 'craft',
      grid: Array.from({ length: 9 }, () => createSlot()),
      cursor: createSlot(),
      result: null,
    };
    return state.crafting;
  }

  function clearSlot(slot) {
    copySlot(slot, null);
  }

  function updateCraftingResult(state) {
    const crafting = ensureCraftingState(state);
    crafting.result = findMatchingRecipe(crafting.grid);
  }

  function returnSlotToStorage(state, slot) {
    if (isSlotEmpty(slot)) return;
    const leftover = addItemStackToSlots(getStorageSlots(state), cloneSlot(slot));
    copySlot(slot, leftover);
  }

  function openCrafting(state) {
    const crafting = ensureCraftingState(state);
    crafting.open = true;
    updateCraftingResult(state);
  }

  function closeCrafting(state) {
    const crafting = ensureCraftingState(state);
    for (const slot of crafting.grid) returnSlotToStorage(state, slot);
    returnSlotToStorage(state, crafting.cursor);
    if (!isSlotEmpty(crafting.cursor) || crafting.grid.some((slot) => !isSlotEmpty(slot))) return;
    crafting.open = false;
    updateCraftingResult(state);
  }

  function toggleCrafting(state) {
    if (state.gameOver || (state.pause && state.pause.open)) return;
    if (ensureCraftingState(state).open) closeCrafting(state);
    else openCrafting(state);
  }

  function slotRect(x, y, size) {
    return { x, y, w: size, h: size };
  }

  function contains(rect, px, py) {
    return px >= rect.x && px <= rect.x + rect.w && py >= rect.y && py <= rect.y + rect.h;
  }

  function getCraftingLayout(canvas, state) {
    const mobile = Game.uiRenderer && Game.uiRenderer.isMobileUi ? Game.uiRenderer.isMobileUi(canvas, state) : canvas.width < 900;
    const compact = mobile && canvas.height < 720;
    const slot = mobile ? (compact ? 26 : canvas.width < 420 ? 30 : 34) : 48;
    const gap = mobile ? 4 : 8;
    const panel = mobile
      ? {
          w: Math.min(canvas.width - 16, slot * 9 + gap * 8 + 28),
          h: Math.min(canvas.height - 20, compact ? 380 : 660),
          x: Math.floor((canvas.width - Math.min(canvas.width - 16, slot * 9 + gap * 8 + 28)) / 2),
          y: 10,
        }
      : {
          w: 1120,
          h: 560,
          x: Math.floor((canvas.width - 1120) / 2),
          y: Math.floor((canvas.height - 560) / 2),
        };

    const tabs = {
      craft: { x: panel.x + 16, y: panel.y + 36, w: mobile ? 88 : 108, h: 28 },
      creative: { x: panel.x + (mobile ? 110 : 132), y: panel.y + 36, w: mobile ? 118 : 142, h: 28 },
    };

    const grid = [];
    const gridStartX = panel.x + (mobile ? 16 : 32);
    const gridStartY = panel.y + (mobile ? 70 : 76);
    for (let row = 0; row < 3; row += 1) {
      for (let col = 0; col < 3; col += 1) {
        grid.push(slotRect(gridStartX + col * (slot + gap), gridStartY + row * (slot + gap), slot));
      }
    }

    const inventory = [];
    const inventoryStartX = panel.x + (mobile ? 14 : 32);
    const inventoryStartY = panel.y + (mobile ? (compact ? 234 : 294) : 272);
    for (let row = 0; row < 3; row += 1) {
      for (let col = 0; col < 9; col += 1) {
        inventory.push(slotRect(inventoryStartX + col * (slot + gap), inventoryStartY + row * (slot + gap), slot));
      }
    }

    const hotbar = [];
    const hotbarY = panel.y + (mobile ? (compact ? 334 : 406) : 438);
    for (let col = 0; col < 9; col += 1) {
      hotbar.push(slotRect(inventoryStartX + col * (slot + gap), hotbarY, slot));
    }

    return {
      panel,
      mobile,
      compact,
      slot,
      tabs,
      grid,
      result: mobile
        ? slotRect(panel.x + panel.w - slot - 18, panel.y + 104, slot + 8)
        : slotRect(panel.x + 250, panel.y + 130, 60),
      inventory,
      hotbar,
      recipes: mobile
        ? {
            x: panel.x + 14,
            y: panel.y + (compact ? 366 : 466),
            w: panel.w - 28,
            h: panel.h - (compact ? 378 : 478),
            compact: true,
          }
        : {
            x: panel.x + 560,
            y: panel.y + 76,
            w: 250,
            h: 452,
            compact: false,
          },
      furnace: {
        panel: mobile
          ? slotRect(panel.x + panel.w - 158, panel.y + 70, 144, 154)
          : slotRect(panel.x + 828, panel.y + 76, 260, 236),
        input: mobile
          ? slotRect(panel.x + panel.w - 142, panel.y + 106, slot)
          : slotRect(panel.x + 852, panel.y + 136, 48),
        fuel: mobile
          ? slotRect(panel.x + panel.w - 142, panel.y + 152, slot)
          : slotRect(panel.x + 852, panel.y + 212, 48),
        output: mobile
          ? slotRect(panel.x + panel.w - 70, panel.y + 128, slot + 6)
          : slotRect(panel.x + 1008, panel.y + 174, 56),
      },
      creative: {
        area: mobile
          ? { x: panel.x + 14, y: panel.y + 70, w: panel.w - 28, h: panel.h - 90 }
          : { x: panel.x + 560, y: panel.y + 76, w: 528, h: 452 },
      },
    };
  }

  function canMergeInto(slot, stack) {
    if (isSlotEmpty(slot) || isSlotEmpty(stack)) return false;
    return (
      slot.id === stack.id &&
      getItemStackLimit(slot.id) > 1 &&
      (slot.durability ?? null) === (stack.durability ?? null) &&
      slot.count < getItemStackLimit(slot.id)
    );
  }

  function takeHalf(slot, cursor) {
    const taken = Math.ceil(slot.count / 2);
    copySlot(cursor, createItemStack(slot.id, taken, slot.durability));
    slot.count -= taken;
    normalizeSlot(slot);
  }

  function placeOne(cursor, slot) {
    if (isSlotEmpty(cursor)) return;
    if (isSlotEmpty(slot)) {
      copySlot(slot, createItemStack(cursor.id, 1, cursor.durability));
      cursor.count -= 1;
      normalizeSlot(cursor);
      return;
    }

    if (canMergeInto(slot, cursor)) {
      slot.count += 1;
      cursor.count -= 1;
      normalizeSlot(slot);
      normalizeSlot(cursor);
    }
  }

  function handleLeftClick(cursor, slot) {
    if (isSlotEmpty(cursor)) {
      if (!isSlotEmpty(slot)) {
        copySlot(cursor, slot);
        clearSlot(slot);
      }
      return;
    }

    if (isSlotEmpty(slot)) {
      copySlot(slot, cursor);
      clearSlot(cursor);
      return;
    }

    if (canMergeInto(slot, cursor)) {
      const limit = getItemStackLimit(slot.id);
      const moved = Math.min(limit - slot.count, cursor.count);
      slot.count += moved;
      cursor.count -= moved;
      normalizeSlot(slot);
      normalizeSlot(cursor);
      return;
    }

    const temp = cloneSlot(slot);
    copySlot(slot, cursor);
    copySlot(cursor, temp);
  }

  function handleRightClick(cursor, slot) {
    if (isSlotEmpty(cursor)) {
      if (!isSlotEmpty(slot)) takeHalf(slot, cursor);
      return;
    }
    placeOne(cursor, slot);
  }

  function handleSlotClick(crafting, slot, button) {
    if (button === 2) handleRightClick(crafting.cursor, slot);
    else handleLeftClick(crafting.cursor, slot);
  }

  function consumeCraftIngredients(crafting) {
    for (const slot of crafting.grid) {
      if (!isSlotEmpty(slot)) {
        slot.count -= 1;
        normalizeSlot(slot);
      }
    }
  }

  function canCursorTakeResult(cursor, stack) {
    if (isSlotEmpty(cursor)) return true;
    return canMergeInto(cursor, stack) && cursor.count + stack.count <= getItemStackLimit(cursor.id);
  }

  function handleResultClick(state) {
    const crafting = ensureCraftingState(state);
    if (!crafting.result) return;

    const resultStack = createItemStack(
      crafting.result.result.id,
      crafting.result.result.count,
      crafting.result.result.durability
    );

    if (!canCursorTakeResult(crafting.cursor, resultStack)) return;

    if (isSlotEmpty(crafting.cursor)) copySlot(crafting.cursor, resultStack);
    else crafting.cursor.count += resultStack.count;

    normalizeSlot(crafting.cursor);
    consumeCraftIngredients(crafting);
    updateCraftingResult(state);
  }

  function handleOutputOnlyClick(crafting, slot, button) {
    const cursor = crafting.cursor;
    if (button === 2) {
      if (isSlotEmpty(cursor) && !isSlotEmpty(slot)) takeHalf(slot, cursor);
      return;
    }

    if (isSlotEmpty(cursor)) {
      if (!isSlotEmpty(slot)) {
        copySlot(cursor, slot);
        clearSlot(slot);
      }
      return;
    }

    if (canMergeInto(cursor, slot) && cursor.count + slot.count <= getItemStackLimit(cursor.id)) {
      cursor.count += slot.count;
      clearSlot(slot);
      normalizeSlot(cursor);
    }
  }

  function getCreativeTargetSlots(state) {
    const selected = state.player.hotbar[state.player.selectedSlot];
    const rest = getStorageSlots(state).filter((slot) => slot !== selected);
    return [selected, ...rest];
  }

  function giveCreativeEntry(state, entry, button) {
    const crafting = ensureCraftingState(state);
    if (button === 2) {
      copySlot(crafting.cursor, entry);
      return;
    }

    const leftover = addItemStackToSlots(getCreativeTargetSlots(state), cloneSlot(entry));
    if (!isSlotEmpty(leftover)) copySlot(crafting.cursor, leftover);
  }

  function handleCraftingPointer(state, input, canvas) {
    const crafting = ensureCraftingState(state);
    if (!crafting.open || !input.mouse.justPressed) return false;

    const layout = getCraftingLayout(canvas, state);
    const { x, y, button } = input.mouse;
    const activeFurnace = getNearestFurnace(state, 5);
    const creative = isCreativeMode(state);

    if (contains(layout.tabs.craft, x, y)) {
      crafting.tab = 'craft';
      input.mouse.justPressed = false;
      return true;
    }

    if (creative && contains(layout.tabs.creative, x, y)) {
      crafting.tab = 'creative';
      input.mouse.justPressed = false;
      return true;
    }

    if (creative && crafting.tab === 'creative') {
      const entries = getCreativeEntries();
      const cols = layout.mobile ? 6 : 8;
      const cell = layout.mobile ? 34 : 44;
      const gap = layout.mobile ? 6 : 8;
      const startX = layout.creative.area.x + 12;
      const startY = layout.creative.area.y + 48;
      for (let i = 0; i < entries.length; i += 1) {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const rect = slotRect(startX + col * (cell + gap), startY + row * (cell + gap), cell);
        if (!contains(rect, x, y)) continue;
        giveCreativeEntry(state, entries[i], button);
        input.mouse.justPressed = false;
        return true;
      }
    }

    if (crafting.tab !== 'craft') {
      if (layout.mobile && !contains(layout.panel, x, y)) {
        closeCrafting(state);
        input.mouse.justPressed = false;
        return true;
      }
      input.mouse.justPressed = false;
      return true;
    }

    for (let i = 0; i < layout.grid.length; i += 1) {
      if (contains(layout.grid[i], x, y)) {
        handleSlotClick(crafting, crafting.grid[i], button);
        updateCraftingResult(state);
        input.mouse.justPressed = false;
        return true;
      }
    }

    for (let i = 0; i < layout.inventory.length; i += 1) {
      if (contains(layout.inventory[i], x, y)) {
        handleSlotClick(crafting, state.player.inventory[i], button);
        updateCraftingResult(state);
        input.mouse.justPressed = false;
        return true;
      }
    }

    for (let i = 0; i < layout.hotbar.length; i += 1) {
      if (contains(layout.hotbar[i], x, y)) {
        handleSlotClick(crafting, state.player.hotbar[i], button);
        updateCraftingResult(state);
        input.mouse.justPressed = false;
        return true;
      }
    }

    if (contains(layout.result, x, y)) {
      handleResultClick(state);
      input.mouse.justPressed = false;
      return true;
    }

    if (activeFurnace) {
      const furnace = activeFurnace.furnace;
      if (contains(layout.furnace.input, x, y)) {
        handleSlotClick(crafting, furnace.input, button);
        input.mouse.justPressed = false;
        return true;
      }
      if (contains(layout.furnace.fuel, x, y)) {
        handleSlotClick(crafting, furnace.fuel, button);
        input.mouse.justPressed = false;
        return true;
      }
      if (contains(layout.furnace.output, x, y)) {
        handleOutputOnlyClick(crafting, furnace.output, button);
        input.mouse.justPressed = false;
        return true;
      }
    }

    if (layout.mobile && !contains(layout.panel, x, y)) {
      closeCrafting(state);
      input.mouse.justPressed = false;
      return true;
    }

    input.mouse.justPressed = false;
    return true;
  }

  Game.crafting = {
    ensureCraftingState,
    updateCraftingResult,
    openCrafting,
    closeCrafting,
    toggleCrafting,
    getCraftingLayout,
    handleCraftingPointer,
  };
})();
