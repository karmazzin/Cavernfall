(() => {
  const Game = window.MC2D;
  const { TILE } = Game.constants;

  function drawMountain(ctx, canvas, color, peaks, baseY) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, canvas.height);
    const step = canvas.width / (peaks.length - 1);
    for (let i = 0; i < peaks.length; i += 1) {
      ctx.lineTo(i * step, peaks[i]);
    }
    ctx.lineTo(canvas.width, canvas.height);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    for (let i = 0; i < peaks.length - 1; i += 1) {
      const x = i * step;
      const y = peaks[i];
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + step * 0.5, y - 28);
      ctx.lineTo(x + step, peaks[i + 1]);
      ctx.lineTo(x + step, baseY);
      ctx.lineTo(x, baseY);
      ctx.closePath();
      ctx.fill();
    }
  }

  function drawMenuBackground(ctx, canvas, state) {
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, '#0f1d2a');
    gradient.addColorStop(0.5, '#204060');
    gradient.addColorStop(1, '#5e7f5a');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    drawMountain(ctx, canvas, '#1a2431', [canvas.height * 0.64, canvas.height * 0.38, canvas.height * 0.58, canvas.height * 0.32, canvas.height * 0.6, canvas.height * 0.44], canvas.height);
    drawMountain(ctx, canvas, '#253525', [canvas.height * 0.78, canvas.height * 0.56, canvas.height * 0.72, canvas.height * 0.5, canvas.height * 0.76, canvas.height * 0.62], canvas.height);

    const lavaGradient = ctx.createRadialGradient(canvas.width * 0.74, canvas.height * 0.76, 10, canvas.width * 0.74, canvas.height * 0.76, 180);
    lavaGradient.addColorStop(0, 'rgba(255,156,72,0.85)');
    lavaGradient.addColorStop(0.35, 'rgba(255,96,24,0.4)');
    lavaGradient.addColorStop(1, 'rgba(255,96,24,0)');
    ctx.fillStyle = lavaGradient;
    ctx.beginPath();
    ctx.arc(canvas.width * 0.74, canvas.height * 0.76, 180, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#1f1c19';
    ctx.fillRect(0, canvas.height * 0.82, canvas.width, canvas.height * 0.18);

    for (let i = 0; i < 20; i += 1) {
      const x = 24 + i * 34;
      const y = canvas.height * 0.82 - ((i % 3) * 6);
      ctx.fillStyle = i % 5 === 0 ? '#3b7a3f' : i % 4 === 0 ? '#7f7f85' : '#8d5a35';
      ctx.fillRect(x, y, TILE * 1.3, TILE * 1.3);
    }

    ctx.fillStyle = 'rgba(0,0,0,0.36)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  Game.menuRenderer = { drawMenuBackground };
})();
