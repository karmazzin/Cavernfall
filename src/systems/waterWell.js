(() => {
  const Game = window.MC2D;
  const { TILE } = Game.constants;
  const { BLOCK } = Game.blocks;
  const { getBlock, setBlock } = Game.world;

  function getRitual(state) {
    if (!state.waterWell) return null;
    if (!state.waterWell.ritual) {
      state.waterWell.ritual = {
        active: false,
        phase: 'idle',
        timer: 0,
        completed: false,
        portalCreated: false,
      };
    }
    return state.waterWell.ritual;
  }

  function inWellWater(state, tx, ty) {
    const well = state.waterWell;
    if (!well) return false;
    return tx >= well.waterX0 && tx <= well.waterX1 && ty >= well.waterY0 && ty <= well.waterY1;
  }

  function tryActivateWaterWell(state, food) {
    const well = state.waterWell;
    const ritual = getRitual(state);
    if (!well || !ritual || ritual.active || ritual.completed) return false;
    if (!food || food.itemId !== BLOCK.WATER_CRYSTAL) return false;
    const tx = Math.floor((food.x + food.w / 2) / TILE);
    const ty = Math.floor((food.y + food.h / 2) / TILE);
    if (!inWellWater(state, tx, ty)) return false;
    if (getBlock(state, tx, ty) !== BLOCK.WATER) return false;

    ritual.active = true;
    ritual.phase = 'beam_rise';
    ritual.timer = 0;
    state.ui.noticeText = 'Водный колодец пробуждается.';
    state.ui.noticeTimer = 3;
    return true;
  }

  function updateWaterWell(state, dt) {
    const well = state.waterWell;
    const ritual = getRitual(state);
    if (!well || !ritual || !ritual.active) return;

    ritual.timer += dt;
    if (ritual.phase === 'beam_rise' && ritual.timer >= 0.9) {
      ritual.phase = 'beam_hold';
      ritual.timer = 0;
    } else if (ritual.phase === 'beam_hold' && ritual.timer >= 1.0) {
      ritual.phase = 'beam_fade';
      ritual.timer = 0;
      setBlock(state, well.portalX, well.portalY, BLOCK.WATER_DIMENSION_PORTAL);
      ritual.portalCreated = true;
    } else if (ritual.phase === 'beam_fade' && ritual.timer >= 0.8) {
      ritual.active = false;
      ritual.completed = true;
      ritual.phase = 'done';
      ritual.timer = 0;
      state.ui.noticeText = 'Портал в водное измерение появился.';
      state.ui.noticeTimer = 3.5;
    }
  }

  Game.waterWellSystem = { tryActivateWaterWell, updateWaterWell };
})();
