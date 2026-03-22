(() => {
  const Game = window.MC2D;

  function getPauseLayout(canvas, state) {
    const mobile = !!(state.ui && state.ui.controlMode === 'touch') || canvas.width < 900;
    const panelWidth = mobile ? Math.min(canvas.width - 20, 340) : 360;
    const panelHeight = state.pause.confirmRestart ? 260 : state.pause.showControls ? (mobile ? 320 : 300) : 344;
    const panel = {
      w: panelWidth,
      h: panelHeight,
      x: Math.floor((canvas.width - panelWidth) / 2),
      y: Math.floor((canvas.height - panelHeight) / 2),
    };

    if (state.pause.confirmRestart) {
      return {
        panel,
        buttons: [
          { id: 'restart_yes', label: 'Да', x: panel.x + 20, y: panel.y + 176, w: Math.floor((panel.w - 50) / 2), h: 42 },
          { id: 'restart_no', label: 'Нет', x: panel.x + panel.w - Math.floor((panel.w - 50) / 2) - 20, y: panel.y + 176, w: Math.floor((panel.w - 50) / 2), h: 42 },
        ],
      };
    }

    if (state.pause.showControls) {
      return {
        panel,
        buttons: [
          { id: 'controls_back', label: 'Назад', x: panel.x + 20, y: panel.y + panel.h - 62, w: panel.w - 40, h: 42 },
        ],
      };
    }

    return {
      panel,
      buttons: [
        { id: 'continue', label: 'Продолжить', x: panel.x + 20, y: panel.y + 92, w: panel.w - 40, h: 42 },
        { id: 'controls', label: 'Управление', x: panel.x + 20, y: panel.y + 144, w: panel.w - 40, h: 42 },
        { id: 'save', label: 'Сохранить', x: panel.x + 20, y: panel.y + 196, w: panel.w - 40, h: 42 },
        { id: 'fullscreen', label: state.pause.fullscreenLabel || 'Полный экран', x: panel.x + 20, y: panel.y + 248, w: panel.w - 40, h: 42 },
        { id: 'restart', label: 'Перезапустить', x: panel.x + 20, y: panel.y + 300, w: panel.w - 40, h: 42 },
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
    ctx.font = 'bold 18px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(button.label, button.x + button.w / 2, button.y + 27);
    ctx.textAlign = 'left';
  }

  function drawPauseOverlay(ctx, canvas, state) {
    if (!state.pause || !state.pause.open) return;

    const layout = getPauseLayout(canvas, state);
    ctx.fillStyle = 'rgba(0,0,0,0.68)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = 'rgba(22,18,14,0.97)';
    ctx.fillRect(layout.panel.x, layout.panel.y, layout.panel.w, layout.panel.h);
    ctx.strokeStyle = 'rgba(255,255,255,0.22)';
    ctx.lineWidth = 2;
    ctx.strokeRect(layout.panel.x, layout.panel.y, layout.panel.w, layout.panel.h);

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 28px Arial';
    ctx.fillText('Пауза', layout.panel.x + 28, layout.panel.y + 42);

    if (state.pause.confirmRestart) {
      ctx.font = '16px Arial';
      ctx.fillText('Вы точно хотите перезапустить?', layout.panel.x + 28, layout.panel.y + 94);
      ctx.fillText('Текущий сейв будет удалён.', layout.panel.x + 28, layout.panel.y + 120);
    } else if (state.pause.showControls) {
      const touchMode = !!(state.ui && state.ui.controlMode === 'touch');
      ctx.font = '15px Arial';
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      if (touchMode) {
        ctx.fillText('Телефон:', layout.panel.x + 28, layout.panel.y + 74);
        ctx.fillText('< / ^ / v / > — движение и прыжок', layout.panel.x + 28, layout.panel.y + 100);
        ctx.fillText('Тап по миру — взаимодействие', layout.panel.x + 28, layout.panel.y + 124);
        ctx.fillText('Удержание — копание блока', layout.panel.x + 28, layout.panel.y + 148);
        ctx.fillText('Тап по хотбару — выбрать слот', layout.panel.x + 28, layout.panel.y + 172);
        ctx.fillText('Инв. / Еда / Пауза — справа', layout.panel.x + 28, layout.panel.y + 196);
        ctx.fillText('Два пальца — аналог ПКМ в окне', layout.panel.x + 28, layout.panel.y + 220);
      } else {
        ctx.fillText('Компьютер:', layout.panel.x + 28, layout.panel.y + 74);
        ctx.fillText('A / D — идти', layout.panel.x + 28, layout.panel.y + 100);
        ctx.fillText('W / Пробел — прыгать / всплывать', layout.panel.x + 28, layout.panel.y + 124);
        ctx.fillText('ЛКМ по миру — ломать, ставить, бить', layout.panel.x + 28, layout.panel.y + 148);
        ctx.fillText('1..9 — выбор слота хотбара', layout.panel.x + 28, layout.panel.y + 172);
        ctx.fillText('E — съесть еду, Y — инвентарь', layout.panel.x + 28, layout.panel.y + 196);
        ctx.fillText('Esc — пауза', layout.panel.x + 28, layout.panel.y + 220);
      }
    } else {
      ctx.font = '15px Arial';
      ctx.fillStyle = 'rgba(255,255,255,0.82)';
      ctx.fillText('Escape закрывает меню и возвращает в игру.', layout.panel.x + 28, layout.panel.y + 70);
      if (state.pause.statusText) {
        ctx.fillStyle = '#8cff8c';
        ctx.fillText(state.pause.statusText, layout.panel.x + 28, layout.panel.y + layout.panel.h - 20);
      }
    }

    for (const button of layout.buttons) drawButton(ctx, button);
  }

  Game.pauseRenderer = { getPauseLayout, drawPauseOverlay };
})();
