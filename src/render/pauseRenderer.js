(() => {
  const Game = window.MC2D;

  function getPauseLayout(canvas, state) {
    const panel = {
      w: 360,
      h: state.pause.confirmRestart ? 260 : 240,
      x: Math.floor((canvas.width - 360) / 2),
      y: Math.floor((canvas.height - (state.pause.confirmRestart ? 260 : 240)) / 2),
    };

    if (state.pause.confirmRestart) {
      return {
        panel,
        buttons: [
          { id: 'restart_yes', label: 'Да', x: panel.x + 30, y: panel.y + 176, w: 130, h: 42 },
          { id: 'restart_no', label: 'Нет', x: panel.x + 200, y: panel.y + 176, w: 130, h: 42 },
        ],
      };
    }

    return {
      panel,
      buttons: [
        { id: 'continue', label: 'Продолжить', x: panel.x + 30, y: panel.y + 92, w: 300, h: 42 },
        { id: 'save', label: 'Сохранить', x: panel.x + 30, y: panel.y + 144, w: 300, h: 42 },
        { id: 'restart', label: 'Перезапустить', x: panel.x + 30, y: panel.y + 196, w: 300, h: 42 },
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
