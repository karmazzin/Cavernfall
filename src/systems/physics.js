(() => {
  const Game = window.MC2D;
  const { TILE } = Game.constants;
  const { isSolidAtPixel } = Game.world;

  function moveEntity(state, ent, dt) {
    ent.x += ent.vx * dt;

    if (ent.vx > 0) {
      if (isSolidAtPixel(state, ent.x + ent.w, ent.y + 1) || isSolidAtPixel(state, ent.x + ent.w, ent.y + ent.h - 1)) {
        ent.x = Math.floor((ent.x + ent.w) / TILE) * TILE - ent.w - 0.01;
        ent.vx = 0;
      }
    } else if (ent.vx < 0) {
      if (isSolidAtPixel(state, ent.x, ent.y + 1) || isSolidAtPixel(state, ent.x, ent.y + ent.h - 1)) {
        ent.x = Math.floor(ent.x / TILE + 1) * TILE + 0.01;
        ent.vx = 0;
      }
    }

    ent.y += ent.vy * dt;
    ent.onGround = false;

    if (ent.vy > 0) {
      if (isSolidAtPixel(state, ent.x + 1, ent.y + ent.h) || isSolidAtPixel(state, ent.x + ent.w - 1, ent.y + ent.h)) {
        ent.y = Math.floor((ent.y + ent.h) / TILE) * TILE - ent.h - 0.01;
        ent.vy = 0;
        ent.onGround = true;
      }
    } else if (ent.vy < 0) {
      if (isSolidAtPixel(state, ent.x + 1, ent.y) || isSolidAtPixel(state, ent.x + ent.w - 1, ent.y)) {
        ent.y = Math.floor(ent.y / TILE + 1) * TILE + 0.01;
        ent.vy = 0;
      }
    }
  }

  Game.physics = { moveEntity };
})();
