(() => {
  const Game = window.MC2D;
  const { TILE } = Game.constants;
  const { isSolidAtPixel } = Game.world;

  function collidesAt(state, ent, x, y) {
    return (
      isSolidAtPixel(state, x + 1, y + 1) ||
      isSolidAtPixel(state, x + ent.w - 1, y + 1) ||
      isSolidAtPixel(state, x + 1, y + ent.h - 1) ||
      isSolidAtPixel(state, x + ent.w - 1, y + ent.h - 1)
    );
  }

  function tryStepUp(state, ent, targetX) {
    const maxStepHeight = ent.stepUpHeight || 0;
    if (maxStepHeight <= 0) return false;

    for (let step = 1; step <= maxStepHeight; step += 1) {
      const targetY = ent.y - step;
      if (!collidesAt(state, ent, targetX, targetY)) {
        ent.x = targetX;
        ent.y = targetY;
        return true;
      }
    }

    return false;
  }

  function moveHorizontal(state, ent, dx) {
    if (dx === 0) return;

    ent.x += dx;

    if (dx > 0) {
      if (isSolidAtPixel(state, ent.x + ent.w, ent.y + 1) || isSolidAtPixel(state, ent.x + ent.w, ent.y + ent.h - 1)) {
        if (!tryStepUp(state, ent, ent.x)) {
          ent.x = Math.floor((ent.x + ent.w) / TILE) * TILE - ent.w - 0.01;
          ent.vx = 0;
        }
      }
    } else if (isSolidAtPixel(state, ent.x, ent.y + 1) || isSolidAtPixel(state, ent.x, ent.y + ent.h - 1)) {
      if (!tryStepUp(state, ent, ent.x)) {
        ent.x = Math.floor(ent.x / TILE + 1) * TILE + 0.01;
        ent.vx = 0;
      }
    }
  }

  function moveVertical(state, ent, dy) {
    if (dy === 0) return;

    ent.y += dy;
    if (dy > 0) {
      if (isSolidAtPixel(state, ent.x + 1, ent.y + ent.h) || isSolidAtPixel(state, ent.x + ent.w - 1, ent.y + ent.h)) {
        ent.y = Math.floor((ent.y + ent.h) / TILE) * TILE - ent.h - 0.01;
        ent.vy = 0;
        ent.onGround = true;
      }
    } else if (isSolidAtPixel(state, ent.x + 1, ent.y) || isSolidAtPixel(state, ent.x + ent.w - 1, ent.y)) {
      ent.y = Math.floor(ent.y / TILE + 1) * TILE + 0.01;
      ent.vy = 0;
    }
  }

  function moveEntity(state, ent, dt) {
    ent.onGround = false;

    const totalDx = ent.vx * dt;
    const totalDy = ent.vy * dt;
    const maxDelta = Math.max(Math.abs(totalDx), Math.abs(totalDy));
    const steps = Math.max(1, Math.ceil(maxDelta / 6));
    const stepDx = totalDx / steps;
    const stepDy = totalDy / steps;

    for (let i = 0; i < steps; i += 1) {
      moveHorizontal(state, ent, stepDx);
      moveVertical(state, ent, stepDy);
    }
  }

  Game.physics = { moveEntity };
})();
