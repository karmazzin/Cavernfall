(() => {
  const Game = window.MC2D;
  const { TILE, WORLD_W, MAX_ZOMBIES, GRAVITY } = Game.constants;
  const { rand, clamp, aabb } = Game.math;
  const { moveEntity } = Game.physics;
  const { phaseInfo } = Game.dayCycle;

  function spawnZombieNearPlayer(state) {
    if (state.zombies.length >= MAX_ZOMBIES) return;

    const dir = Math.random() < 0.5 ? -1 : 1;
    const tx = clamp(Math.floor(state.player.x / TILE) + dir * Math.floor(rand(8, 15)), 2, WORLD_W - 3);
    const sy = state.surfaceAt[tx] - 2;

    state.zombies.push({
      x: tx * TILE,
      y: sy * TILE,
      w: 12,
      h: 24,
      vx: 0,
      vy: 0,
      onGround: false,
      attackCd: 0,
      hp: 3,
      burnTimer: 0,
    });
  }

  function updateZombies(state, dt) {
    const phase = phaseInfo(state).phase;
    const sunlight = phase === 'day' || phase === 'sunrise';

    if (phase === 'night') {
      state.zombieSpawnTick += dt;
      if (state.zombieSpawnTick >= 4) {
        state.zombieSpawnTick = 0;
        spawnZombieNearPlayer(state);
      }
    } else {
      state.zombieSpawnTick = 0;
    }

    for (let i = state.zombies.length - 1; i >= 0; i -= 1) {
      const zombie = state.zombies[i];

      if (sunlight) {
        zombie.burnTimer += dt;
        if (zombie.burnTimer >= 0.45) {
          zombie.burnTimer = 0;
          zombie.hp -= 1;
        }
      } else {
        zombie.burnTimer = 0;
      }

      const dx = state.player.x - zombie.x;
      zombie.vx = Math.sign(dx) * 75;
      if (Math.abs(dx) < 4) zombie.vx = 0;
      zombie.vy += GRAVITY * dt;
      if (state.player.y + 8 < zombie.y && zombie.onGround) zombie.vy = -430;
      moveEntity(state, zombie, dt);

      zombie.attackCd -= dt;
      if (aabb(zombie.x, zombie.y, zombie.w, zombie.h, state.player.x, state.player.y, state.player.w, state.player.h) && zombie.attackCd <= 0) {
        zombie.attackCd = 0.7;
        state.player.health = Math.max(0, state.player.health - 1);
        state.attackFlash = 0.25;
        if (state.player.health <= 0) state.gameOver = true;
      }

      if (zombie.hp <= 0) {
        state.zombies.splice(i, 1);
      }
    }
  }

  Game.zombiesEntity = { spawnZombieNearPlayer, updateZombies };
})();
