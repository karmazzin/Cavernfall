(() => {
  const Game = window.MC2D;
  const { phaseInfo } = Game.dayCycle;
  const { ITEM } = Game.items;
  const { countItem } = Game.inventory;
  const { getChestAt } = Game.chestSystem;

  function isNightTime(state) {
    return phaseInfo(state).phase === 'night';
  }

  function updateWindfolk(state, dt) {
    if (state.activeDimension !== 'air' || !Array.isArray(state.windfolk)) return;
    const meta = state.airWorldMeta || {};
    const castle = meta.castle || null;
    const night = isNightTime(state);
    for (const windy of state.windfolk) {
      if (windy.sleeping && !night) windy.sleeping = false;
      if (!windy.chief && night && Number.isFinite(windy.sleepBlockX) && Number.isFinite(windy.sleepBlockY)) {
        windy.sleeping = true;
      }
      if (windy.sleeping) {
        windy.vx = 0;
        windy.vy = 0;
        windy.x = windy.sleepBlockX + 1;
        windy.y = windy.sleepBlockY - windy.h + 10;
        continue;
      }

      if (!windy.steamForm && windy.chestKey) {
        const [tx, ty] = windy.chestKey.split(',').map(Number);
        const chest = getChestAt(state, tx, ty);
        if (chest && Array.isArray(chest.slots)) {
          const slot = chest.slots.find((entry) => entry && entry.id === ITEM.STEAM_AMULET && (entry.count || 0) > 0);
          if (slot) {
            slot.count -= 1;
            if (slot.count <= 0) {
              slot.id = null;
              slot.count = 0;
              slot.durability = null;
            }
            windy.steamForm = true;
          }
        }
      }

      windy.timer = (windy.timer || 0) + dt;
      windy.dirTimer = Math.max(0, (windy.dirTimer || 0) - dt);
      if (windy.dirTimer <= 0) {
        windy.dir = Math.random() < 0.5 ? -1 : 1;
        windy.dirTimer = 1.6 + Math.random() * 2.4;
      }
      const anchorX = Number.isFinite(windy.anchorX) ? windy.anchorX : windy.x;
      const anchorY = Number.isFinite(windy.anchorY) ? windy.anchorY : windy.y;
      windy.x += windy.dir * (windy.steamForm ? 22 : 14) * dt;
      windy.y = anchorY + Math.sin(windy.timer * (windy.steamForm ? 2.6 : 1.9) + windy.anchorPhase) * (windy.steamForm ? 10 : 5);
      if (windy.x < anchorX - 34) windy.dir = 1;
      if (windy.x > anchorX + 34) windy.dir = -1;

      if (windy.chief && castle && !meta.questGiven) {
        const dx = (windy.x + windy.w / 2) - (state.player.x + state.player.w / 2);
        const dy = (windy.y + windy.h / 2) - (state.player.y + state.player.h / 2);
        if (Math.hypot(dx, dy) <= 96) {
          meta.questGiven = true;
          state.ui.noticeText = 'Воздушный король: Помоги мне собрать все потерянные ветра, и я тебе помогу.';
          state.ui.noticeTimer = 6;
        }
      }
    }

    if (meta.startIsland && meta.startIsland.unlocked && !meta.startIsland.guideShown) {
      const px = state.player.x + state.player.w / 2;
      const py = state.player.y + state.player.h / 2;
      const start = meta.startIsland;
      const insideStart = px >= start.x0 * Game.constants.TILE && px <= (start.x1 + 1) * Game.constants.TILE && py >= start.y0 * Game.constants.TILE && py <= (start.y1 + 1) * Game.constants.TILE;
      if (!insideStart) {
        meta.startIsland.guideShown = true;
        if (castle) state.pause.activeCompassTarget = 'air_castle';
        state.ui.noticeText = 'Компас указывает на замок воздушного короля.';
        state.ui.noticeTimer = 5;
      }
    }
  }

  Game.windfolkEntity = { updateWindfolk };
})();
