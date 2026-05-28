(() => {
  const Game = window.MC2D;
  const { clamp } = Game.math;
  const { applyPlayerDamage } = Game.combat;
  const { ensureChestAt } = Game.chestSystem;
  const { createItemStack } = Game.inventory;
  const { ITEM } = Game.items;
  const { BLOCK } = Game.blocks;
  const { setBlock } = Game.world;
  const { isPlayerUndetectable } = Game.invisibilitySystem || {};

  function createAirThief(tx, ty, arena = null) {
    return {
      x: tx * 16 - 14,
      y: ty * 16 - 28,
      w: 28,
      h: 40,
      hp: 550,
      maxHp: 550,
      vx: 0,
      vy: 0,
      dir: 1,
      phaseTimer: 0,
      attackCooldown: 0,
      isBoss: true,
      name: 'Воздушный вор',
      arena,
    };
  }

  function hitAirThief(state) {
    const thief = state.airThief;
    if (!thief) return false;
    const damage = Game.tools.getAttackDamage(Game.inventory.selectedToolId(state));
    thief.hp -= damage;
    return true;
  }

  function spawnLostWindsChest(state) {
    const meta = state.airWorldMeta;
    const refuge = meta && meta.thiefRefuge;
    if (!refuge || refuge.chestSpawned) return;
    setBlock(state, refuge.chestX, refuge.chestY, BLOCK.CHEST);
    const chest = ensureChestAt(state, refuge.chestX, refuge.chestY, null);
    chest.slots[0] = createItemStack(ITEM.LOST_WIND, 5);
    refuge.chestSpawned = true;
  }

  function updateAirThief(state, dt) {
    const thief = state.airThief;
    if (!thief) return;
    if (state.worldMeta && state.worldMeta.mode === 'mobile') return;
    if (isPlayerUndetectable && isPlayerUndetectable(state)) return;
    const arena = thief.arena;
    const player = state.player;
    const playerCx = player.x + player.w / 2;
    const playerCy = player.y + player.h / 2;
    const thiefCx = thief.x + thief.w / 2;
    const thiefCy = thief.y + thief.h / 2;
    const dx = playerCx - thiefCx;
    const dy = playerCy - thiefCy;
    const dist = Math.max(1, Math.hypot(dx, dy));
    thief.phaseTimer += dt;
    thief.dir = dx < 0 ? -1 : 1;
    thief.vx = (dx / dist) * 88 + Math.sin(thief.phaseTimer * 2.2) * 24;
    thief.vy = (dy / dist) * 54 + Math.cos(thief.phaseTimer * 2.8) * 18;
    thief.x += thief.vx * dt;
    thief.y += thief.vy * dt;
    if (arena) {
      thief.x = clamp(thief.x, arena.x0, arena.x1 - thief.w);
      thief.y = clamp(thief.y, arena.y0, arena.y1 - thief.h);
      player.x = clamp(player.x, arena.x0 + 4, arena.x1 - player.w - 4);
      player.y = clamp(player.y, arena.y0 + 4, arena.y1 - player.h - 4);
    }
    thief.attackCooldown = Math.max(0, (thief.attackCooldown || 0) - dt);
    const overlapX = Math.abs((thief.x + thief.w / 2) - playerCx) < (thief.w + player.w) * 0.45;
    const overlapY = Math.abs((thief.y + thief.h / 2) - playerCy) < (thief.h + player.h) * 0.45;
    if (thief.attackCooldown <= 0 && overlapX && overlapY) {
      applyPlayerDamage(state, 3, { flash: 0.18 });
      thief.attackCooldown = 0.65;
    }

    if (thief.hp <= 0) {
      const meta = state.airWorldMeta;
      if (meta && meta.thiefRefuge) {
        meta.thiefRefuge.cleared = true;
        meta.thiefBossDefeated = true;
      }
      spawnLostWindsChest(state);
      state.ui.noticeText = 'Воздушный вор повержен. В укрытии появился сундук с потерянными ветрами.';
      state.ui.noticeTimer = 5;
      state.airThief = null;
    }
  }

  Game.airThiefEntity = { createAirThief, updateAirThief, hitAirThief };
})();
