(() => {
  const Game = window.MC2D;

  function getPauseLayout(canvas, state) {
    const mobile = !!(state.ui && state.ui.controlMode === 'touch') || canvas.width < 900;
    const compactHeight = mobile && canvas.height < 760;
    const panelWidth = mobile ? Math.min(canvas.width - 16, 340) : 360;
    const panelHeight = state.pause.confirmRestart ? 240 : state.pause.showControls ? (mobile ? (compactHeight ? 286 : 320) : 300) : (mobile ? (compactHeight ? 362 : 432) : 432);
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

    const buttonH = compactHeight ? 36 : 42;
    const startY = compactHeight ? 82 : 92;
    const gap = compactHeight ? 8 : 10;
    return {
      panel,
      buttons: [
        { id: 'continue', label: 'Продолжить', x: panel.x + 20, y: panel.y + startY, w: panel.w - 40, h: buttonH },
        { id: 'controls', label: 'Управление', x: panel.x + 20, y: panel.y + startY + (buttonH + gap), w: panel.w - 40, h: buttonH },
        { id: 'save', label: 'Сохранить', x: panel.x + 20, y: panel.y + startY + (buttonH + gap) * 2, w: panel.w - 40, h: buttonH },
        { id: 'fullscreen', label: state.pause.fullscreenLabel || 'Полный экран', x: panel.x + 20, y: panel.y + startY + (buttonH + gap) * 3, w: panel.w - 40, h: buttonH },
        { id: 'restart', label: 'Перезапустить', x: panel.x + 20, y: panel.y + startY + (buttonH + gap) * 4, w: panel.w - 40, h: buttonH },
        { id: 'exit_to_menu', label: 'Выйти', x: panel.x + 20, y: panel.y + startY + (buttonH + gap) * 5, w: panel.w - 40, h: buttonH },
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
