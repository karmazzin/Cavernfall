(() => {
  const Game = window.MC2D;
  const { TILE } = Game.constants;
  const { BLOCK } = Game.blocks;
  const { getBlock, setBlock } = Game.world;
  const { hasFullFriendshipArmor } = Game.combat;

  function getDomeActionTarget(state) {
    if (state.activeDimension !== 'water' || !state.waterWorldMeta || !state.waterWorldMeta.arrivalDome) return null;
    const dome = state.waterWorldMeta.arrivalDome;
    if (!dome.active) return null;
    const cx = dome.cx * TILE + TILE / 2;
    const cy = dome.cy * TILE + TILE / 2;
    const px = state.player.x + state.player.w / 2;
    const py = state.player.y + state.player.h / 2;
    if (Math.hypot(cx - px, cy - py) > TILE * 5) return null;
    return dome;
  }

  function dissolveArrivalDome(state, dome) {
    for (let ty = dome.y0; ty <= dome.y1; ty += 1) {
      for (let tx = dome.x0; tx <= dome.x1; tx += 1) {
        const dx = (tx - dome.cx) / dome.rx;
        const dy = (ty - dome.cy) / dome.ry;
        if (dx * dx + dy * dy > 1.08) continue;
        if (getBlock(state, tx, ty) === BLOCK.WATER_DIMENSION_PORTAL) continue;
        setBlock(state, tx, ty, BLOCK.WATER);
      }
    }
    dome.active = false;
    state.waterWorldMeta.domeReleased = true;
    state.pause.activeCompassTarget = 'water_castle';
    state.ui.noticeText = 'Купол снят. Иди к замку водяного.';
    state.ui.noticeTimer = 4.5;
  }

  function useNearbyWaterDome(state) {
    const dome = getDomeActionTarget(state);
    if (!dome) return false;
    if (!hasFullFriendshipArmor(state)) {
      state.ui.noticeText = 'Нужен полный сет Брони дружбы.';
      state.ui.noticeTimer = 3.5;
      return true;
    }
    dissolveArrivalDome(state, dome);
    return true;
  }

  Game.waterDimensionSystem = { useNearbyWaterDome, getDomeActionTarget };
})();
