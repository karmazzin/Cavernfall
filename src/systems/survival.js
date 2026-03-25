(() => {
  const Game = window.MC2D;
  const { BREATH_CELL_SECONDS, BREATH_TOTAL } = Game.constants;
  const { applyPlayerDamage } = Game.combat;

  function isCreative(state) {
    return !!(state.worldMeta && state.worldMeta.mode === 'creative');
  }

  function isNonSurvivalMode(state) {
    return !!(state.worldMeta && (state.worldMeta.mode === 'creative' || state.worldMeta.mode === 'spectator'));
  }

  function updateSatiety(state, input, dt) {
    if (isNonSurvivalMode(state)) {
      state.player.health = 10;
      state.player.satiety = 100;
      state.starvationTick = 0;
      state.regenTick = 0;
      state.satietyTick = 0;
      return;
    }

    const active =
      input.mouse.down ||
      input.keys.has('KeyA') ||
      input.keys.has('KeyD') ||
      input.keys.has('KeyW') ||
      input.keys.has('KeyS') ||
      input.keys.has('Space') ||
      state.player.inWater ||
      Math.abs(state.player.vx) > 10 ||
      Math.abs(state.player.vy) > 45;

    const drainInterval = active ? 2.2 : 5;
    state.satietyTick += dt;
    if (state.satietyTick >= drainInterval) {
      state.satietyTick = 0;
      state.player.satiety = Math.max(0, state.player.satiety - 1);
    }

    if (state.player.satiety <= 0) {
      state.starvationTick += dt;
      state.regenTick = 0;
      if (state.starvationTick >= 2.5) {
        state.starvationTick = 0;
        applyPlayerDamage(state, 1, { flash: 0.18, ignoreArmor: true });
      }
    } else {
      state.starvationTick = 0;
      if (state.player.health < 10) {
        state.regenTick += dt;
        if (state.regenTick >= 6) {
          state.regenTick = 0;
          state.player.health = Math.min(10, state.player.health + 1);
        }
      } else {
        state.regenTick = 0;
      }
    }
  }

  function updateBreath(state, dt) {
    if (isNonSurvivalMode(state)) {
      state.player.breath = BREATH_TOTAL;
      return;
    }

    if (state.player.underwater) {
      state.player.breath = Math.max(0, state.player.breath - dt);
      if (state.player.breath <= 0) {
        applyPlayerDamage(state, dt / BREATH_CELL_SECONDS, { flash: 0.08, ignoreArmor: true });
      }
    } else {
      state.player.breath = Math.min(BREATH_TOTAL, state.player.breath + dt * 3);
    }
  }

  Game.survival = { updateSatiety, updateBreath };
})();
