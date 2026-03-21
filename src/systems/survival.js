(() => {
  const Game = window.MC2D;
  const { BREATH_CELL_SECONDS, BREATH_TOTAL } = Game.constants;

  function updateHunger(state, dt) {
    state.hungerTick += dt;
    if (state.hungerTick >= 2) {
      state.hungerTick = 0;
      state.player.hunger = Math.max(0, state.player.hunger - 1);
    }

    if (state.player.hunger <= 0) {
      state.starvingTick += dt;
      if (state.starvingTick >= 2.5) {
        state.starvingTick = 0;
        state.player.health = Math.max(0, state.player.health - 1);
        state.attackFlash = 0.18;
        if (state.player.health <= 0) state.gameOver = true;
      }
    } else {
      state.starvingTick = 0;
    }
  }

  function updateBreath(state, dt) {
    if (state.player.underwater) {
      state.player.breath = Math.max(0, state.player.breath - dt);
      if (state.player.breath <= 0) {
        state.player.health = Math.max(0, state.player.health - dt / BREATH_CELL_SECONDS);
        state.attackFlash = 0.08;
        if (state.player.health <= 0) state.gameOver = true;
      }
    } else {
      state.player.breath = Math.min(BREATH_TOTAL, state.player.breath + dt * 3);
    }
  }

  Game.survival = { updateHunger, updateBreath };
})();
