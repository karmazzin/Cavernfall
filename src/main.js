(() => {
  const Game = window.MC2D;
  const { BLOCK } = Game.blocks;
  const { createGameState } = Game.state;
  const { generateWorld } = Game.generation;
  const { spawnAnimals, updateAnimals } = Game.animalsEntity;
  const { updatePlayer } = Game.playerEntity;
  const { updateZombies } = Game.zombiesEntity;
  const { updateSpiders } = Game.spidersEntity;
  const { updateFood } = Game.foodEntity;
  const { updateSatiety, updateBreath } = Game.survival;
  const { updateFluids } = Game.fluids;
  const { addToInventory, eatFood } = Game.inventory;
  const { handleMouse } = Game.interaction;
  const { createCamera } = Game.camera;
  const { setupInput } = Game.input;
  const { ensureCraftingState, handleCraftingPointer, toggleCrafting } = Game.crafting;
  const { draw } = Game.renderer;

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const state = createGameState();

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }

  window.addEventListener('resize', resize);
  resize();
  ensureCraftingState(state);

  const input = setupInput(canvas, state, {
    eatFood: () => eatFood(state),
    restart: () => window.location.reload(),
    unlockAudio: () => Game.audio.unlock(),
    toggleCrafting: () => toggleCrafting(state),
  });

  function update(dt) {
    if (state.gameOver) return;

    state.cycleTime += dt;
    if (state.attackFlash > 0) state.attackFlash -= dt;

    updatePlayer(state, input, dt);
    updateAnimals(state, dt);
    updateZombies(state, dt);
    updateSpiders(state, dt);
    updateFood(state, dt);
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

  generateWorld(state);
  spawnAnimals(state);
  addToInventory(state, BLOCK.DIRT, 20);
  addToInventory(state, BLOCK.STONE, 10);
  addToInventory(state, BLOCK.WOOD, 10);
  addToInventory(state, BLOCK.PLANK, 12);

  let last = performance.now();
  function loop(now) {
    const dt = Math.min(0.033, (now - last) / 1000);
    last = now;

    const camera = createCamera(state, canvas);
    if (state.crafting.open) handleCraftingPointer(state, input, canvas);
    else handleMouse(state, input, camera, dt);
    update(dt);
    draw(ctx, canvas, state, camera, input);
    requestAnimationFrame(loop);
  }

  requestAnimationFrame(loop);
})();
