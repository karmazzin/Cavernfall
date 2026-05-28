(() => {
  const Game = window.MC2D;
  const { TILE } = Game.constants;
  const { clamp, aabb } = Game.math;
  const { applyPlayerDamage } = Game.combat;
  const { selectedToolId } = Game.inventory;
  const { getAttackDamage } = Game.tools;
  const { isPlayerUndetectable } = Game.invisibilitySystem || {};

  function hitEvilTrunk(state) {
    if (!state.evilTrunk) return false;
    state.evilTrunk.hp -= getAttackDamage(selectedToolId(state));
    return true;
  }

  function lockSummit(state) {
    const meta = state.endWorldMeta;
    if (!meta || !meta.summit || meta.bossDefeated) return;
    const playerTopTy = Math.floor(state.player.y / TILE);
    if (playerTopTy > meta.summit.lockY) return;
    state.player.x = meta.spawnX * TILE + 2;
    state.player.y = meta.spawnY * TILE;
    state.player.vx = 0;
    state.player.vy = 0;
    state.ui.noticeText = 'Пока Злой ствол жив, вершина недоступна.';
    state.ui.noticeTimer = 3.5;
  }

  function updateEvilTrunk(state, dt) {
    if (state.activeDimension === 'end') lockSummit(state);
    const trunk = state.evilTrunk;
    if (!trunk) return;
    if (state.worldMeta && state.worldMeta.mode === 'mobile') return;
    if (isPlayerUndetectable && isPlayerUndetectable(state)) return;
    const player = state.player;
    const arena = trunk.arena;
    const playerCx = player.x + player.w / 2;
    const playerCy = player.y + player.h / 2;
    const trunkCx = trunk.x + trunk.w / 2;
    const trunkCy = trunk.y + trunk.h / 2;
    const dx = playerCx - trunkCx;
    const dy = playerCy - trunkCy;
    const dist = Math.max(1, Math.hypot(dx, dy));
    trunk.phaseTimer = (trunk.phaseTimer || 0) + dt;
    trunk.attackCooldown = Math.max(0, (trunk.attackCooldown || 0) - dt);
    trunk.dir = dx < 0 ? -1 : 1;
    const rage = trunk.hp <= trunk.maxHp * 0.5 ? 1.28 : 1;
    const wave = Math.sin(trunk.phaseTimer * 2.3) * 34;
    const dive = Math.cos(trunk.phaseTimer * 3.1) * 40;
    trunk.vx = (dx / dist) * 118 * rage + wave;
    trunk.vy = (dy / dist) * 94 * rage + dive;
    trunk.x += trunk.vx * dt;
    trunk.y += trunk.vy * dt;
    if (arena) {
      trunk.x = clamp(trunk.x, arena.x0, arena.x1 - trunk.w);
      trunk.y = clamp(trunk.y, arena.y0, arena.y1 - trunk.h);
    }
    if (aabb(trunk.x, trunk.y, trunk.w, trunk.h, player.x, player.y, player.w, player.h) && trunk.attackCooldown <= 0) {
      applyPlayerDamage(state, 7, { flash: 0.32 });
      trunk.attackCooldown = 0.42;
    }
    if (trunk.hp <= 0) {
      if (state.endWorldMeta) state.endWorldMeta.bossDefeated = true;
      state.ui.noticeText = 'Злой ствол повержен. Путь к вершине открыт.';
      state.ui.noticeTimer = 4.5;
      state.evilTrunk = null;
    }
  }

  Game.evilTrunkEntity = { updateEvilTrunk, hitEvilTrunk };
})();
