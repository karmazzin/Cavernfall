(() => {
  const Game = window.MC2D;
  const { clamp, aabb } = Game.math;
  const { applyPlayerDamage } = Game.combat;
  const { selectedToolId } = Game.inventory;
  const { getAttackDamage } = Game.tools;

  function hitGoldenFlowerGuardian(state) {
    if (!state.goldenFlowerGuardian) return false;
    state.goldenFlowerGuardian.hp -= getAttackDamage(selectedToolId(state));
    return true;
  }

  function updateGoldenFlowerGuardian(state, dt) {
    const guardian = state.goldenFlowerGuardian;
    if (!guardian) return;
    if (state.worldMeta && state.worldMeta.mode === 'mobile') return;
    const arena = guardian.arena;
    const playerCx = state.player.x + state.player.w / 2;
    const playerCy = state.player.y + state.player.h / 2;
    const guardianCx = guardian.x + guardian.w / 2;
    const guardianCy = guardian.y + guardian.h / 2;
    const dx = playerCx - guardianCx;
    const dy = playerCy - guardianCy;
    const dist = Math.hypot(dx, dy);

    guardian.attackCd = Math.max(0, (guardian.attackCd || 0) - dt);
    guardian.phaseTimer = Math.max(0, (guardian.phaseTimer || 0) - dt);
    guardian.dir = dx < 0 ? -1 : 1;

    if (state.player.x < arena.x0) state.player.x = arena.x0;
    if (state.player.x + state.player.w > arena.x1) state.player.x = arena.x1 - state.player.w;

    if (guardian.phase === 'rush') {
      guardian.x += guardian.vx * dt;
      guardian.y += guardian.vy * dt;
      if (aabb(guardian.x, guardian.y, guardian.w, guardian.h, state.player.x, state.player.y, state.player.w, state.player.h) && guardian.attackCd <= 0) {
        guardian.attackCd = 0.5;
        applyPlayerDamage(state, 12, { flash: 0.35 });
      }
      if (guardian.phaseTimer <= 0) {
        guardian.phase = 'idle';
        guardian.vx = 0;
        guardian.vy = 0;
        guardian.attackCd = 1.1;
      }
    } else if (guardian.phase === 'bloom') {
      guardian.vx = 0;
      guardian.vy = Math.sin(performance.now() / 90) * 12;
      if (dist < 120 && guardian.attackCd <= 0) {
        guardian.attackCd = 0.4;
        applyPlayerDamage(state, 7, { flash: 0.2 });
      }
      if (guardian.phaseTimer <= 0) {
        guardian.phase = 'idle';
        guardian.attackCd = 1.5;
      }
    } else {
      const speed = dist > 150 ? 120 : 72;
      guardian.vx = Math.sign(dx || 1) * speed;
      guardian.vy = clamp(dy * 0.8, -80, 80);
      guardian.x += guardian.vx * dt;
      guardian.y += guardian.vy * dt;
      if (aabb(guardian.x, guardian.y, guardian.w, guardian.h, state.player.x, state.player.y, state.player.w, state.player.h) && guardian.attackCd <= 0) {
        guardian.attackCd = 0.7;
        applyPlayerDamage(state, 9, { flash: 0.24 });
      }
      if (guardian.attackCd <= 0) {
        if (dist > 120) {
          guardian.phase = 'rush';
          guardian.phaseTimer = 0.8;
          const len = Math.max(1, dist);
          guardian.vx = (dx / len) * 220;
          guardian.vy = (dy / len) * 160;
        } else {
          guardian.phase = 'bloom';
          guardian.phaseTimer = 1.0;
          guardian.attackCd = 0.35;
        }
      }
    }

    guardian.x = clamp(guardian.x, arena.x0, arena.x1 - guardian.w);
    guardian.y = clamp(guardian.y, arena.y0, arena.y1 - guardian.h);

    if (guardian.hp <= 0) {
      if (state.waterWorldMeta && state.waterWorldMeta.goldenGarden) state.waterWorldMeta.goldenGarden.guardianDefeated = true;
      state.ui.noticeText = 'Страж золотых цветов повержен.';
      state.ui.noticeTimer = 4;
      state.goldenFlowerGuardian = null;
    }
  }

  Game.goldenFlowerGuardianEntity = { updateGoldenFlowerGuardian, hitGoldenFlowerGuardian };
})();
