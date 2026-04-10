(() => {
  const Game = window.MC2D;
  const { TILE } = Game.constants;
  const { clamp, aabb } = Game.math;
  const { applyPlayerDamage } = Game.combat;
  const { addToInventory, selectedToolId } = Game.inventory;
  const { getAttackDamage } = Game.tools;

  function hitKraken(state) {
    if (!state.kraken) return false;
    state.kraken.hp -= getAttackDamage(selectedToolId(state));
    return true;
  }

  function updateKraken(state, dt) {
    const kraken = state.kraken;
    if (!kraken) return;
    const arena = kraken.arena;
    const playerCx = state.player.x + state.player.w / 2;
    const playerCy = state.player.y + state.player.h / 2;
    const krakenCx = kraken.x + kraken.w / 2;
    const krakenCy = kraken.y + kraken.h / 2;
    const dx = playerCx - krakenCx;
    const dy = playerCy - krakenCy;
    const dist = Math.hypot(dx, dy);

    kraken.attackCd = Math.max(0, (kraken.attackCd || 0) - dt);
    kraken.phaseTimer = Math.max(0, (kraken.phaseTimer || 0) - dt);
    kraken.dir = dx < 0 ? -1 : 1;

    if (kraken.phase === 'dash') {
      kraken.x += kraken.vx * dt;
      kraken.y += kraken.vy * dt;
      if (aabb(kraken.x, kraken.y, kraken.w, kraken.h, state.player.x, state.player.y, state.player.w, state.player.h) && kraken.attackCd <= 0) {
        kraken.attackCd = 0.55;
        applyPlayerDamage(state, 8, { flash: 0.32 });
      }
      if (kraken.phaseTimer <= 0) {
        kraken.phase = 'idle';
        kraken.vx = 0;
        kraken.vy = 0;
        kraken.attackCd = 1.2;
      }
    } else if (kraken.phase === 'slam') {
      kraken.vx = 0;
      kraken.vy = Math.sin(performance.now() / 90) * 18;
      if (kraken.phaseTimer <= 0) {
        if (dist < 132) applyPlayerDamage(state, 10, { flash: 0.35 });
        state.attackFlash = Math.max(state.attackFlash || 0, 0.22);
        kraken.phase = 'idle';
        kraken.attackCd = 1.6;
      }
    } else if (kraken.phase === 'whirlpool') {
      kraken.vx = 0;
      kraken.vy = Math.sin(performance.now() / 120) * 12;
      if (dist < 220) {
        const pull = Math.max(0.12, 1 - dist / 220) * 210 * dt;
        state.player.x += Math.sign(dx) * pull;
        state.player.y += Math.sign(dy) * pull * 0.7;
        if (dist < 78 && kraken.attackCd <= 0) {
          kraken.attackCd = 0.35;
          applyPlayerDamage(state, 5, { flash: 0.22 });
        }
      }
      if (kraken.phaseTimer <= 0) {
        kraken.phase = 'idle';
        kraken.attackCd = 1.4;
      }
    } else {
      const speed = dist > 120 ? 140 : 86;
      kraken.vx = Math.sign(dx || 1) * speed;
      kraken.vy = clamp(dy * 1.15, -120, 120);
      kraken.x += kraken.vx * dt;
      kraken.y += kraken.vy * dt;
      if (aabb(kraken.x, kraken.y, kraken.w, kraken.h, state.player.x, state.player.y, state.player.w, state.player.h) && kraken.attackCd <= 0) {
        kraken.attackCd = 0.65;
        applyPlayerDamage(state, 6, { flash: 0.24 });
      }
      if (kraken.attackCd <= 0) {
        if (dist > 130 && Math.random() < 0.44) {
          kraken.phase = 'dash';
          kraken.phaseTimer = 0.7;
          const len = Math.max(1, dist);
          kraken.vx = (dx / len) * 260;
          kraken.vy = (dy / len) * 220;
        } else if (dist < 110) {
          kraken.phase = 'slam';
          kraken.phaseTimer = 0.55;
        } else {
          kraken.phase = 'whirlpool';
          kraken.phaseTimer = 1.15;
          kraken.attackCd = 0.3;
        }
      }
    }

    kraken.x = clamp(kraken.x, arena.x0, arena.x1 - kraken.w);
    kraken.y = clamp(kraken.y, arena.y0, arena.y1 - kraken.h);

    if (kraken.hp <= 0) {
      addToInventory(state, Game.blocks.BLOCK.WATER_CRYSTAL, 1);
      if (state.waterCaves) state.waterCaves.krakenDefeated = true;
      state.ui.noticeText = 'Кракен повержен. Кристалл воды возвращён.';
      state.ui.noticeTimer = 4.5;
      state.kraken = null;
    }
  }

  Game.krakenEntity = { updateKraken, hitKraken };
})();
