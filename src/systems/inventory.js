(() => {
  const Game = window.MC2D;
  const { clamp } = Game.math;
  const { getItemDefinition, isPlaceableItem, getPlacedBlockId, isTool, getMaxDurability } = Game.items;

  function createSlot(id = null, count = 0, durability = null) {
    return { id, count, durability };
  }

  function isSlotEmpty(slot) {
    return !slot || slot.id == null || slot.count <= 0;
  }

  function normalizeSlot(slot) {
    if (!slot) return createSlot();
    if (slot.id == null || slot.count <= 0) {
      slot.id = null;
      slot.count = 0;
      slot.durability = null;
      return slot;
    }

    const maxDurability = getMaxDurability(slot.id);
    if (maxDurability > 0) {
      slot.count = 1;
      slot.durability = slot.durability == null ? maxDurability : clamp(slot.durability, 0, maxDurability);
      if (slot.durability <= 0) {
        slot.id = null;
        slot.count = 0;
        slot.durability = null;
      }
    } else {
      slot.durability = null;
    }

    return slot;
  }

  function cloneSlot(slot) {
    if (!slot) return createSlot();
    return createSlot(slot.id ?? null, slot.count ?? 0, slot.durability ?? null);
  }

  function copySlot(target, source) {
    if (!target) return;
    if (!source || source.id == null || source.count <= 0) {
      target.id = null;
      target.count = 0;
      target.durability = null;
      return;
    }
    target.id = source.id;
    target.count = source.count;
    target.durability = source.durability ?? null;
    normalizeSlot(target);
  }

  function getItemStackLimit(itemId) {
    const def = getItemDefinition(itemId);
    return def ? def.stackLimit : Game.constants.STACK_LIMIT;
  }

  function sameStackableItem(slot, itemId, durability = null) {
    return (
      !isSlotEmpty(slot) &&
      slot.id === itemId &&
      getItemStackLimit(itemId) > 1 &&
      (slot.durability ?? null) === (durability ?? null)
    );
  }

  function createItemStack(itemId, count = 1, durability = null) {
    const maxDurability = getMaxDurability(itemId);
    return normalizeSlot(createSlot(itemId, count, maxDurability > 0 ? (durability ?? maxDurability) : null));
  }

  function getStorageSlots(state) {
    return [...state.player.hotbar, ...state.player.inventory];
  }

  function eatFood(state) {
    if (state.player.food > 0) {
      state.player.food -= 1;
      state.player.satiety = clamp(state.player.satiety + 35, 0, 100);
    }
  }

  function addItemStackToSlots(slots, stack) {
    const incoming = createItemStack(stack.id, stack.count, stack.durability);
    if (isSlotEmpty(incoming)) return createSlot();

    let left = incoming.count;
    const limit = getItemStackLimit(incoming.id);
    const maxDurability = getMaxDurability(incoming.id);

    if (limit > 1) {
      for (const slot of slots) {
        if (sameStackableItem(slot, incoming.id, incoming.durability) && slot.count < limit) {
          const canAdd = Math.min(limit - slot.count, left);
          slot.count += canAdd;
          left -= canAdd;
          if (left <= 0) return createSlot();
        }
      }
    }

    for (const slot of slots) {
      if (isSlotEmpty(slot)) {
        const canAdd = Math.min(limit, left);
        slot.id = incoming.id;
        slot.count = canAdd;
        slot.durability = maxDurability > 0 ? incoming.durability : null;
        normalizeSlot(slot);
        left -= canAdd;
        if (left <= 0) return createSlot();
      }
    }

    return createItemStack(incoming.id, left, incoming.durability);
  }

  function addItemToSlots(slots, itemId, amount = 1, durability = null) {
    return addItemStackToSlots(slots, createItemStack(itemId, amount, durability)).count;
  }

  function addItem(state, itemId, amount = 1, slots = getStorageSlots(state), durability = null) {
    return isSlotEmpty(addItemStackToSlots(slots, createItemStack(itemId, amount, durability)));
  }

  function addToInventory(state, itemId, amount = 1, durability = null) {
    return addItem(state, itemId, amount, getStorageSlots(state), durability);
  }

  function removeFromSlot(slot, amount = 1) {
    if (isSlotEmpty(slot)) return null;
    const removedId = slot.id;
    slot.count -= amount;
    normalizeSlot(slot);
    return removedId;
  }

  function consumeSelectedPlaceable(state) {
    const slot = state.player.hotbar[state.player.selectedSlot];
    if (isSlotEmpty(slot) || !isPlaceableItem(slot.id)) return null;

    const itemId = removeFromSlot(slot, 1);
    return getPlacedBlockId(itemId);
  }

  function selectedPlaceableId(state) {
    const slot = state.player.hotbar[state.player.selectedSlot];
    return !isSlotEmpty(slot) && isPlaceableItem(slot.id) ? getPlacedBlockId(slot.id) : null;
  }

  function selectedItemId(state) {
    const slot = state.player.hotbar[state.player.selectedSlot];
    return !isSlotEmpty(slot) ? slot.id : null;
  }

  function selectedToolId(state) {
    const slot = state.player.hotbar[state.player.selectedSlot];
    return !isSlotEmpty(slot) && isTool(slot.id) ? slot.id : null;
  }

  function selectedToolSlot(state) {
    const slot = state.player.hotbar[state.player.selectedSlot];
    return !isSlotEmpty(slot) && isTool(slot.id) ? slot : null;
  }

  function damageSlotTool(slot, amount = 1) {
    if (isSlotEmpty(slot)) return false;
    const maxDurability = getMaxDurability(slot.id);
    if (maxDurability <= 0) return false;
    slot.durability = (slot.durability ?? maxDurability) - amount;
    normalizeSlot(slot);
    return true;
  }

  Game.inventory = {
    createSlot,
    createItemStack,
    cloneSlot,
    copySlot,
    isSlotEmpty,
    normalizeSlot,
    getItemStackLimit,
    getStorageSlots,
    addItemStackToSlots,
    addItemToSlots,
    addItem,
    eatFood,
    addToInventory,
    removeFromSlot,
    consumeSelectedPlaceable,
    selectedPlaceableId,
    selectedItemId,
    selectedToolId,
    selectedToolSlot,
    damageSlotTool,
  };
})();
