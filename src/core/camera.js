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

  function updateCamera(camera, state, canvas) {
    camera.x = clamp(state.player.x + state.player.w / 2 - canvas.width / 2, 0, WORLD_W * TILE - canvas.width);
    camera.y = clamp(state.player.y + state.player.h / 2 - canvas.height / 2, 0, WORLD_H * TILE - canvas.height);
    return camera;
  }

  Game.camera = { createCamera, updateCamera };
})();
