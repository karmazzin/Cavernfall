(() => {
  const Game = window.MC2D;
  const { TILE, WORLD_W, MAX_ZOMBIES, GRAVITY } = Game.constants;
  const { rand, clamp, aabb } = Game.math;
  const { moveEntity } = Game.physics;
  const { phaseInfo } = Game.dayCycle;
  const { BLOCK } = Game.blocks;
  const { getBlock, blockSolid, getLocationInfo } = Game.world;
  const { ensureMobState, updateMobMediumState, getWaterEscapeDir, applyMobEnvironmentDamage } = Game.mobUtils;

  function isCreative(state) {
    return !!(state.worldMeta && state.worldMeta.mode === 'creative');
  }

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
    ensureMobState(state.zombies[state.zombies.length - 1]);
  }

  function spawnZombieInCave(state) {
    if (state.zombies.length >= MAX_ZOMBIES) return;

    const playerTx = Math.floor((state.player.x + state.player.w / 2) / TILE);
    const playerTy = Math.floor((state.player.y + state.player.h / 2) / TILE);

    for (let attempt = 0; attempt < 60; attempt += 1) {
      const tx = clamp(playerTx + Math.floor(rand(-22, 23)), 2, WORLD_W - 3);
      const feetTy = clamp(playerTy + Math.floor(rand(-14, 15)), 16, state.world.length - 3);
      const headTy = feetTy - 1;
      const location = getLocationInfo(state, tx, headTy);
      if (!location.inCave) continue;
      if (getBlock(state, tx, headTy) !== BLOCK.AIR) continue;
      if (getBlock(state, tx, feetTy) !== BLOCK.AIR) continue;
      if (!blockSolid(getBlock(state, tx, feetTy + 1))) continue;
      if (Math.hypot(tx * TILE - state.player.x, headTy * TILE - state.player.y) < 120) continue;

      state.zombies.push({
        x: tx * TILE,
        y: headTy * TILE,
        w: 12,
        h: 24,
        vx: 0,
        vy: 0,
        onGround: false,
        attackCd: 0,
        hp: 3,
        burnTimer: 0,
      });
      ensureMobState(state.zombies[state.zombies.length - 1]);
      return;
    }
  }

  function updateZombies(state, dt) {
    const creative = isCreative(state);
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

    state.zombieCaveSpawnTick += dt;
    if (state.zombieCaveSpawnTick >= 6) {
      state.zombieCaveSpawnTick = 0;
      spawnZombieInCave(state);
    }

    for (let i = state.zombies.length - 1; i >= 0; i -= 1) {
      const zombie = state.zombies[i];
      ensureMobState(zombie);
      const zombieTx = Math.floor((zombie.x + zombie.w / 2) / TILE);
      const zombieTy = Math.floor((zombie.y + zombie.h / 2) / TILE);
      const inCave = getLocationInfo(state, zombieTx, zombieTy).inCave;
      updateMobMediumState(state, zombie);

      if (sunlight && !inCave) {
        zombie.burnTimer += dt;
        if (zombie.burnTimer >= 0.45) {
          zombie.burnTimer = 0;
          zombie.hp -= 1;
        }
      } else {
        zombie.burnTimer = 0;
      }

      const wasOnGround = zombie.onGround;
      const preMoveVy = zombie.vy;
      const dx = state.player.x - zombie.x;
      zombie.vx = creative ? 0 : Math.sign(dx) * 75;
      if (Math.abs(dx) < 4) zombie.vx = 0;
      if (zombie.inWater) {
        zombie.dir = getWaterEscapeDir(state, zombie, zombie.vx >= 0 ? 1 : -1);
        zombie.vx = zombie.dir * 95;
        zombie.vy = -220;
      } else {
        zombie.vy += GRAVITY * dt;
        if (!creative && state.player.y + 8 < zombie.y && zombie.onGround) zombie.vy = -430;
      }
      moveEntity(state, zombie, dt);
      applyMobEnvironmentDamage(state, zombie, dt, wasOnGround, preMoveVy);

      zombie.attackCd -= dt;
      if (!creative && aabb(zombie.x, zombie.y, zombie.w, zombie.h, state.player.x, state.player.y, state.player.w, state.player.h) && zombie.attackCd <= 0) {
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

  Game.zombiesEntity = { spawnZombieNearPlayer, spawnZombieInCave, updateZombies };
})();
