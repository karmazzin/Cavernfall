(() => {
  const Game = window.MC2D;
  const { VIEW_ZOOM } = Game.constants;

  function resolveSpeaker(state, ref) {
    if (!ref) return null;
    const list = state[ref.listKey];
    if (!Array.isArray(list)) return null;
    return list.find((entry) => entry && entry.id === ref.id) || (Number.isFinite(ref.index) ? list[ref.index] : null);
  }

  function wrapText(ctx, text, maxWidth) {
    const words = String(text || '').split(/\s+/).filter(Boolean);
    const lines = [];
    let line = '';
    for (const word of words) {
      const next = line ? `${line} ${word}` : word;
      if (ctx.measureText(next).width <= maxWidth || !line) {
        line = next;
      } else {
        lines.push(line);
        line = word;
      }
    }
    if (line) lines.push(line);
    return lines.slice(0, 3);
  }

  function roundRect(ctx, x, y, w, h, r) {
    const radius = Math.max(0, Math.min(r, w / 2, h / 2));
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + w - radius, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
    ctx.lineTo(x + w, y + h - radius);
    ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
    ctx.lineTo(x + radius, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  }

  function rectsOverlap(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  function drawSpeechBubbles(ctx, canvas, state, camera) {
    if (!Array.isArray(state.speechBubbles) || state.speechBubbles.length === 0) return;
    ctx.save();
    ctx.font = '12px Arial';
    ctx.textBaseline = 'top';
    const placed = [];
    for (const bubble of state.speechBubbles) {
      const speaker = resolveSpeaker(state, bubble.speakerRef);
      const worldX = speaker ? speaker.x + (speaker.w || 12) / 2 : bubble.x;
      const worldY = speaker ? speaker.y : bubble.y;
      const screenX = (worldX - camera.x) * VIEW_ZOOM;
      const screenY = (worldY - camera.y) * VIEW_ZOOM;
      if (screenX < -80 || screenX > canvas.width + 80 || screenY < -80 || screenY > canvas.height + 80) continue;
      const alpha = Math.max(0, Math.min(1, bubble.timer / Math.min(0.8, bubble.maxTimer || 3.4)));
      const maxTextW = Math.min(210, Math.max(130, canvas.width - 32));
      const cacheKey = `${bubble.text}|${maxTextW}`;
      if (!bubble.renderCache || bubble.renderCache.key !== cacheKey) {
        const lines = wrapText(ctx, bubble.text, maxTextW);
        bubble.renderCache = {
          key: cacheKey,
          lines,
          textW: Math.max(...lines.map((line) => ctx.measureText(line).width), 40),
        };
      }
      const { lines, textW } = bubble.renderCache;
      const padX = 9;
      const padY = 7;
      const boxW = Math.ceil(textW + padX * 2);
      const boxH = lines.length * 15 + padY * 2;
      let x = Math.round(screenX - boxW / 2);
      let y = Math.round(screenY - boxH - 12);
      x = Math.max(8, Math.min(canvas.width - boxW - 8, x));
      y = Math.max(8, Math.min(canvas.height - boxH - 8, y));
      let rect = { x, y, w: boxW, h: boxH };
      let attempts = 0;
      while (placed.some((entry) => rectsOverlap(rect, entry)) && attempts < 5) {
        y = Math.max(8, y - boxH - 6);
        rect = { x, y, w: boxW, h: boxH };
        attempts += 1;
      }
      placed.push(rect);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = bubble.priority === 'danger' ? 'rgba(54,20,20,0.9)' : 'rgba(18,22,28,0.88)';
      roundRect(ctx, x, y, boxW, boxH, 6);
      ctx.fill();
      ctx.strokeStyle = bubble.priority === 'danger' ? 'rgba(255,155,120,0.72)' : 'rgba(255,255,255,0.28)';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = '#f5f1e8';
      for (let i = 0; i < lines.length; i += 1) {
        ctx.fillText(lines[i], x + padX, y + padY + i * 15);
      }
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }

  Game.speechRenderer = { drawSpeechBubbles };
})();
