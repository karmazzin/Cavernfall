(() => {
  const Game = window.MC2D;
  const { TILE, WORLD_W, MAX_ZOMBIES, GRAVITY } = Game.constants;
  const { rand, clamp, aabb } = Game.math;
  const { moveEntity } = Game.physics;
  const { phaseInfo } = Game.dayCycle;
  const { BLOCK } = Game.blocks;
  const { getBlock, blockSolid, getLocationInfo, isLitAt } = Game.world;
  const { ensureMobState, updateMobMediumState, getWaterEscapeDir, applyMobEnvironmentDamage } = Game.mobUtils;

  function isCreative(state) {
    return !!(state.worldMeta && state.worldMeta.mode === 'creative');
  }

  function isMineLike(state, tx, ty) {
    for (let yy = ty - 2; yy <= ty + 2; yy += 1) {
      for (let xx = tx - 3; xx <= tx + 3; xx += 1) {
        const block = getBlock(state, xx, yy);
        if (block === BLOCK.PLANK || block === BLOCK.PILLAR || block === BLOCK.LADDER) return true;
      }
    }
    return false;
  }

  function spawnZombieNearPlayer(state) {
    if (state.zombies.length >= MAX_ZOMBIES) return;

    const dir = Math.random() < 0.5 ? -1 : 1;
    const tx = clamp(Math.floor(state.player.x / TILE) + dir * Math.floor(rand(8, 15)), 2, WORLD_W - 3);
    const sy = state.surfaceAt[tx] - 2;
    if (isLitAt(state, tx, sy + 1)) return;

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
      jumpCd: 0,
      obstacleTimer: 0,
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
      if (!location.inCave && !isMineLike(state, tx, headTy)) continue;
      if (isLitAt(state, tx, feetTy)) continue;
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
        jumpCd: 0,
        obstacleTimer: 0,
      });
      ensureMobState(state.zombies[state.zombies.length - 1]);
      return;
    }
  }

  function spawnZombieRaidNearDwarves(state) {
    if (state.zombies.length >= MAX_ZOMBIES || !state.dwarfColony || !state.dwarfColony.settlements.length) return;
    const settlement = state.dwarfColony.settlements[Math.floor(rand(0, state.dwarfColony.settlements.length))];
    const hall = (state.dwarfColony.halls || []).find((entry) => entry.settlementId === settlement.id);
    if (!hall) return;
    const dir = Math.random() < 0.5 ? -1 : 1;
    for (let group = 0; group < 2; group += 1) {
      const tx = clamp(hall.x + dir * Math.floor(rand(hall.halfW + 8, hall.halfW + 14)) + group * dir, 2, WORLD_W - 3);
      const headTy = clamp(hall.y + hall.halfH - 2 + Math.floor(rand(-1, 2)), 16, state.world.length - 4);
      if (isLitAt(state, tx, headTy + 1)) continue;
      if (getBlock(state, tx, headTy) !== BLOCK.AIR || getBlock(state, tx, headTy + 1) !== BLOCK.AIR) continue;
      if (!blockSolid(getBlock(state, tx, headTy + 2))) continue;
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
        jumpCd: 0,
        obstacleTimer: 0,
      });
      ensureMobState(state.zombies[state.zombies.length - 1]);
      if (state.zombies.length >= MAX_ZOMBIES) return;
    }
  }

  function spawnZombieRaidNearHumans(state) {
    if (state.zombies.length >= MAX_ZOMBIES || !state.humanSettlements || !state.humanSettlements.villages.length) return;
    const village = state.humanSettlements.villages[Math.floor(rand(0, state.humanSettlements.villages.length))];
    const dir = Math.random() < 0.5 ? -1 : 1;
    const tx = clamp((dir < 0 ? village.bounds.x0 : village.bounds.x1) + dir * Math.floor(rand(4, 8)), 2, WORLD_W - 3);
    const sy = state.surfaceAt[tx] - 2;
    if (isLitAt(state, tx, sy + 1)) return;
    state.zombies.push({
      x: tx * TILE, y: sy * TILE, w: 12, h: 24, vx: 0, vy: 0, onGround: false,
      attackCd: 0, hp: 3, burnTimer: 0, jumpCd: 0, obstacleTimer: 0,
    });
    ensureMobState(state.zombies[state.zombies.length - 1]);
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
    if (state.zombieCaveSpawnTick >= 4.5) {
      state.zombieCaveSpawnTick = 0;
      spawnZombieInCave(state);
      if (Math.random() < 0.38) spawnZombieRaidNearDwarves(state);
      if (Math.random() < 0.28) spawnZombieRaidNearHumans(state);
    }

    for (let i = state.zombies.length - 1; i >= 0; i -= 1) {
      const zombie = state.zombies[i];
      ensureMobState(zombie);
      zombie.jumpCd = Math.max(0, (zombie.jumpCd || 0) - dt);
      zombie.obstacleTimer = zombie.obstacleTimer || 0;
      const zombieTx = Math.floor((zombie.x + zombie.w / 2) / TILE);
      const zombieTy = Math.floor((zombie.y + zombie.h / 2) / TILE);
      const inCave = getLocationInfo(state, zombieTx, zombieTy).inCave;
      updateMobMediumState(state, zombie);
      let target = null;
      let targetIsPlayer = false;
      let targetDist = Infinity;

      if (!creative) {
        const playerDist = Math.hypot(state.player.x - zombie.x, state.player.y - zombie.y);
        target = state.player;
        targetIsPlayer = true;
        targetDist = playerDist;
      }
      for (const dwarf of state.dwarves || []) {
        const dist = Math.hypot(dwarf.x - zombie.x, dwarf.y - zombie.y);
        if (dist < targetDist) {
          target = dwarf;
          targetIsPlayer = false;
          targetDist = dist;
        }
      }
      for (const human of state.humans || []) {
        const dist = Math.hypot(human.x - zombie.x, human.y - zombie.y);
        if (dist < targetDist) {
          target = human;
          targetIsPlayer = false;
          targetDist = dist;
        }
      }

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
      const dx = target ? target.x - zombie.x : 0;
      zombie.vx = !target ? 0 : Math.sign(dx) * 75;
      if (Math.abs(dx) < 4) zombie.vx = 0;
      if (zombie.inWater) {
        zombie.dir = getWaterEscapeDir(state, zombie, zombie.vx >= 0 ? 1 : -1);
        zombie.vx = zombie.dir * 95;
        zombie.vy = -220;
        zombie.obstacleTimer = 0;
      } else {
        const dir = zombie.vx < 0 ? -1 : zombie.vx > 0 ? 1 : 0;
        if (dir !== 0) {
          const frontX = zombie.x + (dir > 0 ? zombie.w + 1 : -1);
          const txFront = Math.floor(frontX / TILE);
          const tyFeet = Math.floor((zombie.y + zombie.h) / TILE);
          const aheadBlock = getBlock(state, txFront, tyFeet - 1);
          const groundAhead = getBlock(state, txFront, tyFeet);
          const blocked = blockSolid(aheadBlock);
          const missingGround = !blockSolid(groundAhead);
          if (blocked && !missingGround && zombie.onGround) zombie.obstacleTimer += dt;
          else zombie.obstacleTimer = 0;
          if (zombie.onGround && zombie.jumpCd <= 0 && zombie.obstacleTimer > 0.16) {
            zombie.vy = -340;
            zombie.jumpCd = 0.85;
            zombie.obstacleTimer = 0;
          }
        } else {
          zombie.obstacleTimer = 0;
        }
        zombie.vy += GRAVITY * dt;
        if (targetIsPlayer && !creative && state.player.y + 16 < zombie.y && zombie.onGround && zombie.jumpCd <= 0 && Math.abs(dx) < 48) {
          zombie.vy = -380;
          zombie.jumpCd = 1.1;
        }
      }
      moveEntity(state, zombie, dt);
      applyMobEnvironmentDamage(state, zombie, dt, wasOnGround, preMoveVy);

      zombie.attackCd -= dt;
      if (targetIsPlayer && !creative && aabb(zombie.x, zombie.y, zombie.w, zombie.h, state.player.x, state.player.y, state.player.w, state.player.h) && zombie.attackCd <= 0) {
        zombie.attackCd = 0.7;
        state.player.health = Math.max(0, state.player.health - 1);
        state.attackFlash = 0.25;
        if (state.player.health <= 0) state.gameOver = true;
      } else if (!targetIsPlayer && target && aabb(zombie.x, zombie.y, zombie.w, zombie.h, target.x, target.y, target.w, target.h) && zombie.attackCd <= 0) {
        zombie.attackCd = 0.8;
        target.hp -= 1;
      }

      if (zombie.hp <= 0) {
        state.zombies.splice(i, 1);
      }
    }
  }

  Game.zombiesEntity = { spawnZombieNearPlayer, spawnZombieInCave, updateZombies };
})();
