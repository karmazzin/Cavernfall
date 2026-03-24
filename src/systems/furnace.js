(() => {
  const Game = window.MC2D;
  const { TILE } = Game.constants;
  const { BLOCK } = Game.blocks;
  const { ITEM } = Game.items;
  const {
    createSlot,
    createItemStack,
    cloneSlot,
    copySlot,
    isSlotEmpty,
    normalizeSlot,
    getItemStackLimit,
  } = Game.inventory;
  const { getBlock } = Game.world;

  const FUEL_VALUES = {
    [ITEM.COAL]: 16,
    [ITEM.CHARCOAL]: 14,
    [BLOCK.WOOD]: 8,
    [BLOCK.PLANK]: 5,
    [BLOCK.LEAF]: 1.4,
  };

  const SMELT_RECIPES = {
    [BLOCK.WOOD]: { id: ITEM.CHARCOAL, count: 1, time: 5 },
    [BLOCK.PLANK]: { id: ITEM.CHARCOAL, count: 1, time: 4.2 },
    [ITEM.RAW_IRON]: { id: ITEM.IRON_INGOT, count: 1, time: 6 },
    [ITEM.RAW_GOLD]: { id: ITEM.GOLD_INGOT, count: 1, time: 6.2 },
  };

  function furnaceKey(tx, ty) {
    return `${tx},${ty}`;
  }

  function createFurnaceState() {
    return {
      input: createSlot(),
      fuel: createSlot(),
      output: createSlot(),
      progress: 0,
      burnTime: 0,
      burnTotal: 0,
    };
  }

  function ensureFurnaceMap(state) {
    if (!state.furnaces) state.furnaces = {};
    return state.furnaces;
  }

  function ensureFurnaceAt(state, tx, ty) {
    const furnaces = ensureFurnaceMap(state);
    const key = furnaceKey(tx, ty);
    if (!furnaces[key]) furnaces[key] = createFurnaceState();
    return furnaces[key];
  }

  function removeFurnaceAt(state, tx, ty) {
    const furnaces = ensureFurnaceMap(state);
    const key = furnaceKey(tx, ty);
    const furnace = furnaces[key] || null;
    delete furnaces[key];
    return furnace;
  }

  function getFurnaceAt(state, tx, ty) {
    return ensureFurnaceMap(state)[furnaceKey(tx, ty)] || null;
  }

  function getSmeltRecipe(itemId) {
    return SMELT_RECIPES[itemId] || null;
  }

  function getFuelTime(itemId) {
    return FUEL_VALUES[itemId] || 0;
  }

  function canAcceptOutput(slot, recipe) {
    if (isSlotEmpty(slot)) return true;
    return slot.id === recipe.id && slot.count + recipe.count <= getItemStackLimit(slot.id);
  }

  function canSmelt(furnace) {
    if (isSlotEmpty(furnace.input)) return false;
    const recipe = getSmeltRecipe(furnace.input.id);
    if (!recipe) return false;
    return canAcceptOutput(furnace.output, recipe);
  }

  function consumeFuel(furnace) {
    if (isSlotEmpty(furnace.fuel)) return false;
    const fuelTime = getFuelTime(furnace.fuel.id);
    if (fuelTime <= 0) return false;
    furnace.fuel.count -= 1;
    normalizeSlot(furnace.fuel);
    furnace.burnTime = fuelTime;
    furnace.burnTotal = fuelTime;
    return true;
  }

  function completeSmelt(furnace) {
    const recipe = getSmeltRecipe(furnace.input.id);
    if (!recipe) return;

    furnace.input.count -= 1;
    normalizeSlot(furnace.input);

    if (isSlotEmpty(furnace.output)) copySlot(furnace.output, createItemStack(recipe.id, recipe.count));
    else furnace.output.count += recipe.count;
    normalizeSlot(furnace.output);
    furnace.progress = 0;
  }

  function updateFurnaces(state, dt) {
    const furnaces = ensureFurnaceMap(state);
    for (const [key, furnace] of Object.entries(furnaces)) {
      const [tx, ty] = key.split(',').map(Number);
      if (getBlock(state, tx, ty) !== BLOCK.FURNACE) {
        delete furnaces[key];
        continue;
      }

      if (furnace.burnTime > 0) furnace.burnTime = Math.max(0, furnace.burnTime - dt);

      if (canSmelt(furnace)) {
        if (furnace.burnTime <= 0 && !consumeFuel(furnace)) {
          furnace.progress = 0;
          continue;
        }

        const recipe = getSmeltRecipe(furnace.input.id);
        furnace.progress += dt;
        if (furnace.progress >= recipe.time) completeSmelt(furnace);
      } else {
        furnace.progress = 0;
      }
    }
  }

  function getNearestFurnace(state, maxDistanceTiles = 5) {
    const furnaces = ensureFurnaceMap(state);
    const px = state.player.x + state.player.w / 2;
    const py = state.player.y + state.player.h / 2;
    let best = null;
    let bestDist = maxDistanceTiles * TILE;

    for (const key of Object.keys(furnaces)) {
      const [tx, ty] = key.split(',').map(Number);
      if (getBlock(state, tx, ty) !== BLOCK.FURNACE) continue;
      const fx = tx * TILE + TILE / 2;
      const fy = ty * TILE + TILE / 2;
      const dist = Math.hypot(fx - px, fy - py);
      if (dist <= bestDist) {
        bestDist = dist;
        best = { key, tx, ty, furnace: furnaces[key] };
      }
    }

    return best;
  }

  function getLightSourcesInView(state, camera, canvas) {
    const lights = [];
    const startX = Math.max(0, Math.floor(camera.x / TILE) - 1);
    const endX = Math.min(state.world[0].length - 1, Math.ceil((camera.x + canvas.width) / TILE) + 1);
    const startY = Math.max(0, Math.floor(camera.y / TILE) - 1);
    const endY = Math.min(state.world.length - 1, Math.ceil((camera.y + canvas.height) / TILE) + 1);

    for (let ty = startY; ty <= endY; ty += 1) {
      for (let tx = startX; tx <= endX; tx += 1) {
        const block = getBlock(state, tx, ty);
        if (block === BLOCK.TORCH) {
          lights.push({
            x: tx * TILE + TILE / 2 - camera.x,
            y: ty * TILE + TILE / 2 - camera.y,
            radius: 150,
            inner: 26,
            strength: 0.96,
          });
        } else if (block === BLOCK.LAVA) {
          lights.push({
            x: tx * TILE + TILE / 2 - camera.x,
            y: ty * TILE + TILE / 2 - camera.y,
            radius: 125,
            inner: 22,
            strength: 0.84,
          });
        } else if (block === BLOCK.FURNACE) {
          const furnace = getFurnaceAt(state, tx, ty);
          if (furnace && furnace.burnTime > 0) {
            lights.push({
              x: tx * TILE + TILE / 2 - camera.x,
              y: ty * TILE + TILE / 2 - camera.y,
              radius: 88,
              inner: 16,
              strength: 0.64,
            });
          }
        }
      }
    }

    return lights;
  }

  Game.furnaceSystem = {
    createFurnaceState,
    ensureFurnaceAt,
    removeFurnaceAt,
    getFurnaceAt,
    getNearestFurnace,
    getFuelTime,
    getSmeltRecipe,
    updateFurnaces,
    getLightSourcesInView,
  };
})();
