(() => {
  const Game = window.MC2D;
  const { BLOCK } = Game.blocks;
  const { createGameState } = Game.state;
  const { generateWorld, retrofitWorldFeatures } = Game.generation;
  const { spawnAnimals, updateAnimals } = Game.animalsEntity;
  const { updatePlayer } = Game.playerEntity;
  const { updateZombies } = Game.zombiesEntity;
  const { updateSpiders } = Game.spidersEntity;
  const { updateFood } = Game.foodEntity;
  const { updateFurnaces } = Game.furnaceSystem;
  const { updateSatiety, updateBreath } = Game.survival;
  const { updateFluids } = Game.fluids;
  const { addToInventory, eatFood } = Game.inventory;
  const { handleMouse } = Game.interaction;
  const { createCamera } = Game.camera;
  const { setupInput } = Game.input;
  const { ensureCraftingState, handleCraftingPointer, toggleCrafting, closeCrafting } = Game.crafting;
  const { saveGame, loadGame, clearSave } = Game.saveSystem;
  const { draw } = Game.renderer;
  const { getPauseLayout } = Game.pauseRenderer;

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const state = createGameState();

  function replaceState(nextState) {
    for (const key of Object.keys(state)) delete state[key];
    Object.assign(state, nextState);
    ensureCraftingState(state);
    input.syncUiState();
  }

  function seedStarterInventory() {
    addToInventory(state, BLOCK.DIRT, 20);
    addToInventory(state, BLOCK.STONE, 10);
    addToInventory(state, BLOCK.WOOD, 10);
    addToInventory(state, BLOCK.PLANK, 12);
  }

  function startNewGame() {
    const nextState = createGameState();
    replaceState(nextState);
    generateWorld(state);
    spawnAnimals(state);
    seedStarterInventory();
  }

  function contains(rect, x, y) {
    return x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h;
  }

  function closePause() {
    state.pause.open = false;
    state.pause.confirmRestart = false;
    state.pause.showControls = false;
    state.pause.statusText = '';
  }

  function openPause() {
    if (state.crafting.open) {
      closeCrafting(state);
      if (state.crafting.open) return;
    }
    state.pause.open = true;
    state.pause.confirmRestart = false;
    state.pause.showControls = false;
    state.pause.statusText = '';
  }

  function togglePause() {
    if (state.gameOver) return;
    if (state.pause.open) closePause();
    else openPause();
  }

  function handlePausePointer(input, canvasRef) {
    if (!state.pause.open || !input.mouse.justPressed) return false;
    const layout = getPauseLayout(canvasRef, state);
    const { x, y } = input.mouse;
    for (const button of layout.buttons) {
      if (!contains(button, x, y)) continue;

      if (button.id === 'continue') closePause();
      if (button.id === 'controls') state.pause.showControls = true;
      if (button.id === 'controls_back') state.pause.showControls = false;
      if (button.id === 'save') state.pause.statusText = saveGame(state) ? 'Игра сохранена' : 'Сохранение не удалось';
      if (button.id === 'fullscreen') input.toggleFullscreen();
      if (button.id === 'restart') state.pause.confirmRestart = true;
      if (button.id === 'restart_no') state.pause.confirmRestart = false;
      if (button.id === 'restart_yes') {
        clearSave();
        startNewGame();
      }

      input.mouse.justPressed = false;
      return true;
    }

    input.mouse.justPressed = false;
    return true;
  }

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }

  window.addEventListener('resize', resize);
  resize();
  ensureCraftingState(state);

  const input = setupInput(canvas, state, {
    eatFood: () => eatFood(state),
    restart: () => {
      clearSave();
      startNewGame();
    },
    unlockAudio: () => Game.audio.unlock(),
    toggleCrafting: () => toggleCrafting(state),
    togglePause,
  });

  const loadedState = loadGame();
  if (loadedState) {
    replaceState(loadedState);
    retrofitWorldFeatures(state);
  } else startNewGame();

  function update(dt) {
    document.body.classList.toggle('ui-overlay-hidden', !!(state.pause.open || (state.crafting && state.crafting.open)));
    if (state.pause.open || state.gameOver) return;

    if (!state.crafting.open) state.cycleTime += dt;
    if (state.attackFlash > 0) state.attackFlash -= dt;
    state.autosaveTick += dt;
    if (state.autosaveTick >= 60) {
      saveGame(state);
      state.autosaveTick = 0;
    }

    updatePlayer(state, input, dt);
    updateAnimals(state, dt);
    updateZombies(state, dt);
    updateSpiders(state, dt);
    updateFood(state, dt);
    updateFurnaces(state, dt);
    updateSatiety(state, input, dt);
    updateBreath(state, dt);

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

    if (state.player.health <= 0) state.gameOver = true;
  }

  let last = performance.now();
  function loop(now) {
    const dt = Math.min(0.033, (now - last) / 1000);
    last = now;

    const camera = createCamera(state, canvas);
    if (state.gameOver && state.ui && state.ui.controlMode === 'touch' && input.mouse.justPressed) {
      clearSave();
      startNewGame();
      input.mouse.justPressed = false;
    } else if (state.pause.open) handlePausePointer(input, canvas);
    else if (state.crafting.open) handleCraftingPointer(state, input, canvas);
    else handleMouse(state, input, camera, dt);
    update(dt);
    draw(ctx, canvas, state, camera, input);
    requestAnimationFrame(loop);
  }

  requestAnimationFrame(loop);
})();
