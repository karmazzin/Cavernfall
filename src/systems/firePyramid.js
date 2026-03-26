(() => {
  const Game = window.MC2D;
  const { TILE, DAY } = Game.constants;
  const { BLOCK } = Game.blocks;
  const { ITEM } = Game.items;
  const { getBlock, setBlock } = Game.world;
  const { moveEntity } = Game.physics;
  const { aabb, clamp } = Game.math;
  const { getAttackDamage } = Game.tools;
  const { selectedToolId } = Game.inventory;
  const { applyPlayerDamage } = Game.combat;

  function getRitual(state) {
    if (!state.firePyramid) return null;
    if (!state.firePyramid.ritual) {
      state.firePyramid.ritual = {
        active: false,
        phase: 'idle',
        timer: 0,
        clearedToY: state.firePyramid.lavaY,
        noonTriggered: false,
        completed: false,
        bossSpawned: false,
        portalCreated: false,
      };
    }
    return state.firePyramid.ritual;
  }

  function tryActivateFirePyramid(state, food) {
    const pyramid = state.firePyramid;
    const ritual = getRitual(state);
    if (!pyramid || !ritual || ritual.completed || ritual.active) return false;
    if (!food || food.itemId !== ITEM.FIRE_CRYSTAL) return false;
    const tx = Math.floor((food.x + food.w / 2) / TILE);
    const ty = Math.floor((food.y + food.h / 2) / TILE);
    if (tx !== pyramid.lavaX || ty !== pyramid.lavaY) return false;
    if (getBlock(state, pyramid.lavaX, pyramid.lavaY) !== BLOCK.LAVA) return false;

    ritual.active = true;
    ritual.phase = 'beam_rise';
    ritual.timer = 0;
    ritual.clearedToY = pyramid.lavaY;
    ritual.noonTriggered = false;
    return true;
  }

  function clearBeamColumn(state, topY) {
    const pyramid = state.firePyramid;
    const ritual = getRitual(state);
    if (!pyramid || !ritual) return;
    const x0 = pyramid.lavaX - 1;
    const x1 = pyramid.lavaX + 1;
    for (let ty = ritual.clearedToY - 1; ty >= topY; ty -= 1) {
      for (let tx = x0; tx <= x1; tx += 1) {
        const block = getBlock(state, tx, ty);
        if (block === BLOCK.BEDROCK || block === BLOCK.FIRE_SEAL) continue;
        setBlock(state, tx, ty, BLOCK.AIR);
      }
    }
    ritual.clearedToY = Math.min(ritual.clearedToY, topY);
  }

  function spawnFireBoss(state) {
    const pyramid = state.firePyramid;
    const ritual = getRitual(state);
    if (!pyramid || !ritual || ritual.bossSpawned || state.fireBoss) return;
    state.fireBoss = {
      x: pyramid.centerX * TILE - 15,
      y: (pyramid.baseY - 6) * TILE,
      w: 30,
      h: 42,
      vx: 0,
      vy: 0,
      onGround: false,
      hp: 70,
      maxHp: 70,
      attackCd: 0,
      dir: 1,
      phase: 'idle',
      arenaX: pyramid.centerX,
      isBoss: true,
      name: 'Огненный страж',
    };
    ritual.bossSpawned = true;
  }

  function createPortal(state, x, y) {
    const pyramid = state.firePyramid;
    const ritual = getRitual(state);
    const tx = Math.floor((x + 15) / TILE);
    const ty = Math.floor((y + 30) / TILE);
    setBlock(state, tx, ty, BLOCK.FIRE_PORTAL);
    if (ritual) ritual.portalCreated = true;
    if (pyramid) {
      pyramid.portalX = tx;
      pyramid.portalY = ty;
    }
  }

  function updateFirePyramid(state, dt) {
    const pyramid = state.firePyramid;
    const ritual = getRitual(state);
    if (!pyramid || !ritual) return;

    if (ritual.active) {
      ritual.timer += dt;
      if (!ritual.noonTriggered) {
        state.cycleTime = DAY / 2;
        ritual.noonTriggered = true;
      }

      if (ritual.phase === 'beam_rise') {
        const progress = clamp(ritual.timer / 1.6, 0, 1);
        const topY = Math.floor(pyramid.lavaY * (1 - progress));
        clearBeamColumn(state, topY);
        if (ritual.timer >= 1.6) {
          ritual.phase = 'beam_hold';
          ritual.timer = 0;
        }
      } else if (ritual.phase === 'beam_hold') {
        clearBeamColumn(state, 0);
        if (ritual.timer >= 1.1) {
          ritual.phase = 'beam_fade';
          ritual.timer = 0;
        }
      } else if (ritual.phase === 'beam_fade') {
        if (ritual.timer >= 0.9) {
          ritual.active = false;
          ritual.phase = 'done';
          ritual.timer = 0;
          ritual.completed = true;
          spawnFireBoss(state);
        }
      }
    }

    const boss = state.fireBoss;
    if (!boss) return;

    boss.attackCd = Math.max(0, (boss.attackCd || 0) - dt);
    const dx = (state.player.x + state.player.w / 2) - (boss.x + boss.w / 2);
    boss.vx = Math.abs(dx) > 4 ? Math.sign(dx) * 92 : 0;
    if (boss.vx !== 0) boss.dir = boss.vx < 0 ? -1 : 1;
    boss.vy += 1500 * dt;
    boss.stepUpHeight = TILE;
    moveEntity(state, boss, dt);
    boss.stepUpHeight = 0;

    if (aabb(boss.x, boss.y, boss.w, boss.h, state.player.x, state.player.y, state.player.w, state.player.h) && boss.attackCd <= 0) {
      boss.attackCd = 0.85;
      applyPlayerDamage(state, 2, { flash: 0.25 });
    }

    if (boss.hp <= 0) {
      createPortal(state, boss.x, boss.y);
      state.fireBoss = null;
    }
  }

  function hitFireBoss(state) {
    if (!state.fireBoss) return false;
    const boss = state.fireBoss;
    boss.hp -= getAttackDamage(selectedToolId(state));
    return true;
  }

  Game.firePyramidSystem = { tryActivateFirePyramid, updateFirePyramid, hitFireBoss };
})();
