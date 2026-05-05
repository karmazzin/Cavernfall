(() => {
  const Game = window.MC2D;
  const { clamp } = Game.math;
  const { selectedToolId } = Game.inventory;
  const { getAttackDamage } = Game.tools;
  const { BLOCK } = Game.blocks;
  const { setBlock } = Game.world;
  const { applyPlayerDamage } = Game.combat;

  function hitAirGuardian(state) {
    const guardian = state.airGuardian;
    if (!guardian) return false;
    if (!state.player.steamForm) {
      state.ui.noticeText = 'Страж воздуха уязвим только для облака пара.';
      state.ui.noticeTimer = 3;
      return false;
    }
    guardian.hp -= getAttackDamage(selectedToolId(state));
    return true;
  }

  function updateAirGuardian(state, dt) {
    const guardian = state.airGuardian;
    if (!guardian) return;
    if (state.worldMeta && state.worldMeta.mode === 'mobile') return;
    const arena = guardian.arena;
    const playerCx = state.player.x + state.player.w / 2;
    const playerCy = state.player.y + state.player.h / 2;
    const guardianCx = guardian.x + guardian.w / 2;
    const guardianCy = guardian.y + guardian.h / 2;
    const dx = playerCx - guardianCx;
    const dy = playerCy - guardianCy;
    const dist = Math.max(1, Math.hypot(dx, dy));
    guardian.phaseTimer = (guardian.phaseTimer || 0) + dt;
    guardian.dir = dx < 0 ? -1 : 1;
    const orbit = guardian.phaseTimer;
    const speed = dist > 150 ? 210 : 138;
    guardian.vx = (dx / dist) * speed + Math.sin(orbit * 2.6) * 48;
    guardian.vy = (dy / dist) * speed * 0.65 + Math.cos(orbit * 3.4) * 52;
    guardian.x += guardian.vx * dt;
    guardian.y += guardian.vy * dt;
    guardian.x = clamp(guardian.x, arena.x0, arena.x1 - guardian.w);
    guardian.y = clamp(guardian.y, arena.y0, arena.y1 - guardian.h);
    guardian.attackCooldown = Math.max(0, (guardian.attackCooldown || 0) - dt);

    const overlapX = Math.abs((guardian.x + guardian.w / 2) - playerCx) < (guardian.w + state.player.w) * 0.45;
    const overlapY = Math.abs((guardian.y + guardian.h / 2) - playerCy) < (guardian.h + state.player.h) * 0.45;
    if (state.player.steamForm && guardian.attackCooldown <= 0 && overlapX && overlapY) {
      applyPlayerDamage(state, 4, { flash: 0.22, ignoreArmor: true, allowSteamDamage: true });
      guardian.attackCooldown = 0.55;
    }

    if (guardian.hp <= 0) {
      const entrance = state.airCaves && state.airCaves.entrance;
      if (entrance) {
        entrance.guardianDefeated = true;
        setBlock(state, entrance.portalX, entrance.portalY, BLOCK.AIR_DIMENSION_PORTAL);
      }
      state.ui.noticeText = 'Страж воздуха повержен. Портал в воздушное измерение появился.';
      state.ui.noticeTimer = 4.5;
      state.airGuardian = null;
    }
  }

  Game.airGuardianEntity = { updateAirGuardian, hitAirGuardian };
})();
