(() => {
  const Game = window.MC2D;
  const { TILE, WORLD_W, WORLD_H } = Game.constants;
  const { clamp } = Game.math;

  function createCamera(state, canvas) {
    return {
      x: clamp(state.player.x - canvas.width / 2, 0, WORLD_W * TILE - canvas.width),
      y: clamp(state.player.y - canvas.height / 2, 0, WORLD_H * TILE - canvas.height),
    };
  }

  Game.camera = { createCamera };
})();
