(() => {
  const Game = window.MC2D;
  const { TILE, WORLD_W, MAX_ZOMBIES, GRAVITY } = Game.constants;
  const { rand, clamp, aabb } = Game.math;
  const { moveEntity } = Game.physics;
  const { phaseInfo } = Game.dayCycle;
  const { BLOCK } = Game.blocks;
  const { getBlock, blockSolid, getLocationInfo, isLitAt } = Game.world;
  const { ensureMobState, updateMobMediumState, getWaterEscapeDir, applyMobEnvironmentDamage } = Game.mobUtils;
  const { applyPlayerDamage } = Game.combat;
  const { isPlayerUndetectable } = Game.invisibilitySystem || {};

  function ignoresPlayer(state) {
    return !!(state.worldMeta && (state.worldMeta.mode === 'creative' || state.worldMeta.mode === 'mobile' || state.worldMeta.mode === 'spectator' || state.worldMeta.mode === 'hardcore_spectator')) || !!(isPlayerUndetectable && isPlayerUndetectable(state));
  }

  function canHitPlayer(state, zombie) {
    return aabb(zombie.x - 4, zombie.y - 4, zombie.w + 8, zombie.h + 8, state.player.x, state.player.y, state.player.w, state.player.h);
  }

  function defeatZombie(state, index) {
    const zombie = state.zombies[index];
    if (zombie && zombie.ashGuardian && state.fireWorldMeta && state.fireWorldMeta.ashCache) {
      state.fireWorldMeta.ashCache.guardianDefeated = true;
      state.fireWorldMeta.ashCache.guardianSpawned = true;
      state.ui.noticeText = 'Пепельный страж рассыпался. Клад открыт.';
      state.ui.noticeTimer = 4;
    }
    state.zombies.splice(index, 1);
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
    const creative = ignoresPlayer(state);
    const phase = phaseInfo(state).phase;
    const sunlight = phase === 'day' || phase === 'sunrise';
    const allowSpawns = state.activeDimension !== 'fire';

    if (allowSpawns && phase === 'night') {
      state.zombieSpawnTick += dt;
      if (state.zombieSpawnTick >= 4) {
        state.zombieSpawnTick = 0;
        spawnZombieNearPlayer(state);
      }
    } else {
      state.zombieSpawnTick = 0;
    }

    if (allowSpawns) {
      state.zombieCaveSpawnTick += dt;
      if (state.zombieCaveSpawnTick >= 4.5) {
        state.zombieCaveSpawnTick = 0;
        spawnZombieInCave(state);
        if (Math.random() < 0.38) spawnZombieRaidNearDwarves(state);
        if (Math.random() < 0.28) spawnZombieRaidNearHumans(state);
      }
    } else {
      state.zombieCaveSpawnTick = 0;
    }

    for (let i = state.zombies.length - 1; i >= 0; i -= 1) {
      const zombie = state.zombies[i];
      ensureMobState(zombie);
      if (zombie.ashGuardian) {
        zombie.hp = Math.min(zombie.hp, zombie.maxHp || zombie.hp);
        zombie.breath = 3.5;
      }
      zombie.jumpCd = Math.max(0, (zombie.jumpCd || 0) - dt);
      zombie.obstacleTimer = zombie.obstacleTimer || 0;
      const zombieTx = Math.floor((zombie.x + zombie.w / 2) / TILE);
      const zombieTy = Math.floor((zombie.y + zombie.h / 2) / TILE);
      const inCave = getLocationInfo(state, zombieTx, zombieTy).inCave;
      updateMobMediumState(state, zombie);
      let target = null;
      let targetIsPlayer = false;
      let targetDist = Infinity;
      const pirateAggroRange = zombie.pirate ? TILE * 18 : Infinity;

      if (!creative) {
        const playerDist = Math.hypot(state.player.x - zombie.x, state.player.y - zombie.y);
        if (playerDist <= pirateAggroRange) {
          target = state.player;
          targetIsPlayer = true;
          targetDist = playerDist;
        }
      }
      if (!zombie.pirate) {
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
      } else if (!target && Number.isFinite(zombie.anchorX) && Number.isFinite(zombie.anchorY)) {
        target = { x: zombie.anchorX, y: zombie.anchorY, w: zombie.w, h: zombie.h };
        targetIsPlayer = false;
        targetDist = Math.hypot(zombie.anchorX - zombie.x, zombie.anchorY - zombie.y);
      }

      if (sunlight && !inCave && !zombie.ashGuardian) {
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
      const walkSpeed = zombie.ashGuardian ? 92 : 75;
      zombie.vx = !target ? 0 : Math.sign(dx) * walkSpeed;
      if (Math.abs(dx) < 4) zombie.vx = 0;
      if (zombie.inWater) {
        if (zombie.pirate) {
          const swimDir = dx === 0 ? (zombie.dir || 1) : Math.sign(dx);
          zombie.dir = swimDir || 1;
          zombie.vx = zombie.dir * (targetIsPlayer ? 125 : 68);
          if (target) {
            const targetMidY = target.y + (target.h || 0) * 0.5;
            const selfMidY = zombie.y + zombie.h * 0.5;
            const dy = targetMidY - selfMidY;
            zombie.vy = clamp(dy * (targetIsPlayer ? 2.4 : 1.6), -250, 180);
            if (!targetIsPlayer && Math.abs(dx) < 10 && Math.abs(dy) < 10) {
              zombie.vx *= 0.2;
              zombie.vy *= 0.2;
            }
          } else {
            zombie.vy = -70 + Math.sin((zombie.x + zombie.y) * 0.01) * 30;
          }
        } else {
          zombie.dir = getWaterEscapeDir(state, zombie, zombie.vx >= 0 ? 1 : -1);
          zombie.vx = zombie.dir * 95;
          zombie.vy = -220;
        }
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
      if (!zombie.ashGuardian) applyMobEnvironmentDamage(state, zombie, dt, wasOnGround, preMoveVy);
      else if (!wasOnGround && zombie.onGround && !zombie.inWater && preMoveVy > 760) {
        const damage = Math.ceil((preMoveVy - 760) / 260);
        if (damage > 0) zombie.hp -= damage;
      }

      zombie.attackCd -= dt;
      if (targetIsPlayer && !creative && canHitPlayer(state, zombie) && zombie.attackCd <= 0) {
        zombie.attackCd = zombie.ashGuardian ? 0.95 : 0.7;
        applyPlayerDamage(state, zombie.ashGuardian ? 1.7 : 1, { flash: 0.25, elementalKind: zombie.ashGuardian ? 'fire' : null });
      } else if (!targetIsPlayer && target && aabb(zombie.x, zombie.y, zombie.w, zombie.h, target.x, target.y, target.w, target.h) && zombie.attackCd <= 0) {
        zombie.attackCd = 0.8;
        target.hp -= 1;
      }

      if (zombie.hp <= 0) {
        defeatZombie(state, i);
      }
    }
  }

  Game.zombiesEntity = { spawnZombieNearPlayer, spawnZombieInCave, updateZombies, defeatZombie };
})();
