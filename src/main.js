(() => {
  const Game = window.MC2D;
  const { BLOCK } = Game.blocks;
  const { createGameState } = Game.state;
  const { ensureDimensions } = Game.state;
  const { createAppState } = Game.appState;
  const { generateWorld, retrofitWorldFeatures } = Game.generation;
  const { withSeed, makeSeed } = Game.random;
  const { spawnAnimals, updateAnimals } = Game.animalsEntity;
  const { updatePlayer } = Game.playerEntity;
  const { updateZombies } = Game.zombiesEntity;
  const { updateSpiders } = Game.spidersEntity;
  const { updateFireGuards } = Game.fireGuardsEntity;
  const { updateFireKing } = Game.fireKingEntity;
  const { updateFriendlyFireKing } = Game.friendlyFireKingEntity;
  const { updateHumans } = Game.humansEntity;
  const { updateDwarves } = Game.dwarvesEntity;
  const { updateFood } = Game.foodEntity;
  const { updateFirePyramid } = Game.firePyramidSystem;
  const { updatePortals, useNearbyPortal } = Game.portalSystem;
  const { updateFurnaces } = Game.furnaceSystem;
  const { updateSatiety, updateBreath } = Game.survival;
  const { getMaxHealth, clampPlayerHealthToMax } = Game.combat;
  const { updateFluids } = Game.fluids;
  const { addToInventory, eatFood, countItem } = Game.inventory;
  const { handleMouse, useNearbyDoor, useNearbyPillow, useNearbyDungeonSeal } = Game.interaction;
  const { createCamera, updateCamera } = Game.camera;
  const { setupInput } = Game.input;
  const { ensureCraftingState, handleCraftingPointer, toggleCrafting, closeCrafting } = Game.crafting;
  const { saveWorld, loadWorld, listWorlds, deleteWorld, createWorldMeta, migrateLegacySave } = Game.saveSystem;
  const { draw } = Game.renderer;
  const { updateAchievements } = Game.achievementsSystem;
  const { drawMenuBackground } = Game.menuRenderer;
  const { createMenuUi } = Game.menuUi;
  const { getPauseLayout } = Game.pauseRenderer;

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const menuRoot = document.getElementById('menuRoot');
  const state = createGameState();
  const app = createAppState();

  function isCreativeMode() {
    return !!(state.worldMeta && state.worldMeta.mode === 'creative');
  }

  function isInfiniteInventoryMode() {
    return !!(state.worldMeta && state.worldMeta.mode === 'infinite_inventory');
  }

  function isSpectatorMode() {
    return !!(state.worldMeta && state.worldMeta.mode === 'spectator');
  }

  function toggleCreativeFlight() {
    if (app.screen !== 'playing' || !isCreativeMode()) return;
    if (state.ui && state.ui.controlMode === 'touch') return;
    state.player.creativeFlight = !state.player.creativeFlight;
  }

  function inventoryHasFriendshipAmulet() {
    return countItem(state, BLOCK.FRIENDSHIP_AMULET) > 0;
  }

  function bundleHasFriendshipAmulet(bundle) {
    if (!bundle || typeof bundle !== 'object') return false;
    if (Array.isArray(bundle.foods) && bundle.foods.some((food) => food && food.itemId === BLOCK.FRIENDSHIP_AMULET)) return true;
    if (bundle.chests && typeof bundle.chests === 'object') {
      for (const chest of Object.values(bundle.chests)) {
        if (!chest || !Array.isArray(chest.slots)) continue;
        if (chest.slots.some((slot) => slot && slot.id === BLOCK.FRIENDSHIP_AMULET && (slot.count || 0) > 0)) return true;
      }
    }
    if (Array.isArray(bundle.world)) {
      for (const row of bundle.world) {
        if (Array.isArray(row) && row.includes(BLOCK.FRIENDSHIP_AMULET)) return true;
      }
    }
    return false;
  }

  function friendshipAmuletWasGranted() {
    if (state.fireDungeon && state.fireDungeon.giftGiven) return true;
    const fireBundle = state.dimensions && state.dimensions.fire;
    return !!(fireBundle && fireBundle.fireDungeon && fireBundle.fireDungeon.giftGiven);
  }

  function amuletExistsSomewhere() {
    if (inventoryHasFriendshipAmulet()) return true;
    if (bundleHasFriendshipAmulet(state)) return true;
    if (!state.dimensions) return false;
    const otherDimension = state.activeDimension === 'fire' ? state.dimensions.overworld : state.dimensions.fire;
    return bundleHasFriendshipAmulet(otherDimension);
  }

  function ensureFriendshipAmulet() {
    if (!friendshipAmuletWasGranted()) return;
    if (amuletExistsSomewhere()) return;
    if (addToInventory(state, BLOCK.FRIENDSHIP_AMULET, 1)) {
      state.ui.noticeText = 'Амулет дружбы возвращён в инвентарь.';
      state.ui.noticeTimer = 5;
    }
  }

  function syncBodyUiState() {
    const playing = app.screen === 'playing';
    const overlayHidden = !!(playing && (state.pause.open || (state.crafting && state.crafting.open)));
    document.body.classList.toggle('ui-overlay-hidden', overlayHidden);
    document.body.classList.toggle('menu-open', !playing);
  }

  function refreshWorldList() {
    app.worlds = listWorlds();
    menu.render(app);
  }

  function replaceState(nextState) {
    for (const key of Object.keys(state)) delete state[key];
    Object.assign(state, nextState);
    ensureCraftingState(state);
    if (state.worldMeta && state.worldMeta.mode === 'spectator') {
      state.crafting.open = false;
      state.crafting.chestOpenKey = null;
      state.crafting.tradeSettlementId = null;
      state.crafting.tradeHumanId = null;
      state.crafting.tradeStatus = '';
      state.player.creativeFlight = false;
    }
    input.syncUiState();
    syncBodyUiState();
  }

  function capturePreview() {
    try {
      return canvas.toDataURL('image/jpeg', 0.72);
    } catch (error) {
      return null;
    }
  }

  function saveCurrentWorld() {
    if (app.screen !== 'playing' || !state.worldMeta || !state.worldMeta.id) return false;
    const preview = capturePreview();
    const result = saveWorld(state, preview);
    if (result) refreshWorldList();
    return result;
  }

  function seedStarterInventory() {
    addToInventory(state, BLOCK.DIRT, 20);
    addToInventory(state, BLOCK.STONE, 10);
    addToInventory(state, BLOCK.WOOD, 10);
    addToInventory(state, BLOCK.PLANK, 12);
  }

  function buildNewWorldState(meta) {
    const nextState = createGameState(meta);
    replaceState(nextState);
    withSeed(meta.seed, () => generateWorld(state));
    ensureDimensions(state);
    spawnAnimals(state);
    if (meta.mode !== 'creative' && meta.mode !== 'spectator' && meta.mode !== 'infinite_inventory') seedStarterInventory();
  }

  function startNewWorld(options) {
    const seed = options.seed && options.seed.trim() ? options.seed.trim() : makeSeed();
    const meta = createWorldMeta({
      name: options.name && options.name.trim() ? options.name.trim() : 'Новый мир',
      mode: options.mode || 'survival',
      seed,
      preview: null,
    });
    buildNewWorldState(meta);
    app.currentWorldId = meta.id;
    app.screen = 'playing';
    app.pendingInitialSave = true;
    menu.render(app);
    syncBodyUiState();
  }

  function loadExistingWorld(worldId) {
    const loadedState = loadWorld(worldId);
    if (!loadedState) return false;
    replaceState(loadedState);
    retrofitWorldFeatures(state);
    ensureDimensions(state);
    app.currentWorldId = worldId;
    app.screen = 'playing';
    app.pendingInitialSave = false;
    menu.render(app);
    syncBodyUiState();
    return true;
  }

  function resetCurrentWorld() {
    if (!state.worldMeta) return;
    buildNewWorldState({ ...state.worldMeta, updatedAt: Date.now() });
    app.currentWorldId = state.worldMeta.id;
    app.screen = 'playing';
    app.pendingInitialSave = true;
    menu.render(app);
    syncBodyUiState();
  }

  function exitToMainMenu() {
    saveCurrentWorld();
    closePause();
    app.screen = 'menu';
    menu.render(app);
    syncBodyUiState();
  }

  function contains(rect, x, y) {
    return x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h;
  }

  function closePause() {
    state.pause.open = false;
    state.pause.confirmRestart = false;
    state.pause.showControls = false;
    state.pause.showModePicker = false;
    state.pause.statusText = '';
    syncBodyUiState();
  }

  function openPause() {
    if (state.crafting.open) {
      closeCrafting(state);
      if (state.crafting.open) return;
    }
    state.pause.open = true;
    state.pause.confirmRestart = false;
    state.pause.showControls = false;
    state.pause.showModePicker = false;
    state.pause.statusText = '';
    syncBodyUiState();
  }

  function applyWorldMode(mode) {
    if (!state.worldMeta) return;
    const currentMode = state.worldMeta.mode || 'survival';
    const modeLabels = {
      survival: 'Выживание',
      creative: 'Творческий',
      infinite_inventory: 'Бесконечный инвентарь',
      spectator: 'Спектатор',
    };
    if (currentMode === mode) {
      state.pause.statusText = `Режим уже: ${modeLabels[mode] || 'Выживание'}`;
      state.pause.showModePicker = false;
      return;
    }

    state.worldMeta.mode = mode;
    state.worldMeta.updatedAt = Date.now();

    if (mode !== 'creative') state.player.creativeFlight = false;

    if (mode === 'spectator') {
      closeCrafting(state);
      state.player.creativeFlight = false;
      state.breaking = null;
    }

    if (mode !== 'spectator') {
      state.gameOver = false;
      if (state.player.health <= 0) state.player.health = getMaxHealth(state);
    }

    state.pause.showModePicker = false;
    state.pause.statusText = `Режим: ${modeLabels[mode] || 'Выживание'}`;
  }

  function togglePause() {
    if (app.screen !== 'playing' || state.gameOver) return;
    if (state.pause.open) closePause();
    else openPause();
  }

  function handlePausePointer(inputRef, canvasRef) {
    if (!state.pause.open || !inputRef.mouse.justPressed) return false;
    const layout = getPauseLayout(canvasRef, state);
    const { x, y } = inputRef.mouse;
    for (const button of layout.buttons) {
      if (!contains(button, x, y)) continue;

      if (button.id === 'continue') closePause();
      if (button.id === 'controls') state.pause.showControls = true;
      if (button.id === 'controls_back') state.pause.showControls = false;
      if (button.id === 'choose_mode') state.pause.showModePicker = true;
      if (button.id === 'mode_back') state.pause.showModePicker = false;
      if (button.id === 'mode_survival') applyWorldMode('survival');
      if (button.id === 'mode_creative') applyWorldMode('creative');
      if (button.id === 'mode_infinite_inventory') applyWorldMode('infinite_inventory');
      if (button.id === 'mode_spectator') applyWorldMode('spectator');
      if (button.id === 'save') state.pause.statusText = saveCurrentWorld() ? 'Игра сохранена' : 'Сохранение не удалось';
      if (button.id === 'fullscreen') input.toggleFullscreen();
      if (button.id === 'restart') state.pause.confirmRestart = true;
      if (button.id === 'restart_no') state.pause.confirmRestart = false;
      if (button.id === 'restart_yes') resetCurrentWorld();
      if (button.id === 'exit_to_menu') exitToMainMenu();

      inputRef.mouse.justPressed = false;
      syncBodyUiState();
      return true;
    }

    inputRef.mouse.justPressed = false;
    return true;
  }

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }

  window.addEventListener('resize', resize);
  resize();
  ensureCraftingState(state);

  const menu = createMenuUi(menuRoot, {
    onInput(field, value) {
      app.newWorld[field] = value;
    },
    onModeChange(mode) {
      app.newWorld.mode = mode;
      menu.render(app);
    },
    onAction(action, worldId) {
      if (action === 'open-new') app.screen = 'new-world';
      if (action === 'open-load') {
        refreshWorldList();
        app.screen = 'load-worlds';
      }
      if (action === 'back-main') app.screen = 'menu';
      if (action === 'create-world') startNewWorld(app.newWorld);
      if (action === 'load-world' && worldId) loadExistingWorld(worldId);
      if (action === 'delete-world' && worldId) {
        deleteWorld(worldId);
        refreshWorldList();
        app.screen = 'load-worlds';
      }
      menu.render(app);
      syncBodyUiState();
    },
  });

  const input = setupInput(canvas, state, {
    eatFood: () => {
      if (app.screen === 'playing' && !isSpectatorMode()) eatFood(state);
    },
    use: () => {
      if (app.screen !== 'playing' || isSpectatorMode()) return;
      if (!useNearbyPortal(state, input, camera) && !useNearbyDungeonSeal(state, input, camera) && !useNearbyPillow(state, input, camera) && !useNearbyDoor(state, input, camera)) eatFood(state);
    },
    restart: () => {
      if (app.screen === 'playing') resetCurrentWorld();
    },
    unlockAudio: () => Game.audio.unlock(),
    toggleCreativeFlight,
    toggleCrafting: () => {
      if (app.screen !== 'playing' || isSpectatorMode()) return;
      toggleCrafting(state);
      syncBodyUiState();
    },
    togglePause,
  });

  migrateLegacySave();
  refreshWorldList();
  menu.render(app);
  syncBodyUiState();

  function update(dt) {
    syncBodyUiState();

    state.ui.fpsFrames += 1;
    state.ui.fpsAccum += dt;
    if (state.ui.fpsAccum >= 0.25) {
      state.ui.fps = state.ui.fpsFrames / state.ui.fpsAccum;
      state.ui.fpsFrames = 0;
      state.ui.fpsAccum = 0;
    }
    if (state.ui.noticeTimer > 0) {
      state.ui.noticeTimer = Math.max(0, state.ui.noticeTimer - dt);
      if (state.ui.noticeTimer <= 0) state.ui.noticeText = '';
    }
    state.friendshipAmuletTick += dt;
    if (state.friendshipAmuletTick >= 2) {
      state.friendshipAmuletTick = 0;
      ensureFriendshipAmulet();
    }

    if (app.screen !== 'playing') return;
    if (state.pause.open || state.gameOver) return;

    clampPlayerHealthToMax(state);

    if (!state.crafting.open) state.cycleTime += dt;
    if (state.attackFlash > 0) state.attackFlash -= dt;
    state.autosaveTick += dt;
    if (state.autosaveTick >= 60) {
      saveCurrentWorld();
      state.autosaveTick = 0;
    }

    updatePlayer(state, input, dt);
    updateAnimals(state, dt);
    updateZombies(state, dt);
    updateSpiders(state, dt);
    updateFireGuards(state, dt);
    updateFireKing(state, dt);
    updateFriendlyFireKing(state, dt);
    updateHumans(state, dt);
    updateDwarves(state, dt);
    updateFood(state, dt);
    updateFirePyramid(state, dt);
    updatePortals(state, dt);
    updateFurnaces(state, dt);
    updateSatiety(state, input, dt);
    updateBreath(state, dt);
    updateAchievements(state, dt);

    state.fluidTick += dt;
    if (state.fluidTick >= 0.18) {
      state.fluidTick = 0;
      updateFluids(state);
    }

    for (const animal of state.animals) {
      if (animal.clickCd) animal.clickCd = Math.max(0, animal.clickCd - dt);
    }
    for (const zombie of state.zombies) {
      if (zombie.clickCd) zombie.clickCd = Math.max(0, zombie.clickCd - dt);
    }
    for (const spider of state.spiders) {
      if (spider.clickCd) spider.clickCd = Math.max(0, spider.clickCd - dt);
    }
    for (const dwarf of state.dwarves) {
      if (dwarf.clickCd) dwarf.clickCd = Math.max(0, dwarf.clickCd - dt);
    }
    for (const guard of state.fireGuards || []) {
      if (guard.clickCd) guard.clickCd = Math.max(0, guard.clickCd - dt);
    }
    for (const human of state.humans) {
      if (human.clickCd) human.clickCd = Math.max(0, human.clickCd - dt);
    }

    if (!isCreativeMode() && !isSpectatorMode() && !isInfiniteInventoryMode() && state.player.health <= 0) state.gameOver = true;
  }

  const camera = createCamera(state, canvas);
  let last = performance.now();

  function loop(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;

    if (app.screen !== 'playing') {
      update(dt);
      drawMenuBackground(ctx, canvas, state);
      requestAnimationFrame(loop);
      return;
    }

    updateCamera(camera, state, canvas);

    if (state.pause.open) {
      if (handlePausePointer(input, canvas)) {
        updateCamera(camera, state, canvas);
        draw(ctx, canvas, state, camera, input);
        requestAnimationFrame(loop);
        return;
      }
    } else if (state.crafting.open) {
      handleCraftingPointer(state, input, canvas);
      syncBodyUiState();
    } else {
      handleMouse(state, input, camera, dt);
    }

    update(dt);
    updateCamera(camera, state, canvas);
    draw(ctx, canvas, state, camera, input);

    if (app.pendingInitialSave) {
      saveCurrentWorld();
      app.pendingInitialSave = false;
    }

    requestAnimationFrame(loop);
  }

  requestAnimationFrame(loop);
})();
