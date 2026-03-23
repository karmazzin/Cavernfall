(() => {
  const Game = window.MC2D;
  const { TILE, GRAVITY, WORLD_W } = Game.constants;
  const { aabb, rand, clamp } = Game.math;
  const { getBlock, blockSolid, getLocationInfo, isLitAt } = Game.world;
  const { moveEntity } = Game.physics;
  const { BLOCK } = Game.blocks;
  const { phaseInfo } = Game.dayCycle;
  const { ensureMobState, updateMobMediumState, getWaterEscapeDir, applyMobEnvironmentDamage } = Game.mobUtils;

  const MAX_SPIDERS = 14;

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

  function createSpider(tx, ty) {
    const spider = {
      x: tx * TILE + 1,
      y: ty * TILE + 4,
      w: 14,
      h: 10,
      vx: 0,
      vy: 0,
      onGround: false,
      hp: 2,
      attackCd: 0,
      clickCd: 0,
      moveTimer: rand(0.4, 1.5),
      dir: Math.random() < 0.5 ? -1 : 1,
      jumpCd: 0,
      obstacleTimer: 0,
    };
    ensureMobState(spider);
    return spider;
  }

  function spawnSpiderOnSurface(state) {
    if (state.spiders.length >= MAX_SPIDERS) return;
    const playerTx = Math.floor(state.player.x / TILE);

    for (let attempt = 0; attempt < 40; attempt += 1) {
      const dir = Math.random() < 0.5 ? -1 : 1;
      const tx = clamp(playerTx + dir * Math.floor(rand(8, 18)), 4, WORLD_W - 5);
      const ty = state.surfaceAt[tx] - 1;
      if (getBlock(state, tx, ty) !== BLOCK.AIR) continue;
      if (getLocationInfo(state, tx, ty).inCave) continue;
      if (isLitAt(state, tx, ty + 1)) continue;
      state.spiders.push(createSpider(tx, ty));
      return;
    }
  }

  function spawnSpiderInCave(state) {
    if (state.spiders.length >= MAX_SPIDERS) return;
    const playerTx = Math.floor((state.player.x + state.player.w / 2) / TILE);
    const playerTy = Math.floor((state.player.y + state.player.h / 2) / TILE);

    for (let attempt = 0; attempt < 60; attempt += 1) {
      const tx = clamp(playerTx + Math.floor(rand(-22, 23)), 2, WORLD_W - 3);
      const ty = clamp(playerTy + Math.floor(rand(-14, 15)), 12, state.world.length - 4);
      if (!getLocationInfo(state, tx, ty).inCave && !isMineLike(state, tx, ty)) continue;
      if (isLitAt(state, tx, ty)) continue;
      if (getBlock(state, tx, ty) !== BLOCK.AIR) continue;
      if (!blockSolid(getBlock(state, tx, ty + 1))) continue;
      if (Math.hypot(tx * TILE - state.player.x, ty * TILE - state.player.y) < 110) continue;
      state.spiders.push(createSpider(tx, ty));
      return;
    }
  }

  function spawnSpiderRaidNearDwarves(state) {
    if (state.spiders.length >= MAX_SPIDERS || !state.dwarfColony || !state.dwarfColony.settlements.length) return;
    const settlement = state.dwarfColony.settlements[Math.floor(rand(0, state.dwarfColony.settlements.length))];
    const hall = (state.dwarfColony.halls || []).find((entry) => entry.settlementId === settlement.id);
    if (!hall) return;
    const dir = Math.random() < 0.5 ? -1 : 1;
    for (let group = 0; group < 2; group += 1) {
      const tx = clamp(hall.x + dir * Math.floor(rand(hall.halfW + 7, hall.halfW + 13)) + group * dir, 2, WORLD_W - 3);
      const ty = clamp(hall.y + hall.halfH - 1 + Math.floor(rand(-1, 2)), 12, state.world.length - 4);
      if (isLitAt(state, tx, ty)) continue;
      if (getBlock(state, tx, ty) !== BLOCK.AIR) continue;
      if (!blockSolid(getBlock(state, tx, ty + 1))) continue;
      state.spiders.push(createSpider(tx, ty));
      if (state.spiders.length >= MAX_SPIDERS) return;
    }
  }

  function spawnSpiderRaidNearHumans(state) {
    if (state.spiders.length >= MAX_SPIDERS || !state.humanSettlements || !state.humanSettlements.villages.length) return;
    const village = state.humanSettlements.villages[Math.floor(rand(0, state.humanSettlements.villages.length))];
    const dir = Math.random() < 0.5 ? -1 : 1;
    const tx = clamp((dir < 0 ? village.bounds.x0 : village.bounds.x1) + dir * Math.floor(rand(4, 8)), 2, WORLD_W - 3);
    const ty = state.surfaceAt[tx] - 1;
    if (isLitAt(state, tx, ty)) return;
    if (getBlock(state, tx, ty) !== BLOCK.AIR) return;
    if (!blockSolid(getBlock(state, tx, ty + 1))) return;
    state.spiders.push(createSpider(tx, ty));
  }

  function updateSpiders(state, dt) {
    const creative = isCreative(state);
    const phase = phaseInfo(state).phase;
    if (phase === 'night') {
      state.spiderSpawnTick += dt;
      if (state.spiderSpawnTick >= 5) {
        state.spiderSpawnTick = 0;
        spawnSpiderOnSurface(state);
      }
    } else {
      state.spiderSpawnTick = 0;
    }

    state.spiderCaveSpawnTick += dt;
    if (state.spiderCaveSpawnTick >= 5.2) {
      state.spiderCaveSpawnTick = 0;
      spawnSpiderInCave(state);
      if (Math.random() < 0.34) spawnSpiderRaidNearDwarves(state);
      if (Math.random() < 0.24) spawnSpiderRaidNearHumans(state);
    }

    for (let i = state.spiders.length - 1; i >= 0; i -= 1) {
      const spider = state.spiders[i];
      ensureMobState(spider);
      spider.jumpCd = Math.max(0, (spider.jumpCd || 0) - dt);
      spider.obstacleTimer = spider.obstacleTimer || 0;
      const dx = state.player.x - spider.x;
      const dy = state.player.y - spider.y;
      let target = null;
      let targetIsPlayer = false;
      let distance = Infinity;
      if (!creative) {
        target = state.player;
        targetIsPlayer = true;
        distance = Math.hypot(dx, dy);
      }
      for (const dwarf of state.dwarves || []) {
        const dist = Math.hypot(dwarf.x - spider.x, dwarf.y - spider.y);
        if (dist < distance) {
          target = dwarf;
          targetIsPlayer = false;
          distance = dist;
        }
      }
      for (const human of state.humans || []) {
        const dist = Math.hypot(human.x - spider.x, human.y - spider.y);
        if (dist < distance) {
          target = human;
          targetIsPlayer = false;
          distance = dist;
        }
      }
      updateMobMediumState(state, spider);

      spider.moveTimer -= dt;
      spider.attackCd -= dt;

      if (spider.inWater) {
        spider.dir = getWaterEscapeDir(state, spider, spider.dir);
        spider.vx = spider.dir * 88;
        spider.vy = -230;
        spider.obstacleTimer = 0;
      } else {
        const chasing = !!target && distance < 170;
        if (chasing) {
          spider.dir = target.x < spider.x ? -1 : 1;
          spider.vx = spider.dir * 95;
        } else {
          if (spider.moveTimer <= 0) {
            spider.moveTimer = rand(0.8, 2);
            spider.dir = Math.random() < 0.5 ? -1 : 1;
          }
          spider.vx = spider.dir * 36;
        }
      }

      const frontX = spider.x + (spider.dir > 0 ? spider.w + 1 : -1);
      const txFront = Math.floor(frontX / TILE);
      const tyFeet = Math.floor((spider.y + spider.h) / TILE);
      const aheadBlock = getBlock(state, txFront, tyFeet - 1);
      const groundAhead = getBlock(state, txFront, tyFeet);

      const wasOnGround = spider.onGround;
      const preMoveVy = spider.vy;
      if (!spider.inWater) {
        if (blockSolid(aheadBlock) && blockSolid(groundAhead) && spider.onGround) spider.obstacleTimer += dt;
        else spider.obstacleTimer = 0;
        spider.vy += GRAVITY * dt;
        if (spider.onGround && spider.jumpCd <= 0 && spider.obstacleTimer > 0.12) {
          spider.vy = -250;
          spider.jumpCd = distance < 170 ? 0.55 : 0.95;
          spider.obstacleTimer = 0;
        }
      }
      moveEntity(state, spider, dt);
      applyMobEnvironmentDamage(state, spider, dt, wasOnGround, preMoveVy);

      if (targetIsPlayer && !creative && aabb(spider.x, spider.y, spider.w, spider.h, state.player.x, state.player.y, state.player.w, state.player.h) && spider.attackCd <= 0) {
        spider.attackCd = 0.9;
        state.player.health = Math.max(0, state.player.health - 1);
        state.attackFlash = 0.18;
        if (state.player.health <= 0) state.gameOver = true;
      } else if (!targetIsPlayer && target && aabb(spider.x, spider.y, spider.w, spider.h, target.x, target.y, target.w, target.h) && spider.attackCd <= 0) {
        spider.attackCd = 0.95;
        target.hp -= 1;
      }

      if (spider.hp <= 0) state.spiders.splice(i, 1);
    }
  }

  Game.spidersEntity = { updateSpiders, spawnSpiderOnSurface, spawnSpiderInCave, createSpider };
})();
