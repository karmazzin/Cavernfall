(() => {
  const Game = window.MC2D;
  const { BLOCK } = Game.blocks;
  const { createGameState } = Game.state;
  const { ensureDimensions, switchDimension } = Game.state;
  const { createAppState } = Game.appState;
  const { generateWorld, retrofitWorldFeatures } = Game.generation;
  const { withSeed, makeSeed } = Game.random;
  const { spawnAnimals, updateAnimals } = Game.animalsEntity;
  const { updatePlayer } = Game.playerEntity;
  const { updateZombies } = Game.zombiesEntity;
  const { updateSpiders } = Game.spidersEntity;
  const { updateFireGuards } = Game.fireGuardsEntity;
  const { updateWaterfolk } = Game.waterfolkEntity;
  const { updateWindfolk } = Game.windfolkEntity || {};
  const { updateFireKing } = Game.fireKingEntity;
  const { updateFriendlyFireKing } = Game.friendlyFireKingEntity;
  const { updateKraken } = Game.krakenEntity || {};
  const { updateGoldenFlowerGuardian } = Game.goldenFlowerGuardianEntity || {};
  const { updateAirGuardian } = Game.airGuardianEntity || {};
  const { updateHumans } = Game.humansEntity;
  const { updateDwarves } = Game.dwarvesEntity;
  const { updateFood } = Game.foodEntity;
  const { updateFirePyramid } = Game.firePyramidSystem;
  const { updateWaterWell } = Game.waterWellSystem;
  const { updateSteamQuest, useSteamCloud } = Game.steamQuestSystem;
  const { updatePortals, useNearbyPortal } = Game.portalSystem;
  const { useNearbyWaterDome } = Game.waterDimensionSystem;
  const { updateFurnaces } = Game.furnaceSystem;
  const { updateSatiety, updateBreath } = Game.survival;
  const { updateWeather } = Game.weatherSystem;
  const { getMaxHealth, clampPlayerHealthToMax } = Game.combat;
  const { updateFluids } = Game.fluids;
  const { addToInventory, eatFood, countItem } = Game.inventory;
  const { ITEM } = Game.items;
  const { handleMouse, useNearbyDoor, useNearbyPillow, useNearbyDungeonSeal, useNearbyWaterCrystal, useNearbyAirCrystal, useNearbyAirEntrance } = Game.interaction;
  const { getLocationInfo } = Game.world;
  const { createCamera, updateCamera } = Game.camera;
  const { setupInput } = Game.input;
  const { ensureCraftingState, handleCraftingPointer, toggleCrafting, closeCrafting } = Game.crafting;
  const { saveWorld, loadWorld, listWorlds, deleteWorld, createWorldMeta, migrateLegacySave } = Game.saveSystem;
  const { draw, getHardcoreDeathLayout } = Game.renderer;
  const { updateAchievements } = Game.achievementsSystem;
  const { drawMenuBackground } = Game.menuRenderer;
  const { createMenuUi } = Game.menuUi;
  const { getPauseLayout } = Game.pauseRenderer;

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const menuRoot = document.getElementById('menuRoot');
  const assistantRoot = document.getElementById('assistantRoot');
  const state = createGameState();
  const app = createAppState();
  const assistantUi = Game.gameAssistant.createAssistantUi(assistantRoot, {
    onClose: () => {
      if (app.screen === 'playing') state.pause.showAssistant = false;
      else app.showAssistant = false;
      syncBodyUiState();
    },
  });

  function isCreativeMode() {
    return !!(state.worldMeta && state.worldMeta.mode === 'creative');
  }

  function isInfiniteInventoryMode() {
    return !!(state.worldMeta && state.worldMeta.mode === 'infinite_inventory');
  }

  function isSpectatorMode() {
    return !!(state.worldMeta && (state.worldMeta.mode === 'spectator' || state.worldMeta.mode === 'hardcore_spectator'));
  }

  function isHardcoreMode() {
    return !!(state.worldMeta && state.worldMeta.mode === 'hardcore');
  }

  function isHardcoreSpectatorMode() {
    return !!(state.worldMeta && state.worldMeta.mode === 'hardcore_spectator');
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

  function tryFireRoofWarp() {
    if (state.activeDimension !== 'fire') return;
    if ((state.player.portalCooldown || 0) > 0) return;
    if (state.player.y > 2) return;
    ensureDimensions(state);
    const overworld = state.dimensions && state.dimensions.overworld;
    const well = overworld && overworld.waterWell;
    if (!well) return;
    switchDimension(state, 'overworld');
    state.player.x = well.centerX * Game.constants.TILE + 2;
    state.player.y = Math.max(0, (well.waterY0 - 1) * Game.constants.TILE);
    state.player.vx = 0;
    state.player.vy = 0;
    state.player.onGround = false;
    state.player.portalCooldown = 1.2;
    state.ui.noticeText = 'Ты вышел к воде у Водного колодца.';
    state.ui.noticeTimer = 3.5;
  }

  function syncBodyUiState() {
    const playing = app.screen === 'playing';
    const overlayHidden = !!(playing && (state.pause.open || (state.crafting && state.crafting.open)));
    document.body.classList.toggle('ui-overlay-hidden', overlayHidden);
    document.body.classList.toggle('menu-open', !playing);
    assistantUi.setVisible(!!((playing && state.pause.open && state.pause.showAssistant) || (!playing && app.showAssistant)));
  }

  function refreshWorldList() {
    app.worlds = listWorlds();
    menu.render(app);
  }

  function replaceState(nextState) {
    for (const key of Object.keys(state)) delete state[key];
    Object.assign(state, nextState);
    ensureCraftingState(state);
    if (state.worldMeta && (state.worldMeta.mode === 'spectator' || state.worldMeta.mode === 'hardcore_spectator')) {
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
    state.player.spawnPoint = {
      dimension: 'overworld',
      x: state.player.x,
      y: state.player.y,
    };
    state.player.sleepRespawnHistory = [];
    if (meta.mode !== 'creative' && meta.mode !== 'spectator' && meta.mode !== 'hardcore_spectator' && meta.mode !== 'infinite_inventory') seedStarterInventory();
  }

  function startNewWorld(options) {
    const seed = options.seed && options.seed.trim() ? options.seed.trim() : makeSeed();
    const meta = createWorldMeta({
      name: options.name && options.name.trim() ? options.name.trim() : 'Новый мир',
      mode: options.mode || 'survival',
      worldType: options.worldType || 'normal',
      singleBiome: options.singleBiome || 'forest',
      cavernBiome: options.cavernBiome || 'mix',
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
    state.pause.showCompass = false;
    state.pause.showAssistant = false;
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
    state.pause.showCompass = false;
    state.pause.showAssistant = false;
    state.pause.statusText = '';
    syncBodyUiState();
  }

  function applyWorldMode(mode) {
    if (!state.worldMeta) return;
    const currentMode = state.worldMeta.mode || 'survival';
    if (currentMode === 'hardcore_spectator') {
      state.pause.statusText = 'Хардкорный спектатор не может сменить режим.';
      state.pause.showModePicker = false;
      return;
    }
    const modeLabels = {
      survival: 'Выживание',
      hardcore: 'Хардкор',
      creative: 'Творческий',
      infinite_inventory: 'Бесконечный инвентарь',
      spectator: 'Спектатор',
      hardcore_spectator: 'Хардкорный спектатор',
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

    if (mode !== 'spectator' && mode !== 'hardcore_spectator') {
      state.gameOver = false;
      state.hardcoreDeath = null;
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
      if (button.id === 'compass') {
        state.pause.showCompass = true;
        state.pause.compassPage = 0;
      }
      if (button.id === 'compass_back') state.pause.showCompass = false;
      if (button.id === 'compass_prev_page') state.pause.compassPage = Math.max(0, (state.pause.compassPage || 0) - 1);
      if (button.id === 'compass_next_page') state.pause.compassPage = (state.pause.compassPage || 0) + 1;
      if (button.id === 'assistant') state.pause.showAssistant = true;
      if (button.id === 'compass_track_fire_caves') {
        state.pause.activeCompassTarget = state.pause.activeCompassTarget === 'fire_caves' ? null : 'fire_caves';
      }
      if (button.id === 'compass_track_water_caves') {
        state.pause.activeCompassTarget = state.pause.activeCompassTarget === 'water_caves' ? null : 'water_caves';
      }
      if (button.id === 'compass_track_air_caves') {
        state.pause.activeCompassTarget = state.pause.activeCompassTarget === 'air_caves' ? null : 'air_caves';
      }
      if (button.id === 'compass_track_fire_pyramid') {
        state.pause.activeCompassTarget = state.pause.activeCompassTarget === 'fire_pyramid' ? null : 'fire_pyramid';
      }
      if (button.id === 'compass_track_fire_castle') {
        state.pause.activeCompassTarget = state.pause.activeCompassTarget === 'fire_castle' ? null : 'fire_castle';
      }
      if (button.id === 'compass_track_fire_dungeon') {
        state.pause.activeCompassTarget = state.pause.activeCompassTarget === 'fire_dungeon' ? null : 'fire_dungeon';
      }
      if (button.id === 'compass_track_water_well') {
        state.pause.activeCompassTarget = state.pause.activeCompassTarget === 'water_well' ? null : 'water_well';
      }
      if (button.id === 'compass_track_golden_garden') {
        state.pause.activeCompassTarget = state.pause.activeCompassTarget === 'golden_garden' ? null : 'golden_garden';
      }
      if (button.id === 'compass_track_main_well') {
        state.pause.activeCompassTarget = state.pause.activeCompassTarget === 'main_well' ? null : 'main_well';
      }
      if (button.id === 'compass_track_air_entrance') {
        state.pause.activeCompassTarget = state.pause.activeCompassTarget === 'air_entrance' ? null : 'air_entrance';
      }
      if (button.id === 'compass_track_air_castle') {
        state.pause.activeCompassTarget = state.pause.activeCompassTarget === 'air_castle' ? null : 'air_castle';
      }
      if (button.id === 'mode_survival') applyWorldMode('survival');
      if (button.id === 'mode_hardcore') applyWorldMode('hardcore');
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
    onWorldTypeChange(worldType) {
      app.newWorld.worldType = worldType;
      if (worldType !== 'single_biome') app.newWorld.singleBiome = app.newWorld.singleBiome || 'forest';
      menu.render(app);
    },
    onSingleBiomeChange(singleBiome) {
      app.newWorld.singleBiome = singleBiome;
      menu.render(app);
    },
    onCavernBiomeChange(cavernBiome) {
      app.newWorld.cavernBiome = cavernBiome;
      menu.render(app);
    },
    onAction(action, worldId) {
      if (action === 'open-new') app.screen = 'new-world';
      if (action === 'open-load') {
        refreshWorldList();
        app.screen = 'load-worlds';
      }
      if (action === 'open-assistant') {
        app.showAssistant = true;
        assistantUi.reset();
      }
      if (action === 'back-main') app.screen = 'menu';
      if (action === 'create-world') startNewWorld(app.newWorld);
      if (action === 'load-world' && worldId) loadExistingWorld(worldId);
      if (action === 'delete-world' && worldId) {
        deleteWorld(worldId);
        refreshWorldList();
        app.screen = 'load-worlds';
      }
      if (action !== 'open-assistant') app.showAssistant = false;
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
      if (state.player && state.player.steamForm) {
        useSteamCloud(state);
        return;
      }
      if (!useNearbyPortal(state, input, camera) && !useNearbyWaterDome(state) && !useNearbyWaterCrystal(state, input, camera) && !useNearbyAirCrystal(state, input, camera) && !useNearbyAirEntrance(state) && !useNearbyDungeonSeal(state, input, camera) && !useNearbyPillow(state, input, camera) && !useNearbyDoor(state, input, camera) && !useSteamCloud(state)) eatFood(state);
    },
    restart: () => {
      if (app.screen === 'playing' && !state.hardcoreDeath) resetCurrentWorld();
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
  if (Game.saveSystem.purgeMods) Game.saveSystem.purgeMods();
  refreshWorldList();
  menu.render(app);
  syncBodyUiState();

  function getBundleForDimension(dimension) {
    if (!dimension) return null;
    if (state.activeDimension === dimension) return state;
    if (!state.dimensions || typeof state.dimensions !== 'object') return null;
    return state.dimensions[dimension] || null;
  }

  function bundleBlockAt(bundle, tx, ty) {
    if (!bundle || !Array.isArray(bundle.world)) return BLOCK.BEDROCK;
    if (ty < 0 || ty >= bundle.world.length) return BLOCK.BEDROCK;
    const row = bundle.world[ty];
    if (!Array.isArray(row) || tx < 0 || tx >= row.length) return BLOCK.BEDROCK;
    return row[tx];
  }

  function findRespawnPoint() {
    const history = Array.isArray(state.player.sleepRespawnHistory) ? state.player.sleepRespawnHistory : [];
    for (let i = history.length - 1; i >= 0; i -= 1) {
      const point = history[i];
      if (!point || !Number.isFinite(point.tx) || !Number.isFinite(point.ty) || !point.dimension) continue;
      const bundle = getBundleForDimension(point.dimension);
      if (!bundle) continue;
      if (bundleBlockAt(bundle, point.tx, point.ty) !== BLOCK.PILLOW) continue;
      return {
        dimension: point.dimension,
        x: point.tx * Game.constants.TILE + 2,
        y: point.ty * Game.constants.TILE - state.player.h + 12,
      };
    }
    const spawnPoint = state.player.spawnPoint;
    if (spawnPoint && Number.isFinite(spawnPoint.x) && Number.isFinite(spawnPoint.y) && spawnPoint.dimension) {
      return {
        dimension: spawnPoint.dimension,
        x: spawnPoint.x,
        y: spawnPoint.y,
      };
    }
    return {
      dimension: state.activeDimension || 'overworld',
      x: state.player.x,
      y: state.player.y,
    };
  }

  function respawnPlayer() {
    ensureDimensions(state);
    const point = findRespawnPoint();
    if (point.dimension && point.dimension !== state.activeDimension) switchDimension(state, point.dimension);
    state.player.health = getMaxHealth(state);
    state.player.breath = Game.constants.BREATH_TOTAL;
    state.player.x = point.x;
    state.player.y = point.y;
    state.player.vx = 0;
    state.player.vy = 0;
    state.player.onGround = false;
    state.player.sleeping = false;
    state.player.sleepTimer = 0;
    state.player.sleepBlockX = null;
    state.player.sleepBlockY = null;
    state.player.respawnInvuln = 1.5;
    state.player.creativeFlight = false;
    state.gameOver = false;
    state.hardcoreDeath = null;
    state.ui.noticeText = 'Ты возродился.';
    state.ui.noticeTimer = 3;
  }

  function onPlayerDeath() {
    if (state.gameOver) return;
    if (isCreativeMode() || isSpectatorMode() || isInfiniteInventoryMode()) return;
    if (isHardcoreMode()) {
      state.gameOver = true;
      state.hardcoreDeath = { at: Date.now() };
      return;
    }
    respawnPlayer();
  }

  function handleHardcoreDeathPointer(inputRef, canvasRef) {
    if (!state.gameOver || !state.hardcoreDeath || !inputRef.mouse.justPressed) return false;
    const layout = getHardcoreDeathLayout(canvasRef);
    const { x, y } = inputRef.mouse;
    for (const button of layout.buttons) {
      if (!contains(button, x, y)) continue;
      if (button.id === 'hardcore_delete') {
        if (state.worldMeta && state.worldMeta.id) deleteWorld(state.worldMeta.id);
        refreshWorldList();
        app.currentWorldId = null;
        app.screen = 'menu';
        state.gameOver = false;
        state.hardcoreDeath = null;
        menu.render(app);
        syncBodyUiState();
      }
      if (button.id === 'hardcore_spectator') {
        state.worldMeta.mode = 'hardcore_spectator';
        state.worldMeta.updatedAt = Date.now();
        state.gameOver = false;
        state.hardcoreDeath = null;
        state.player.health = getMaxHealth(state);
        state.player.breath = Game.constants.BREATH_TOTAL;
        state.player.vx = 0;
        state.player.vy = 0;
        state.player.creativeFlight = false;
        state.player.respawnInvuln = 1.5;
        closeCrafting(state);
        state.ui.noticeText = 'Мир продолжится только в хардкорном спектаторе.';
        state.ui.noticeTimer = 4;
      }
      inputRef.mouse.justPressed = false;
      return true;
    }
    inputRef.mouse.justPressed = false;
    return true;
  }

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
    if (updateWaterfolk) updateWaterfolk(state, dt);
    if (updateWindfolk) updateWindfolk(state, dt);
    updateFireKing(state, dt);
    updateFriendlyFireKing(state, dt);
    if (updateKraken) updateKraken(state, dt);
    if (updateGoldenFlowerGuardian) updateGoldenFlowerGuardian(state, dt);
    if (updateAirGuardian) updateAirGuardian(state, dt);
    updateHumans(state, dt);
    updateDwarves(state, dt);
    updateFood(state, dt);
    updateFirePyramid(state, dt);
    if (updateWaterWell) updateWaterWell(state, dt);
    if (updateSteamQuest) updateSteamQuest(state, dt);
    updatePortals(state, dt);
    tryFireRoofWarp();
    updateFurnaces(state, dt);
    updateSatiety(state, input, dt);
    updateBreath(state, dt);
    updateWeather(state, dt);
    updateAchievements(state, dt);
    if (state.quake) {
      state.quake.timer = Math.max(0, (state.quake.timer || 0) - dt);
      if (state.quake.timer <= 0) state.quake = null;
    }

    if (state.pause.activeCompassTarget) {
      const tx = Math.floor((state.player.x + state.player.w / 2) / Game.constants.TILE);
      const ty = Math.floor((state.player.y + state.player.h / 2) / Game.constants.TILE);
      const currentBiome = getLocationInfo(state, tx, ty).biome;
      const px = state.player.x + state.player.w / 2;
      const py = state.player.y + state.player.h / 2;
      let reached = false;
      if (state.pause.activeCompassTarget === 'fire_caves') reached = currentBiome === 'fire_caves';
      else if (state.pause.activeCompassTarget === 'water_caves') reached = currentBiome === 'water_caves';
      else if (state.pause.activeCompassTarget === 'air_caves') reached = currentBiome === 'air_caves';
      else if (state.pause.activeCompassTarget === 'fire_pyramid' && state.firePyramid) {
        const dx = state.firePyramid.centerX * Game.constants.TILE - px;
        const dy = state.firePyramid.baseY * Game.constants.TILE - py;
        reached = Math.hypot(dx, dy) <= Game.constants.TILE * 8;
      } else if (state.pause.activeCompassTarget === 'fire_castle' && state.fireWorldMeta && state.fireWorldMeta.castle) {
        const castle = state.fireWorldMeta.castle;
        const dx = castle.throneX * Game.constants.TILE - px;
        const dy = castle.baseY * Game.constants.TILE - py;
        reached = Math.hypot(dx, dy) <= Game.constants.TILE * 10;
      } else if (state.pause.activeCompassTarget === 'fire_dungeon' && state.fireDungeon) {
        const dx = state.fireDungeon.centerX * Game.constants.TILE - px;
        const dy = state.fireDungeon.centerY * Game.constants.TILE - py;
        reached = Math.hypot(dx, dy) <= Game.constants.TILE * 8;
      } else if (state.pause.activeCompassTarget === 'water_well' && state.waterWell) {
        const dx = state.waterWell.centerX * Game.constants.TILE - px;
        const dy = state.waterWell.baseY * Game.constants.TILE - py;
        reached = Math.hypot(dx, dy) <= Game.constants.TILE * 8;
      } else if (state.pause.activeCompassTarget === 'water_castle' && state.waterWorldMeta && state.waterWorldMeta.castle) {
        const castle = state.waterWorldMeta.castle;
        const dx = castle.centerX * Game.constants.TILE - px;
        const dy = castle.baseY * Game.constants.TILE - py;
        reached = Math.hypot(dx, dy) <= Game.constants.TILE * 10;
      } else if (state.pause.activeCompassTarget === 'golden_garden' && state.waterWorldMeta && state.waterWorldMeta.goldenGarden) {
        const garden = state.waterWorldMeta.goldenGarden;
        reached = px >= garden.x0 * Game.constants.TILE && px <= garden.x1 * Game.constants.TILE && py >= garden.y0 * Game.constants.TILE && py <= garden.y1 * Game.constants.TILE;
      } else if (state.pause.activeCompassTarget === 'main_well' && state.waterWorldMeta && state.waterWorldMeta.mainWell) {
        const mainWell = state.waterWorldMeta.mainWell;
        const dx = mainWell.centerX * Game.constants.TILE - px;
        const dy = mainWell.baseY * Game.constants.TILE - py;
        reached = Math.hypot(dx, dy) <= Game.constants.TILE * 8;
      } else if (state.pause.activeCompassTarget === 'air_entrance' && state.airCaves && state.airCaves.entrance) {
        const entrance = state.airCaves.entrance;
        reached = px >= entrance.x0 * Game.constants.TILE && px <= (entrance.x1 + 1) * Game.constants.TILE && py >= entrance.y0 * Game.constants.TILE && py <= (entrance.y1 + 1) * Game.constants.TILE;
      } else if (state.pause.activeCompassTarget === 'air_castle' && state.airWorldMeta && state.airWorldMeta.castle) {
        const castle = state.airWorldMeta.castle;
        const dx = castle.centerX * Game.constants.TILE - px;
        const dy = castle.baseY * Game.constants.TILE - py;
        reached = Math.hypot(dx, dy) <= Game.constants.TILE * 12;
      }
      if (reached) {
        state.pause.activeCompassTarget = null;
        state.ui.noticeText = 'Цель компаса достигнута.';
        state.ui.noticeTimer = 3;
      }
    }

    if (state.activeDimension === 'water' && state.waterWorldMeta && state.waterWorldMeta.goldenGarden) {
      const garden = state.waterWorldMeta.goldenGarden;
      const px = state.player.x + state.player.w / 2;
      const py = state.player.y + state.player.h / 2;
      const insideGarden = px >= garden.x0 * Game.constants.TILE && px <= garden.x1 * Game.constants.TILE && py >= garden.y0 * Game.constants.TILE && py <= garden.y1 * Game.constants.TILE;
      if (garden.flowerTaken && !insideGarden && !garden.guardianDefeated && !state.goldenFlowerGuardian) {
        garden.guardianSpawned = true;
        state.goldenFlowerGuardian = {
          x: state.player.x - 48,
          y: state.player.y - 24,
          w: 44,
          h: 60,
          hp: 300,
          maxHp: 300,
          phase: 'idle',
          phaseTimer: 0,
          attackCd: 0.8,
          dir: 1,
          vx: 0,
          vy: 0,
          isBoss: true,
          name: 'Страж золотых цветов',
          arena: {
            x0: Math.max(0, (garden.x0 - 4) * Game.constants.TILE),
            x1: Math.min(state.world[0].length * Game.constants.TILE, (garden.x1 + 4) * Game.constants.TILE),
            y0: Math.max(0, (garden.y0 - 6) * Game.constants.TILE),
            y1: Math.min(state.world.length * Game.constants.TILE, (garden.y1 + 8) * Game.constants.TILE),
          },
        };
        state.ui.noticeText = 'Страж золотых цветов напал.';
        state.ui.noticeTimer = 4;
      }
    }

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

    const worldType = state.worldMeta && state.worldMeta.worldType ? state.worldMeta.worldType : 'normal';
    if (worldType === 'floating_islands' && state.player.y > state.world.length * Game.constants.TILE + 32) {
      const isSpectator = isSpectatorMode();
      if (!isSpectator) {
        state.player.health = 0;
      }
    }

    if (!isCreativeMode() && !isSpectatorMode() && !isInfiniteInventoryMode() && state.player.health <= 0) onPlayerDeath();
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

    if (state.gameOver && state.hardcoreDeath) {
      if (handleHardcoreDeathPointer(input, canvas)) {
        updateCamera(camera, state, canvas);
        draw(ctx, canvas, state, camera, input);
        requestAnimationFrame(loop);
        return;
      }
    } else if (state.pause.open) {
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
