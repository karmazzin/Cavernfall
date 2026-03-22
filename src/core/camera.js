(() => {
  const Game = window.MC2D;
  const { TILE, WORLD_W, WORLD_H, VIEW_ZOOM } = Game.constants;
  const { clamp } = Game.math;

  function viewWidth(canvas) {
    return canvas.width / VIEW_ZOOM;
  }

  function viewHeight(canvas) {
    return canvas.height / VIEW_ZOOM;
  }

  function createCamera(state, canvas) {
    return {
      x: clamp(state.player.x - viewWidth(canvas) / 2, 0, WORLD_W * TILE - viewWidth(canvas)),
      y: clamp(state.player.y - viewHeight(canvas) / 2, 0, WORLD_H * TILE - viewHeight(canvas)),
    };
  }

  function updateCamera(camera, state, canvas) {
    const w = viewWidth(canvas);
    const h = viewHeight(canvas);
    camera.x = clamp(state.player.x + state.player.w / 2 - w / 2, 0, WORLD_W * TILE - w);
    camera.y = clamp(state.player.y + state.player.h / 2 - h / 2, 0, WORLD_H * TILE - h);
    return camera;
  }

  Game.camera = { createCamera, updateCamera };
})();
