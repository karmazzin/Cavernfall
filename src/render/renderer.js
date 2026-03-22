(() => {
  const Game = window.MC2D;
  const { TILE, CYCLE } = Game.constants;
  const { BLOCK } = Game.blocks;
  const { clamp } = Game.math;
  const { getBlock, getLocationInfo } = Game.world;
  const { phaseInfo } = Game.dayCycle;
  const { drawBlock } = Game.worldRenderer;
  const { drawItem } = Game.itemRenderer;
  const { drawUI } = Game.uiRenderer;
  const { drawCraftingOverlay } = Game.craftingRenderer;
  const { drawPauseOverlay } = Game.pauseRenderer;
  const { getLightSourcesInView } = Game.furnaceSystem;

  let darknessMaskCanvas = null;
  let darknessMaskCtx = null;

  function ensureDarknessMask(canvas) {
    if (!darknessMaskCanvas) {
      darknessMaskCanvas = document.createElement('canvas');
      darknessMaskCtx = darknessMaskCanvas.getContext('2d');
    }
    if (darknessMaskCanvas.width !== canvas.width || darknessMaskCanvas.height !== canvas.height) {
      darknessMaskCanvas.width = canvas.width;
      darknessMaskCanvas.height = canvas.height;
    }
    return darknessMaskCtx;
  }

  function applyLight(ctx, x, y, innerRadius, radius, strength = 1) {
    const safeStrength = clamp(strength, 0.35, 1.2);
    const light = ctx.createRadialGradient(x, y, innerRadius, x, y, radius);
    light.addColorStop(0, `rgba(0,0,0,${0.98 * safeStrength})`);
    light.addColorStop(0.35, `rgba(0,0,0,${0.68 * safeStrength})`);
    light.addColorStop(0.72, `rgba(0,0,0,${0.22 * safeStrength})`);
    light.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = light;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawDarknessMask(ctx, canvas, state, camera, location, darkness) {
    const maskCtx = ensureDarknessMask(canvas);
    maskCtx.clearRect(0, 0, canvas.width, canvas.height);
    maskCtx.globalCompositeOperation = 'source-over';
    maskCtx.fillStyle = `rgba(0, 0, 0, ${darkness})`;
    maskCtx.fillRect(0, 0, canvas.width, canvas.height);

    const lightX = state.player.x - camera.x + state.player.w / 2;
    const lightY = state.player.y - camera.y + state.player.h / 2;
    const heldItem = state.player.hotbar[state.player.selectedSlot];
    const holdingTorch = heldItem && heldItem.id === BLOCK.TORCH;
    const baseRadius = location.inCave ? 205 : 255;
    const baseStrength = location.inCave ? 0.78 : 0.62;
    const heldTorchRadius = holdingTorch ? (location.inCave ? 310 : 350) : 0;
    const heldTorchStrength = location.inCave ? 1 : 0.92;
    const worldLights = getLightSourcesInView(state, camera, canvas);

    maskCtx.save();
    maskCtx.globalCompositeOperation = 'destination-out';
    applyLight(maskCtx, lightX, lightY, 28, baseRadius, baseStrength);
    if (heldTorchRadius > 0) applyLight(maskCtx, lightX, lightY, 38, heldTorchRadius, heldTorchStrength);
    for (const light of worldLights) {
      applyLight(maskCtx, light.x, light.y, light.inner, light.radius, light.strength || 1);
    }
    maskCtx.restore();

    ctx.drawImage(darknessMaskCanvas, 0, 0);
  }

  function draw(ctx, canvas, state, camera, input) {
    const phase = phaseInfo(state);
    const playerTileX = Math.floor((state.player.x + state.player.w / 2) / TILE);
    const playerTileY = Math.floor((state.player.y + state.player.h / 2) / TILE);
    const location = getLocationInfo(state, playerTileX, playerTileY);
    const caveDarkness = location.inCave ? 0.72 : 0;
    const darkness = Math.max(phase.darkness, caveDarkness);
    const skyTop = phase.phase === 'night'
      ? '#08111f'
      : phase.phase === 'sunset'
        ? '#ff9a5a'
        : phase.phase === 'sunrise'
          ? '#ffbf75'
          : '#7ec8ff';
    const skyBottom = phase.phase === 'night' ? '#13243d' : '#cfefff';
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, skyTop);
    gradient.addColorStop(1, skyBottom);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const skyProgress = (state.cycleTime % CYCLE) / CYCLE;
    const celestialX = canvas.width * skyProgress;
    const celestialY = 80 + Math.sin(skyProgress * Math.PI) * -140;
    ctx.beginPath();
    ctx.fillStyle = phase.phase === 'night' ? '#e9edf5' : '#ffd84d';
    ctx.arc(celestialX, celestialY, 24, 0, Math.PI * 2);
    ctx.fill();

    const startX = Math.floor(camera.x / TILE);
    const endX = Math.ceil((camera.x + canvas.width) / TILE);
    const startY = Math.floor(camera.y / TILE);
    const endY = Math.ceil((camera.y + canvas.height) / TILE);

    for (let y = startY; y <= endY; y += 1) {
      for (let x = startX; x <= endX; x += 1) {
        const id = getBlock(state, x, y);
        if (id !== BLOCK.AIR) drawBlock(ctx, id, x * TILE - camera.x, y * TILE - camera.y);
      }
    }

    if (state.breaking) {
      const px = state.breaking.tx * TILE - camera.x;
      const py = state.breaking.ty * TILE - camera.y;
      const ratio = clamp(state.breaking.progress / state.breaking.need, 0, 1);
      ctx.strokeStyle = 'rgba(255,255,255,0.9)';
      ctx.lineWidth = 2;
      ctx.strokeRect(px + 1, py + 1, TILE - 2, TILE - 2);
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.fillRect(px + 2, py + TILE - 4, (TILE - 4) * ratio, 2);
    }

    for (const food of state.foods) {
      if (food.itemId != null) drawItem(ctx, food.itemId, food.x - camera.x, food.y - camera.y, 14);
      else {
        ctx.fillStyle = '#d88b39';
        ctx.fillRect(food.x - camera.x, food.y - camera.y, food.w, food.h);
        ctx.fillStyle = '#7a3c0b';
        ctx.fillRect(food.x - camera.x + 2, food.y - camera.y + 2, 4, 4);
      }
    }

    for (const animal of state.animals) {
      ctx.fillStyle = '#fff5df';
      const bodyY = animal.y - camera.y + (animal.grazing ? 1 : 0);
      const headY = animal.y - camera.y + (animal.grazing ? 4 : 2);
      ctx.fillRect(animal.x - camera.x, bodyY, animal.w, animal.h);
      ctx.fillStyle = '#3a2d20';
      ctx.fillRect(animal.x - camera.x + (animal.dir > 0 ? 8 : 2), headY, 2, 2);
    }

    for (const zombie of state.zombies) {
      ctx.fillStyle = '#4b8f4b';
      ctx.fillRect(zombie.x - camera.x, zombie.y - camera.y, zombie.w, zombie.h);
      ctx.fillStyle = '#203020';
      ctx.fillRect(zombie.x - camera.x + 2, zombie.y - camera.y + 3, 2, 2);
      ctx.fillRect(zombie.x - camera.x + 8, zombie.y - camera.y + 3, 2, 2);
    }

    for (const spider of state.spiders) {
      ctx.fillStyle = '#1b1b1f';
      ctx.fillRect(spider.x - camera.x, spider.y - camera.y + 2, spider.w, spider.h - 2);
      ctx.fillStyle = '#a32626';
      ctx.fillRect(spider.x - camera.x + 3, spider.y - camera.y + 4, 2, 2);
      ctx.fillRect(spider.x - camera.x + 9, spider.y - camera.y + 4, 2, 2);
    }

    ctx.fillStyle = '#4aa3ff';
    ctx.fillRect(state.player.x - camera.x, state.player.y - camera.y, state.player.w, state.player.h);
    ctx.fillStyle = '#ffe0bd';
    ctx.fillRect(state.player.x - camera.x + 1, state.player.y - camera.y, 10, 8);

    if (darkness > 0) {
      drawDarknessMask(ctx, canvas, state, camera, location, darkness);
    }

    if (state.attackFlash > 0) {
      ctx.fillStyle = `rgba(255,0,0,${state.attackFlash * 0.5})`;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    drawUI(ctx, canvas, state, phase);
    drawCraftingOverlay(ctx, canvas, state, input);
    drawPauseOverlay(ctx, canvas, state);

    if (state.gameOver) {
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'center';
      const touchMode = !!(state.ui && state.ui.controlMode === 'touch');
      ctx.font = `bold ${touchMode ? 34 : 42}px Arial`;
      ctx.fillText('КОНЕЦ ИГРЫ', canvas.width / 2, canvas.height / 2 - 10);
      ctx.font = `${touchMode ? 18 : 20}px Arial`;
      ctx.fillText(touchMode ? 'Тап по экрану, чтобы начать заново' : 'Нажми R, чтобы начать заново', canvas.width / 2, canvas.height / 2 + 30);
      ctx.textAlign = 'left';
    }
  }

  Game.renderer = { draw };
})();
