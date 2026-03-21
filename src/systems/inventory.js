(() => {
  const Game = window.MC2D;
  const { STACK_LIMIT } = Game.constants;
  const { PLACEABLE } = Game.blocks;
  const { clamp } = Game.math;

  function eatFood(state) {
    if (state.player.food > 0) {
      state.player.food -= 1;
      state.player.satiety = clamp(state.player.satiety + 35, 0, 100);
    }
  }

  function addToInventory(state, blockId, amount = 1) {
    if (!PLACEABLE.has(blockId)) return false;

    let left = amount;

    for (const slot of state.player.hotbar) {
      if (slot.id === blockId && slot.count < STACK_LIMIT) {
        const canAdd = Math.min(STACK_LIMIT - slot.count, left);
        slot.count += canAdd;
        left -= canAdd;
        if (left <= 0) return true;
      }
    }

    for (const slot of state.player.hotbar) {
      if (!slot.id || slot.count <= 0) {
        slot.id = blockId;
        const canAdd = Math.min(STACK_LIMIT, left);
        slot.count = canAdd;
        left -= canAdd;
        if (left <= 0) return true;
      }
    }

    return left <= 0;
  }

  function consumeSelectedBlock(state) {
    const slot = state.player.hotbar[state.player.selectedSlot];
    if (!slot || !slot.id || slot.count <= 0) return null;

    const id = slot.id;
    slot.count -= 1;
    if (slot.count <= 0) {
      slot.id = null;
      slot.count = 0;
    }
    return id;
  }

  function selectedBlockId(state) {
    const slot = state.player.hotbar[state.player.selectedSlot];
    return slot && slot.count > 0 ? slot.id : null;
  }

  Game.inventory = {
    eatFood,
    addToInventory,
    consumeSelectedBlock,
    selectedBlockId,
  };
})();
