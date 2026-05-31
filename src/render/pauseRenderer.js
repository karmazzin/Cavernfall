(() => {
  const Game = window.MC2D;
  const { TILE } = Game.constants;
  const { ITEM } = Game.items;
  const { countItem } = Game.inventory;

  function hasCompassMode(state) {
    return !!(state.worldMeta && state.worldMeta.mode !== 'survival');
  }

  function isMobileClient(state) {
    return !!(state.ui && state.ui.controlMode === 'touch');
  }

  function isHardcoreSpectator(state) {
    return !!(state.worldMeta && state.worldMeta.mode === 'hardcore_spectator');
  }

  function drawCompassArrow(ctx, x, y, dx, dy, scale = 1) {
    const len = 24 * scale;
    const angle = Math.atan2(dy, dx);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.strokeStyle = 'rgba(255,210,150,0.96)';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-len * 0.5, 0);
    ctx.lineTo(len * 0.28, 0);
    ctx.stroke();
    ctx.fillStyle = '#ffd48a';
    ctx.beginPath();
    ctx.moveTo(len * 0.5, 0);
    ctx.lineTo(len * 0.16, -7 * scale);
    ctx.lineTo(len * 0.16, 7 * scale);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function getCompassTarget(state, key) {
    if (key === 'fire_pyramid') {
      const pyramid = state.firePyramid;
      if (!pyramid) return null;
      return {
        label: 'Пирамида огня',
        x: pyramid.centerX * TILE,
        y: pyramid.baseY * TILE,
      };
    }
    if (key === 'fire_caves') {
      const region = state.fireCaves && state.fireCaves.region;
      if (!region) return null;
      return {
        label: 'Огненные пещеры',
        x: ((region.x0 + region.x1) / 2) * TILE,
        y: ((region.y0 + region.y1) / 2) * TILE,
      };
    }
    if (key === 'water_caves') {
      const region = state.waterCaves && state.waterCaves.region;
      if (!region) return null;
      return {
        label: 'Водные пещеры',
        x: ((region.x0 + region.x1) / 2) * TILE,
        y: ((region.y0 + region.y1) / 2) * TILE,
      };
    }
    if (key === 'air_caves') {
      const region = state.airCaves && state.airCaves.region;
      if (!region) return null;
      return {
        label: 'Воздушные пещеры',
        x: ((region.x0 + region.x1) / 2) * TILE,
        y: ((region.y0 + region.y1) / 2) * TILE,
      };
    }
    if (key === 'fire_castle') {
      const castle = state.fireWorldMeta && state.fireWorldMeta.castle;
      if (!castle) return null;
      return {
        label: 'Замок огненного короля',
        x: castle.throneX * TILE,
        y: castle.baseY * TILE,
      };
    }
    if (key === 'fire_dungeon') {
      const dungeon = state.fireDungeon || (state.fireWorldMeta && state.fireWorldMeta.fireDungeon);
      if (!dungeon) return null;
      return {
        label: 'Огненная темница',
        x: dungeon.centerX * TILE,
        y: dungeon.centerY * TILE,
      };
    }
    if (key === 'ash_cache') {
      const cache = state.fireWorldMeta && state.fireWorldMeta.ashCache;
      if (!cache) return null;
      return {
        label: 'Пепельный клад',
        x: cache.tx * TILE,
        y: cache.ty * TILE,
      };
    }
    if (key === 'water_well') {
      const well = state.waterWell;
      if (!well) return null;
      return {
        label: 'Водный колодец',
        x: well.centerX * TILE,
        y: well.baseY * TILE,
      };
    }
    if (key === 'golden_garden') {
      const garden = state.waterWorldMeta && state.waterWorldMeta.goldenGarden;
      if (!garden) return null;
      return {
        label: 'Сад золотых цветков',
        x: garden.centerX * TILE,
        y: garden.groundY * TILE,
      };
    }
    if (key === 'main_well') {
      const mainWell = state.waterWorldMeta && state.waterWorldMeta.mainWell;
      if (!mainWell || !mainWell.revealed) return null;
      return {
        label: 'Главный колодец',
        x: mainWell.centerX * TILE,
        y: mainWell.baseY * TILE,
      };
    }
    if (key === 'pirate_treasure') {
      const treasure = state.waterWorldMeta && state.waterWorldMeta.pirateTreasure;
      if (!treasure) return null;
      return {
        label: 'Пиратский клад',
        x: treasure.tx * TILE,
        y: treasure.ty * TILE,
      };
    }
    if (key === 'air_entrance') {
      const entrance = state.airCaves && state.airCaves.entrance;
      if (!entrance || !entrance.spawned) return null;
      return {
        label: 'Вход в воздушное измерение',
        x: entrance.centerX * TILE,
        y: entrance.baseY * TILE,
      };
    }
    if (key === 'air_castle') {
      const castle = state.airWorldMeta && state.airWorldMeta.castle;
      if (!castle) return null;
      return {
        label: 'Замок воздушного короля',
        x: castle.centerX * TILE,
        y: castle.baseY * TILE,
      };
    }
    if (key === 'great_tree_garden') {
      const garden = state.undergroundWorldMeta && state.undergroundWorldMeta.garden;
      if (!garden) return null;
      return {
        label: 'Сад великих древ',
        x: garden.centerX * TILE,
        y: garden.groundY * TILE,
      };
    }
    if (key === 'underground_castle') {
      const castle = state.undergroundWorldMeta && state.undergroundWorldMeta.castle;
      if (!castle) return null;
      return {
        label: 'Замок подземного короля',
        x: castle.centerX * TILE,
        y: castle.baseY * TILE,
      };
    }
    return null;
  }

  function getCompassEntries(state) {
    const keys = ['fire_pyramid', 'fire_caves', 'water_caves', 'air_caves', 'fire_castle', 'fire_dungeon', 'water_well'];
    if (countItem(state, ITEM.MAGIC_GARDEN_MAP) > 0) keys.push('golden_garden');
    if (countItem(state, ITEM.MAIN_WELL_MAP) > 0) keys.push('main_well');
    if (countItem(state, ITEM.TREASURE_MAP) > 0 && state.waterWorldMeta && state.waterWorldMeta.pirateTreasure) keys.push('pirate_treasure');
    if (countItem(state, ITEM.CHARRED_MAP) > 0 && state.fireWorldMeta && state.fireWorldMeta.ashCache) keys.push('ash_cache');
    if (state.airCaves && state.airCaves.entrance && state.airCaves.entrance.spawned) keys.push('air_entrance');
    if (state.airWorldMeta && state.airWorldMeta.castle) keys.push('air_castle');
    if (state.undergroundWorldMeta && state.undergroundWorldMeta.garden) keys.push('great_tree_garden');
    if (state.undergroundWorldMeta && state.undergroundWorldMeta.castle) keys.push('underground_castle');
    return keys.map((key) => ({
      key,
      target: getCompassTarget(state, key),
      label:
        key === 'fire_pyramid'
          ? 'Пирамида огня'
          : key === 'fire_caves'
            ? 'Огненные пещеры'
            : key === 'water_caves'
              ? 'Водные пещеры'
              : key === 'air_caves'
                ? 'Воздушные пещеры'
            : key === 'fire_castle'
              ? 'Замок огненного короля'
              : key === 'fire_dungeon'
                ? 'Огненная темница'
                : key === 'golden_garden'
                  ? 'Сад золотых цветков'
                : key === 'main_well'
                  ? 'Главный колодец'
                  : key === 'pirate_treasure'
                    ? 'Пиратский клад'
                    : key === 'ash_cache'
                      ? 'Пепельный клад'
                    : key === 'air_entrance'
                      ? 'Вход в воздушное измерение'
                      : key === 'air_castle'
                        ? 'Замок воздушного короля'
                        : key === 'great_tree_garden'
                          ? 'Сад великих древ'
                          : key === 'underground_castle'
                            ? 'Замок подземного короля'
                  : 'Водный колодец',
    }));
  }

  function getCompassPageSize(compactHeight) {
    return compactHeight ? 4 : 5;
  }

  function getCompassPagedEntries(state, compactHeight) {
    const entries = getCompassEntries(state);
    const pageSize = getCompassPageSize(compactHeight);
    const pageCount = Math.max(1, Math.ceil(entries.length / pageSize));
    const page = Math.max(0, Math.min(pageCount - 1, state.pause && Number.isFinite(state.pause.compassPage) ? state.pause.compassPage : 0));
    const pageEntries = entries.slice(page * pageSize, page * pageSize + pageSize);
    return { entries, pageEntries, page, pageCount, pageSize };
  }

  function getCompassMetrics(panel, compactHeight) {
    return {
      titleY: panel.y + (compactHeight ? 68 : 80),
      rowsStartY: panel.y + (compactHeight ? 116 : 130),
      rowStep: compactHeight ? 88 : 98,
      buttonW: compactHeight ? 90 : 106,
      buttonH: compactHeight ? 30 : 34,
    };
  }

  function getPauseLayout(canvas, state) {
    const mobile = !!(state.ui && state.ui.controlMode === 'touch') || canvas.width < 900;
    const compactHeight = mobile && canvas.height < 760;
    const panelWidth = mobile ? Math.min(canvas.width - 16, 340) : 360;
    const creativeExtra = hasCompassMode(state) ? 1 : 0;
    const assistantExtra = isMobileClient(state) ? 0 : 1;
    const panelHeight = state.pause.confirmRestart
      ? 240
      : state.pause.showControls
        ? (mobile ? (compactHeight ? 286 : 320) : 300)
        : state.pause.showModePicker
          ? (mobile ? (compactHeight ? 404 : 452) : 454)
          : state.pause.showAssistant
            ? (mobile ? (compactHeight ? 146 : 168) : 176)
          : state.pause.showCompass
            ? (mobile ? (compactHeight ? 604 : 676) : 712)
          : (mobile ? (compactHeight ? 406 + creativeExtra * 44 + assistantExtra * 44 : 474 + creativeExtra * 50 + assistantExtra * 50) : 474 + creativeExtra * 52 + assistantExtra * 52);
    const panel = {
      w: panelWidth,
      h: panelHeight,
      x: Math.floor((canvas.width - panelWidth) / 2),
      y: compactHeight ? 8 : Math.floor((canvas.height - panelHeight) / 2),
    };

    if (state.pause.confirmRestart) {
      return {
        panel,
        buttons: [
          { id: 'restart_yes', label: 'Да', x: panel.x + 20, y: panel.y + (compactHeight ? 156 : 176), w: Math.floor((panel.w - 50) / 2), h: compactHeight ? 38 : 42 },
          { id: 'restart_no', label: 'Нет', x: panel.x + panel.w - Math.floor((panel.w - 50) / 2) - 20, y: panel.y + (compactHeight ? 156 : 176), w: Math.floor((panel.w - 50) / 2), h: compactHeight ? 38 : 42 },
        ],
      };
    }

    if (state.pause.showControls) {
      return {
        panel,
        buttons: [
          { id: 'controls_back', label: 'Назад', x: panel.x + 20, y: panel.y + panel.h - (compactHeight ? 48 : 62), w: panel.w - 40, h: compactHeight ? 38 : 42 },
        ],
      };
    }

    if (state.pause.showModePicker) {
      const buttonH = compactHeight ? 36 : 42;
      const startY = compactHeight ? 84 : 96;
      const gap = compactHeight ? 8 : 10;
      const mobileClient = isMobileClient(state);
      return {
        panel,
        buttons: mobileClient
          ? [
              { id: 'mode_mobile', label: 'Мобильный режим', x: panel.x + 20, y: panel.y + startY, w: panel.w - 40, h: buttonH },
              { id: 'mode_spectator', label: 'Спектатор', x: panel.x + 20, y: panel.y + startY + (buttonH + gap), w: panel.w - 40, h: buttonH },
              { id: 'mode_back', label: 'Назад', x: panel.x + 20, y: panel.y + panel.h - (compactHeight ? 48 : 62), w: panel.w - 40, h: buttonH },
            ]
          : [
              { id: 'mode_survival', label: 'Выживание', x: panel.x + 20, y: panel.y + startY, w: panel.w - 40, h: buttonH },
              { id: 'mode_hardcore', label: 'Хардкор', x: panel.x + 20, y: panel.y + startY + (buttonH + gap), w: panel.w - 40, h: buttonH },
              { id: 'mode_creative', label: 'Творческий', x: panel.x + 20, y: panel.y + startY + (buttonH + gap) * 2, w: panel.w - 40, h: buttonH },
              { id: 'mode_infinite_inventory', label: 'Бесконечный инвентарь', x: panel.x + 20, y: panel.y + startY + (buttonH + gap) * 3, w: panel.w - 40, h: buttonH },
              { id: 'mode_spectator', label: 'Спектатор', x: panel.x + 20, y: panel.y + startY + (buttonH + gap) * 4, w: panel.w - 40, h: buttonH },
              { id: 'mode_back', label: 'Назад', x: panel.x + 20, y: panel.y + panel.h - (compactHeight ? 48 : 62), w: panel.w - 40, h: buttonH },
            ],
      };
    }

    if (state.pause.showCompass) {
      const { pageEntries, pageCount } = getCompassPagedEntries(state, compactHeight);
      const metrics = getCompassMetrics(panel, compactHeight);
      const pageNavExtra = pageCount > 1 ? (compactHeight ? 48 : 56) : 0;
      const contentBottom = metrics.rowsStartY + Math.max(0, pageEntries.length - 1) * metrics.rowStep + metrics.buttonH + 28 + pageNavExtra;
      panel.h = Math.max(panel.h, contentBottom - panel.y + (compactHeight ? 68 : 78));
      return {
        panel,
        buttons: [
          ...pageEntries.map((entry, index) => ({
            id: `compass_track_${entry.key}`,
            label: state.pause.activeCompassTarget === entry.key ? 'Убрать' : 'В путь',
            x: panel.x + panel.w - metrics.buttonW - 24,
            y: metrics.rowsStartY + index * metrics.rowStep + (compactHeight ? 4 : 6),
            w: metrics.buttonW,
            h: metrics.buttonH,
          })),
          ...(pageCount > 1
            ? [
                { id: 'compass_prev_page', label: 'Пред.', x: panel.x + 20, y: panel.y + panel.h - (compactHeight ? 96 : 116), w: Math.floor((panel.w - 56) / 2), h: compactHeight ? 34 : 38 },
                { id: 'compass_next_page', label: 'Дальше', x: panel.x + panel.w - Math.floor((panel.w - 56) / 2) - 20, y: panel.y + panel.h - (compactHeight ? 96 : 116), w: Math.floor((panel.w - 56) / 2), h: compactHeight ? 34 : 38 },
              ]
            : []),
          { id: 'compass_back', label: 'Назад', x: panel.x + 20, y: panel.y + panel.h - (compactHeight ? 48 : 62), w: panel.w - 40, h: compactHeight ? 36 : 42 },
        ],
      };
    }

    if (state.pause.showAssistant) {
      return {
        panel,
        buttons: [],
      };
    }

    const buttonH = compactHeight ? 36 : 42;
    const startY = compactHeight ? 82 : 92;
    const gap = compactHeight ? 8 : 10;
    return {
      panel,
      buttons: [
        { id: 'continue', label: 'Продолжить', x: panel.x + 20, y: panel.y + startY, w: panel.w - 40, h: buttonH },
        { id: 'controls', label: 'Управление', x: panel.x + 20, y: panel.y + startY + (buttonH + gap), w: panel.w - 40, h: buttonH },
        ...(!isHardcoreSpectator(state) ? [{ id: 'choose_mode', label: 'Выбрать режим', x: panel.x + 20, y: panel.y + startY + (buttonH + gap) * 2, w: panel.w - 40, h: buttonH }] : []),
        ...(hasCompassMode(state) ? [{ id: 'compass', label: 'Компас', x: panel.x + 20, y: panel.y + startY + (buttonH + gap) * (isHardcoreSpectator(state) ? 2 : 3), w: panel.w - 40, h: buttonH }] : []),
        ...(isMobileClient(state) ? [] : [{ id: 'assistant', label: 'Помощник', x: panel.x + 20, y: panel.y + startY + (buttonH + gap) * ((isHardcoreSpectator(state) ? 2 : 3) + creativeExtra), w: panel.w - 40, h: buttonH }]),
        { id: 'save', label: 'Сохранить', x: panel.x + 20, y: panel.y + startY + (buttonH + gap) * ((isHardcoreSpectator(state) ? 3 : 4) + creativeExtra - (isMobileClient(state) ? 1 : 0)), w: panel.w - 40, h: buttonH },
        { id: 'fullscreen', label: state.pause.fullscreenLabel || 'Полный экран', x: panel.x + 20, y: panel.y + startY + (buttonH + gap) * ((isHardcoreSpectator(state) ? 4 : 5) + creativeExtra - (isMobileClient(state) ? 1 : 0)), w: panel.w - 40, h: buttonH },
        { id: 'restart', label: 'Перезапустить', x: panel.x + 20, y: panel.y + startY + (buttonH + gap) * ((isHardcoreSpectator(state) ? 5 : 6) + creativeExtra - (isMobileClient(state) ? 1 : 0)), w: panel.w - 40, h: buttonH },
        { id: 'exit_to_menu', label: 'Выйти', x: panel.x + 20, y: panel.y + startY + (buttonH + gap) * ((isHardcoreSpectator(state) ? 6 : 7) + creativeExtra - (isMobileClient(state) ? 1 : 0)), w: panel.w - 40, h: buttonH },
      ],
    };
  }

  function drawButton(ctx, button) {
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fillRect(button.x, button.y, button.w, button.h);
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.lineWidth = 2;
    ctx.strokeRect(button.x, button.y, button.w, button.h);
    ctx.fillStyle = '#fff';
    ctx.font = `bold ${button.h <= 36 ? 16 : 18}px Arial`;
    ctx.textAlign = 'center';
    ctx.fillText(button.label, button.x + button.w / 2, button.y + (button.h <= 36 ? 24 : 27));
    ctx.textAlign = 'left';
  }

  function drawPauseOverlay(ctx, canvas, state) {
    if (!state.pause || !state.pause.open) return;

    const layout = getPauseLayout(canvas, state);
    const compactHeight = !!(state.ui && state.ui.controlMode === 'touch') && canvas.height < 760;
    ctx.fillStyle = 'rgba(0,0,0,0.68)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = 'rgba(22,18,14,0.97)';
    ctx.fillRect(layout.panel.x, layout.panel.y, layout.panel.w, layout.panel.h);
    ctx.strokeStyle = 'rgba(255,255,255,0.22)';
    ctx.lineWidth = 2;
    ctx.strokeRect(layout.panel.x, layout.panel.y, layout.panel.w, layout.panel.h);

    ctx.fillStyle = '#fff';
    ctx.font = `bold ${compactHeight ? 24 : 28}px Arial`;
    ctx.fillText('Пауза', layout.panel.x + 24, layout.panel.y + (compactHeight ? 34 : 42));
    if (state.worldMeta && state.worldMeta.name) {
      ctx.font = `${compactHeight ? 12 : 14}px Arial`;
      ctx.fillStyle = 'rgba(255,255,255,0.78)';
      ctx.fillText(`Мир: ${state.worldMeta.name}`, layout.panel.x + 24, layout.panel.y + (compactHeight ? 52 : 64));
    }

    if (state.pause.confirmRestart) {
      ctx.font = `${compactHeight ? 14 : 16}px Arial`;
      ctx.fillText('Вы точно хотите перезапустить?', layout.panel.x + 24, layout.panel.y + (compactHeight ? 84 : 94));
      ctx.fillText('Мир будет создан заново с тем же сидом.', layout.panel.x + 24, layout.panel.y + (compactHeight ? 108 : 120));
    } else if (state.pause.showControls) {
      const touchMode = !!(state.ui && state.ui.controlMode === 'touch');
      ctx.font = `${compactHeight ? 13 : 15}px Arial`;
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      if (touchMode) {
        const x = layout.panel.x + 24;
        const y = layout.panel.y + (compactHeight ? 66 : 74);
        const step = compactHeight ? 20 : 24;
        ctx.fillText('Телефон:', x, y);
        ctx.fillText('Стик слева — движение и набор высоты', x, y + step);
        ctx.fillText('Тап по миру — взаимодействие', x, y + step * 2);
        ctx.fillText('Удержание — копание блока', x, y + step * 3);
        ctx.fillText('Тап по хотбару — выбрать слот', x, y + step * 4);
        ctx.fillText('Инв. / Еда / Пауза — справа', x, y + step * 5);
      } else {
        const x = layout.panel.x + 24;
        const y = layout.panel.y + (compactHeight ? 66 : 74);
        const step = compactHeight ? 20 : 24;
        ctx.fillText('Компьютер:', x, y);
        ctx.fillText('A / D — идти, F — полёт в creative', x, y + step);
        ctx.fillText('W / Пробел — прыгать / всплывать', x, y + step * 2);
        ctx.fillText('ЛКМ по миру — ломать, ставить, бить', x, y + step * 3);
        ctx.fillText('1..9 — выбор слота хотбара', x, y + step * 4);
        ctx.fillText('E — еда, Y — инвентарь, Esc — пауза', x, y + step * 5);
      }
    } else if (state.pause.showModePicker) {
      const labels = {
        survival: 'Выживание',
        hardcore: 'Хардкор',
        creative: 'Творческий',
        mobile: 'Мобильный режим',
        infinite_inventory: 'Бесконечный инвентарь',
        spectator: 'Спектатор',
        hardcore_spectator: 'Хардкорный спектатор',
      };
      const currentMode = state.worldMeta && state.worldMeta.mode ? state.worldMeta.mode : 'survival';
      ctx.font = `${compactHeight ? 13 : 15}px Arial`;
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.fillText(`Текущий режим: ${labels[currentMode] || 'Выживание'}`, layout.panel.x + 24, layout.panel.y + (compactHeight ? 66 : 76));
    } else if (state.pause.showCompass) {
      const px = state.player.x + state.player.w / 2;
      const py = state.player.y + state.player.h / 2;
      const baseX = layout.panel.x + 24;
      const metrics = getCompassMetrics(layout.panel, compactHeight);
      const { pageEntries, page, pageCount } = getCompassPagedEntries(state, compactHeight);
      let lineY = metrics.titleY;
      ctx.font = `${compactHeight ? 13 : 15}px Arial`;
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.fillText('Компас для уникальных структур и пещер.', baseX, lineY);
      if (pageCount > 1) {
        ctx.textAlign = 'right';
        ctx.fillStyle = 'rgba(255,255,255,0.72)';
        ctx.fillText(`Страница ${page + 1}/${pageCount}`, layout.panel.x + layout.panel.w - 24, lineY);
        ctx.textAlign = 'left';
      }
      lineY = metrics.rowsStartY;

      for (let index = 0; index < pageEntries.length; index += 1) {
        const entry = pageEntries[index];
        const { key, target } = entry;
        const rowY = metrics.rowsStartY + index * metrics.rowStep;
        const label = target ? target.label : entry.label;
        const dx = target ? target.x - px : 0;
        const dy = target ? target.y - py : 0;
        const dist = target ? Math.round(Math.hypot(dx, dy) / TILE) : null;
        ctx.fillStyle = '#ffffff';
        ctx.fillText(label, baseX, rowY);
        if (state.pause.activeCompassTarget === key) {
          ctx.fillStyle = 'rgba(140,255,180,0.96)';
          ctx.fillText('На HUD', baseX + 180, rowY);
        }
        ctx.fillStyle = 'rgba(255,210,150,0.92)';
        if (target) {
          drawCompassArrow(ctx, baseX + 22, rowY + (compactHeight ? 17 : 20), dx, dy, compactHeight ? 0.9 : 1);
          ctx.fillText(`${Number.isFinite(dist) ? `${dist} блоков` : ''}`, baseX + 46, rowY + (compactHeight ? 18 : 22));
        } else {
          ctx.fillText('Не найдены в мире', baseX, rowY + (compactHeight ? 18 : 22));
        }
      }
    } else if (state.pause.showAssistant) {
      ctx.font = `${compactHeight ? 13 : 15}px Arial`;
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.fillText('Игровой помощник отвечает только по механикам этой игры.', layout.panel.x + 24, layout.panel.y + (compactHeight ? 76 : 88));
      ctx.fillText('Если вопрос не про игру, он ответит: «Извините, я не знаю информацию.»', layout.panel.x + 24, layout.panel.y + (compactHeight ? 98 : 112));
    } else {
      if (state.pause.statusText) {
        ctx.fillStyle = '#8cff8c';
        ctx.fillText(state.pause.statusText, layout.panel.x + 24, layout.panel.y + layout.panel.h - 18);
      }
    }

    for (const button of layout.buttons) drawButton(ctx, button);
  }

  Game.pauseRenderer = { getPauseLayout, drawPauseOverlay };
})();
