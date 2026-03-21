(() => {
  const Game = window.MC2D;
  const { TILE, GRAVITY, WORLD_W } = Game.constants;
  const { aabb, rand, clamp } = Game.math;
  const { getBlock, blockSolid, getLocationInfo } = Game.world;
  const { moveEntity } = Game.physics;
  const { BLOCK } = Game.blocks;
  const { phaseInfo } = Game.dayCycle;

  const MAX_SPIDERS = 14;

  function createSpider(tx, ty) {
    return {
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
    };
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
      if (!getLocationInfo(state, tx, ty).inCave) continue;
      if (getBlock(state, tx, ty) !== BLOCK.AIR) continue;
      if (!blockSolid(getBlock(state, tx, ty + 1))) continue;
      if (Math.hypot(tx * TILE - state.player.x, ty * TILE - state.player.y) < 110) continue;
      state.spiders.push(createSpider(tx, ty));
      return;
    }
  }

  function updateSpiders(state, dt) {
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
    if (state.spiderCaveSpawnTick >= 6.5) {
      state.spiderCaveSpawnTick = 0;
      spawnSpiderInCave(state);
    }

    for (let i = state.spiders.length - 1; i >= 0; i -= 1) {
      const spider = state.spiders[i];
      const dx = state.player.x - spider.x;
      const dy = state.player.y - spider.y;
      const distance = Math.hypot(dx, dy);

      spider.moveTimer -= dt;
      spider.attackCd -= dt;

      const chasing = distance < 170;
      if (chasing) {
        spider.dir = dx < 0 ? -1 : 1;
        spider.vx = spider.dir * 95;
      } else {
        if (spider.moveTimer <= 0) {
          spider.moveTimer = rand(0.8, 2);
          spider.dir = Math.random() < 0.5 ? -1 : 1;
        }
        spider.vx = spider.dir * 36;
      }

      const frontX = spider.x + (spider.dir > 0 ? spider.w + 1 : -1);
      const txFront = Math.floor(frontX / TILE);
      const tyFeet = Math.floor((spider.y + spider.h) / TILE);
      const aheadBlock = getBlock(state, txFront, tyFeet - 1);
      const groundAhead = getBlock(state, txFront, tyFeet);

      spider.vy += GRAVITY * dt;
      if ((blockSolid(aheadBlock) || !blockSolid(groundAhead)) && spider.onGround) spider.vy = -280;

      moveEntity(state, spider, dt);

      if (aabb(spider.x, spider.y, spider.w, spider.h, state.player.x, state.player.y, state.player.w, state.player.h) && spider.attackCd <= 0) {
        spider.attackCd = 0.9;
        state.player.health = Math.max(0, state.player.health - 1);
        state.attackFlash = 0.18;
        if (state.player.health <= 0) state.gameOver = true;
      }

      if (spider.hp <= 0) state.spiders.splice(i, 1);
    }
  }

  Game.spidersEntity = { updateSpiders, spawnSpiderOnSurface, spawnSpiderInCave, createSpider };
})();
