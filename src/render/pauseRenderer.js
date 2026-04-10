(() => {
  const Game = window.MC2D;
  const { TILE } = Game.constants;

  function isCreativeMode(state) {
    return !!(state.worldMeta && state.worldMeta.mode === 'creative');
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
    if (key === 'water_well') {
      const well = state.waterWell;
      if (!well) return null;
      return {
        label: 'Водный колодец',
        x: well.centerX * TILE,
        y: well.baseY * TILE,
      };
    }
    return null;
  }

  function getCompassEntries(state) {
    return ['fire_pyramid', 'fire_caves', 'water_caves', 'fire_castle', 'fire_dungeon', 'water_well'].map((key) => ({
      key,
      target: getCompassTarget(state, key),
      label:
        key === 'fire_pyramid'
          ? 'Пирамида огня'
          : key === 'fire_caves'
            ? 'Огненные пещеры'
            : key === 'water_caves'
            ? 'Водные пещеры'
            : key === 'fire_castle'
              ? 'Замок огненного короля'
              : key === 'fire_dungeon'
                ? 'Огненная темница'
                : 'Водный колодец',
    }));
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
    const creativeExtra = isCreativeMode(state) ? 1 : 0;
    const assistantExtra = 1;
    const panelHeight = state.pause.confirmRestart
      ? 240
      : state.pause.showControls
        ? (mobile ? (compactHeight ? 286 : 320) : 300)
        : state.pause.showModePicker
          ? (mobile ? (compactHeight ? 346 : 388) : 390)
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
      return {
        panel,
        buttons: [
          { id: 'mode_survival', label: 'Выживание', x: panel.x + 20, y: panel.y + startY, w: panel.w - 40, h: buttonH },
          { id: 'mode_creative', label: 'Творческий', x: panel.x + 20, y: panel.y + startY + (buttonH + gap), w: panel.w - 40, h: buttonH },
          { id: 'mode_infinite_inventory', label: 'Бесконечный инвентарь', x: panel.x + 20, y: panel.y + startY + (buttonH + gap) * 2, w: panel.w - 40, h: buttonH },
          { id: 'mode_spectator', label: 'Спектатор', x: panel.x + 20, y: panel.y + startY + (buttonH + gap) * 3, w: panel.w - 40, h: buttonH },
          { id: 'mode_back', label: 'Назад', x: panel.x + 20, y: panel.y + panel.h - (compactHeight ? 48 : 62), w: panel.w - 40, h: buttonH },
        ],
      };
    }

    if (state.pause.showCompass) {
      const entries = getCompassEntries(state);
      const metrics = getCompassMetrics(panel, compactHeight);
      const contentBottom = metrics.rowsStartY + Math.max(0, entries.length - 1) * metrics.rowStep + metrics.buttonH + 28;
      panel.h = Math.max(panel.h, contentBottom - panel.y + (compactHeight ? 68 : 78));
      return {
        panel,
        buttons: [
          ...entries.map((entry, index) => ({
            id: `compass_track_${entry.key}`,
            label: state.pause.activeCompassTarget === entry.key ? 'Убрать' : 'В путь',
            x: panel.x + panel.w - metrics.buttonW - 24,
            y: metrics.rowsStartY + index * metrics.rowStep + (compactHeight ? 4 : 6),
            w: metrics.buttonW,
            h: metrics.buttonH,
          })),
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
        { id: 'choose_mode', label: 'Выбрать режим', x: panel.x + 20, y: panel.y + startY + (buttonH + gap) * 2, w: panel.w - 40, h: buttonH },
        ...(isCreativeMode(state) ? [{ id: 'compass', label: 'Компас', x: panel.x + 20, y: panel.y + startY + (buttonH + gap) * 3, w: panel.w - 40, h: buttonH }] : []),
        { id: 'assistant', label: 'Помощник', x: panel.x + 20, y: panel.y + startY + (buttonH + gap) * (3 + creativeExtra), w: panel.w - 40, h: buttonH },
        { id: 'save', label: 'Сохранить', x: panel.x + 20, y: panel.y + startY + (buttonH + gap) * (4 + creativeExtra), w: panel.w - 40, h: buttonH },
        { id: 'fullscreen', label: state.pause.fullscreenLabel || 'Полный экран', x: panel.x + 20, y: panel.y + startY + (buttonH + gap) * (5 + creativeExtra), w: panel.w - 40, h: buttonH },
        { id: 'restart', label: 'Перезапустить', x: panel.x + 20, y: panel.y + startY + (buttonH + gap) * (6 + creativeExtra), w: panel.w - 40, h: buttonH },
        { id: 'exit_to_menu', label: 'Выйти', x: panel.x + 20, y: panel.y + startY + (buttonH + gap) * (7 + creativeExtra), w: panel.w - 40, h: buttonH },
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
        creative: 'Творческий',
        infinite_inventory: 'Бесконечный инвентарь',
        spectator: 'Спектатор',
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
      let lineY = metrics.titleY;
      ctx.font = `${compactHeight ? 13 : 15}px Arial`;
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.fillText('Творческий компас для уникальных пещер.', baseX, lineY);
      lineY = metrics.rowsStartY;

      for (let index = 0; index < getCompassEntries(state).length; index += 1) {
        const entry = getCompassEntries(state)[index];
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
