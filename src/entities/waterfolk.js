(() => {
  const Game = window.MC2D;
  const { phaseInfo } = Game.dayCycle;
  const { addToInventory, countItem } = Game.inventory;
  const { ITEM } = Game.items;

  function isNightTime(state) {
    return phaseInfo(state).phase === 'night';
  }

  function updateWaterfolk(state, dt) {
    if (state.activeDimension !== 'water' || !Array.isArray(state.waterfolk)) return;
    const meta = state.waterWorldMeta || {};
    const castle = meta.castle || null;
    const night = isNightTime(state);
    if (meta.questGiven && !meta.medicinePromptShown && countItem(state, ITEM.MEDICINE) > 0) {
      meta.medicinePromptShown = true;
      state.pause.activeCompassTarget = 'water_castle';
      state.ui.noticeText = 'Лекарство готово. Принеси его главному водяному.';
      state.ui.noticeTimer = 5;
    }
    for (const waterfolk of state.waterfolk) {
      if (waterfolk.sleeping && !night) waterfolk.sleeping = false;
      if (!waterfolk.chief && night && Number.isFinite(waterfolk.sleepBlockX) && Number.isFinite(waterfolk.sleepBlockY)) {
        waterfolk.sleeping = true;
      }
      if (waterfolk.sleeping) {
        waterfolk.vx = 0;
        waterfolk.vy = 0;
        waterfolk.x = waterfolk.sleepBlockX + 1;
        waterfolk.y = waterfolk.sleepBlockY - waterfolk.h + 10;
        continue;
      }
      waterfolk.timer = (waterfolk.timer || 0) + dt;
      waterfolk.dirTimer = Math.max(0, (waterfolk.dirTimer || 0) - dt);
      if (waterfolk.dirTimer <= 0) {
        waterfolk.dir = Math.random() < 0.5 ? -1 : 1;
        waterfolk.dirTimer = 1.8 + Math.random() * 2.2;
      }
      const anchorX = Number.isFinite(waterfolk.anchorX) ? waterfolk.anchorX : waterfolk.x;
      const anchorY = Number.isFinite(waterfolk.anchorY) ? waterfolk.anchorY : waterfolk.y;
      waterfolk.x += waterfolk.dir * 16 * dt;
      waterfolk.y = anchorY + Math.sin(waterfolk.timer * 1.8 + waterfolk.anchorPhase) * 6;
      if (waterfolk.x < anchorX - 36) waterfolk.dir = 1;
      if (waterfolk.x > anchorX + 36) waterfolk.dir = -1;

      if (waterfolk.chief && castle && meta.domeReleased && !meta.questGiven) {
        const dx = (waterfolk.x + waterfolk.w / 2) - (state.player.x + state.player.w / 2);
        const dy = (waterfolk.y + waterfolk.h / 2) - (state.player.y + state.player.h / 2);
        if (Math.hypot(dx, dy) <= 96) {
          meta.questGiven = true;
          if (countItem(state, ITEM.MAGIC_GARDEN_MAP) <= 0) addToInventory(state, ITEM.MAGIC_GARDEN_MAP, 1);
          state.pause.activeCompassTarget = 'golden_garden';
          state.ui.noticeText = 'Водяной: У нас все заболели. Возьми карту к волшебному саду и принеси лекарство.';
          state.ui.noticeTimer = 6;
        }
        continue;
      }

      if (waterfolk.chief && castle && meta.questGiven && !meta.medicineDelivered && countItem(state, ITEM.MEDICINE) > 0) {
        const dx = (waterfolk.x + waterfolk.w / 2) - (state.player.x + state.player.w / 2);
        const dy = (waterfolk.y + waterfolk.h / 2) - (state.player.y + state.player.h / 2);
        if (Math.hypot(dx, dy) <= 96) {
          meta.medicineDelivered = true;
          meta.mainWellMapGiven = true;
          if (countItem(state, ITEM.MAIN_WELL_MAP) <= 0) addToInventory(state, ITEM.MAIN_WELL_MAP, 1);
          state.pause.activeCompassTarget = 'main_well';
          state.ui.noticeText = 'Водяной: Вылей лекарство в главный колодец. Я дал тебе карту.';
          state.ui.noticeTimer = 6;
        }
        continue;
      }

      if (waterfolk.chief && castle && meta.mainWell && meta.mainWell.completed && !meta.steamAmuletGiven) {
        const dx = (waterfolk.x + waterfolk.w / 2) - (state.player.x + state.player.w / 2);
        const dy = (waterfolk.y + waterfolk.h / 2) - (state.player.y + state.player.h / 2);
        if (Math.hypot(dx, dy) <= 96) {
          meta.steamAmuletGiven = true;
          if (countItem(state, ITEM.STEAM_AMULET) <= 0) addToInventory(state, ITEM.STEAM_AMULET, 1);
          if (state.dimensions && state.dimensions.overworld && Game.generation && Game.generation.spawnAirEntrance) {
            const overworld = state.dimensions.overworld;
            overworld.activeDimension = 'overworld';
            overworld.worldMeta = state.worldMeta;
            if (Game.generation.retrofitWorldFeatures) Game.generation.retrofitWorldFeatures(overworld);
            Game.generation.spawnAirEntrance(overworld);
            delete overworld.activeDimension;
            delete overworld.worldMeta;
          }
          state.pause.activeCompassTarget = null;
          state.ui.noticeText = 'Водяной: Прими Амулет пара. В небе появилась новая тайна.';
          state.ui.noticeTimer = 6;
        }
      }
    }
  }

  Game.waterfolkEntity = { updateWaterfolk };
})();
