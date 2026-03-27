(() => {
  const Game = window.MC2D;
  const { TILE, GRAVITY } = Game.constants;
  const { aabb } = Game.math;
  const { moveEntity } = Game.physics;
  const { getBlock, setBlock } = Game.world;
  const { BLOCK } = Game.blocks;
  const { ITEM } = Game.items;
  const { applyPlayerDamage } = Game.combat;
  const { getAttackDamage } = Game.tools;
  const { selectedToolId } = Game.inventory;

  function spawnGuardNearKing(state, king, offsetTiles) {
    const tx = Math.floor((king.x + king.w / 2) / TILE) + offsetTiles;
    const walkFloor = king.castleBaseY - 3;
    state.fireGuards.push({
      x: tx * TILE + 1,
      y: (walkFloor - 2) * TILE,
      w: 14,
      h: 24,
      vx: 0,
      vy: 0,
      onGround: false,
      hp: 50,
      maxHp: 50,
      dir: offsetTiles < 0 ? 1 : -1,
      attackCd: 0,
      jumpCd: 0,
      obstacleTimer: 0,
      patrolTimer: 2,
    });
  }

  function applyKingContactDamage(state, king, damage = 4) {
    if (!aabb(king.x, king.y, king.w, king.h, state.player.x, state.player.y, state.player.w, state.player.h)) return;
    applyPlayerDamage(state, damage, { flash: 0.32 });
  }

  function breakableByKing(id) {
    return id === BLOCK.BLACKSTONE || id === BLOCK.BASALT || id === BLOCK.RED_EARTH;
  }

  function blastAroundKing(state, king) {
    const cx = Math.floor((king.x + king.w / 2) / TILE);
    const cy = Math.floor((king.y + king.h / 2) / TILE);
    const floorTy = Math.floor((king.y + king.h) / TILE);
    for (let ty = cy - 5; ty <= cy + 4; ty += 1) {
      for (let tx = cx - 6; tx <= cx + 6; tx += 1) {
        if (ty >= floorTy) continue;
        const dx = tx - cx;
        const dy = ty - cy;
        if (dx * dx + dy * dy > 34) continue;
        const block = getBlock(state, tx, ty);
        if (breakableByKing(block)) setBlock(state, tx, ty, BLOCK.AIR);
      }
    }
    state.attackFlash = Math.max(state.attackFlash, 0.24);
  }

  function updateFireKing(state, dt) {
    if (state.activeDimension !== 'fire' || !state.fireKing) return;
    const king = state.fireKing;
    const playerCx = state.player.x + state.player.w / 2;
    const playerCy = state.player.y + state.player.h / 2;
    const kingCx = king.x + king.w / 2;
    const kingCy = king.y + king.h / 2;
    const dx = playerCx - kingCx;
    const dy = playerCy - kingCy;
    const dist = Math.hypot(dx, dy);

    if (!king.awakened && dist < 260) king.awakened = true;
    if (!king.awakened) return;

    king.attackCd = Math.max(0, (king.attackCd || 0) - dt);
    king.phaseTimer = Math.max(0, (king.phaseTimer || 0) - dt);

    if (king.summonStage === 0 && king.hp <= 70) {
      spawnGuardNearKing(state, king, -8);
      spawnGuardNearKing(state, king, 8);
      king.summonStage = 1;
    } else if (king.summonStage === 1 && king.hp <= 35) {
      spawnGuardNearKing(state, king, -12);
      spawnGuardNearKing(state, king, 12);
      king.summonStage = 2;
    }

    const arenaLeft = (king.castleCenterX - 11) * TILE;
    const arenaRight = (king.castleCenterX + 11) * TILE - king.w;

    if (king.phase === 'eruption') {
      king.vx = 0;
      if (!king.erupted) {
        blastAroundKing(state, king);
        if (Math.abs(dx) < 156 && Math.abs(dy) < 120) applyPlayerDamage(state, 7, { flash: 0.45 });
        king.erupted = true;
      }
      if (king.phaseTimer <= 0) {
        king.phase = 'dash';
        king.phaseTimer = 0.95;
        king.erupted = false;
      }
    } else if (king.phase === 'slam') {
      king.vx = 0;
      if (king.phaseTimer <= 0) {
        if (Math.abs(dx) < 128 && Math.abs(dy) < 96) applyPlayerDamage(state, 6, { flash: 0.38 });
        king.phase = 'idle';
        king.attackCd = 2.2;
        state.attackFlash = Math.max(state.attackFlash, 0.18);
      }
    } else if (king.phase === 'cast') {
      king.vx = 0;
      if (king.phaseTimer <= 0) {
        const inFront = king.dir > 0 ? dx > 0 : dx < 0;
        if (inFront && Math.abs(dx) < 220 && Math.abs(dy) < 100) applyPlayerDamage(state, 5, { flash: 0.34 });
        king.phase = 'idle';
        king.attackCd = 2.8;
      }
    } else if (king.phase === 'dash') {
      king.vx = king.dir * 170;
      applyKingContactDamage(state, king, 5);
      if (king.phaseTimer <= 0) {
        king.phase = 'idle';
        king.vx = 0;
        king.attackCd = 2.4;
      }
    } else {
      if (Math.abs(dx) > 10) king.dir = dx < 0 ? -1 : 1;

      if (king.attackCd <= 0) {
        if (dist < 180) {
          king.phase = 'eruption';
          king.phaseTimer = 0.45;
          king.vx = 0;
          king.erupted = false;
        } else if (dist < 110) {
          king.phase = 'slam';
          king.phaseTimer = 0.55;
          king.vx = 0;
        } else if (dist < 230 && Math.random() < 0.48) {
          king.phase = 'cast';
          king.phaseTimer = 0.7;
          king.vx = 0;
        } else {
          king.phase = 'dash';
          king.phaseTimer = 0.6;
        }
      } else {
        const desired = Math.abs(dx) > 78 ? king.dir * 34 : 0;
        king.vx = desired;
      }
    }

    king.vy += GRAVITY * dt;
    king.stepUpHeight = TILE;
    moveEntity(state, king, dt);
    king.stepUpHeight = 0;
    if (king.x < arenaLeft) {
      king.x = arenaLeft;
      king.vx = Math.max(0, king.vx);
      king.dir = 1;
    } else if (king.x > arenaRight) {
      king.x = arenaRight;
      king.vx = Math.min(0, king.vx);
      king.dir = -1;
    }

    const centerTx = Math.floor((king.x + king.w / 2) / TILE);
    const feetTy = Math.floor((king.y + king.h - 2) / TILE);
    const feetBlock = getBlock(state, centerTx, feetTy);
    if (feetBlock === BLOCK.LAVA) king.vy = Math.min(king.vy, 80);

    if (king.phase !== 'dash' && king.attackCd > 0) applyKingContactDamage(state, king, 4);
    if (king.hp <= 0) {
      state.foods.push({
        x: king.x + king.w / 2 - 5,
        y: king.y + king.h / 2 - 5,
        w: 10,
        h: 10,
        itemId: ITEM.FIRE_DUNGEON_KEY,
        amount: 1,
        durability: null,
        t: 0,
      });
      state.fireKing = null;
    }
  }

  function hitFireKing(state) {
    if (!state.fireKing) return false;
    state.fireKing.hp -= getAttackDamage(selectedToolId(state));
    state.fireKing.awakened = true;
    return true;
  }

  Game.fireKingEntity = { updateFireKing, hitFireKing };
})();
