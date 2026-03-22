(() => {
  const Game = window.MC2D;
  const { TILE, CYCLE, WORLD_W, WORLD_H, VIEW_ZOOM } = Game.constants;
  const { BLOCK } = Game.blocks;
  const { clamp } = Game.math;
  const { getBlock, getLocationInfo } = Game.world;
  const { phaseInfo } = Game.dayCycle;
  const { drawBlock } = Game.worldRenderer;
  const { drawItem } = Game.itemRenderer;
  const { drawPlayer, drawZombie, drawSpider, drawSheep, drawDwarf } = Game.entityRenderer;
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

  function applyLightCone(ctx, x, y, angle, spread, innerRadius, radius, strength = 1) {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.arc(x, y, radius, angle - spread / 2, angle + spread / 2);
    ctx.closePath();
    ctx.clip();
    applyLight(ctx, x, y, innerRadius, radius, strength);
    ctx.restore();
  }

  function drawDarknessMask(ctx, canvas, state, camera, input, location, darkness) {
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
    const nearRadius = location.inCave ? 58 : 68;
    const nearStrength = location.inCave ? 0.56 : 0.48;
    const heldTorchRadius = holdingTorch ? (location.inCave ? 310 : 350) : 0;
    const heldTorchStrength = location.inCave ? 1 : 0.92;
    const worldLights = getLightSourcesInView(state, camera, canvas);
    const touchMode = !!(state.ui && state.ui.controlMode === 'touch');
    const cursorX = input && input.mouse ? input.mouse.x / VIEW_ZOOM : lightX + state.player.dir * 32;
    const cursorY = input && input.mouse ? input.mouse.y / VIEW_ZOOM : lightY;
    const lookAngle = Math.atan2(cursorY - lightY, cursorX - lightX);
    const coneSpread = Math.PI * 0.4089;

    maskCtx.save();
    maskCtx.globalCompositeOperation = 'destination-out';
    applyLight(maskCtx, lightX, lightY, 22, nearRadius, nearStrength);
    if (holdingTorch || touchMode) applyLight(maskCtx, lightX, lightY, 28, baseRadius, baseStrength);
    else applyLightCone(maskCtx, lightX, lightY, lookAngle, coneSpread, 30, baseRadius, baseStrength);
    if (heldTorchRadius > 0) applyLight(maskCtx, lightX, lightY, 38, heldTorchRadius, heldTorchStrength);
    for (const light of worldLights) {
      applyLight(maskCtx, light.x, light.y, light.inner, light.radius, light.strength || 1);
    }
    maskCtx.restore();

    ctx.drawImage(darknessMaskCanvas, 0, 0);
  }

  function getHoveredChest(state, camera, input, canvas) {
    if (!input.mouse || state.pause.open || state.crafting.open || state.gameOver) return null;
    if (state.ui && state.ui.controlMode === 'touch') return null;
    if (input.mouse.x < 0 || input.mouse.y < 0 || input.mouse.x > canvas.width || input.mouse.y > canvas.height) return null;
    const tx = Math.floor((input.mouse.x / VIEW_ZOOM + camera.x) / TILE);
    const ty = Math.floor((input.mouse.y / VIEW_ZOOM + camera.y) / TILE);
    if (tx < 0 || ty < 0 || tx >= WORLD_W || ty >= WORLD_H) return null;
    if (getBlock(state, tx, ty) !== BLOCK.CHEST) return null;
    const dist = Math.hypot(
      tx * TILE + TILE / 2 - (state.player.x + state.player.w / 2),
      ty * TILE + TILE / 2 - (state.player.y + state.player.h / 2)
    );
    if (dist > 110) return null;
    return { tx, ty, sx: tx * TILE - camera.x, sy: ty * TILE - camera.y };
  }

  function drawChestHint(ctx, chest) {
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 225, 150, 0.95)';
    ctx.lineWidth = 2;
    ctx.strokeRect(chest.sx + 1, chest.sy + 1, TILE - 2, TILE - 2);
    ctx.fillStyle = 'rgba(255, 215, 120, 0.14)';
    ctx.fillRect(chest.sx + 1, chest.sy + 1, TILE - 2, TILE - 2);

    const label = 'Открыть сундук';
    ctx.font = '12px Arial';
    const textW = ctx.measureText(label).width;
    const boxW = textW + 12;
    const boxH = 20;
    const boxX = chest.sx + TILE / 2 - boxW / 2;
    const boxY = chest.sy - 24;
    ctx.fillStyle = 'rgba(15, 12, 8, 0.9)';
    ctx.fillRect(boxX, boxY, boxW, boxH);
    ctx.strokeStyle = 'rgba(255, 220, 150, 0.65)';
    ctx.lineWidth = 1;
    ctx.strokeRect(boxX + 0.5, boxY + 0.5, boxW - 1, boxH - 1);
    ctx.fillStyle = '#fff2cf';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, chest.sx + TILE / 2, boxY + boxH / 2 + 0.5);
    ctx.restore();
  }

  function draw(ctx, canvas, state, camera, input) {
    const time = performance.now() / 1000;
    const view = { width: canvas.width / VIEW_ZOOM, height: canvas.height / VIEW_ZOOM };
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

    ctx.save();
    ctx.scale(VIEW_ZOOM, VIEW_ZOOM);

    const startX = Math.max(0, Math.floor(camera.x / TILE));
    const endX = Math.min(WORLD_W - 1, Math.ceil((camera.x + view.width) / TILE));
    const startY = Math.max(0, Math.floor(camera.y / TILE));
    const endY = Math.min(WORLD_H - 1, Math.ceil((camera.y + view.height) / TILE));

    for (let y = startY; y <= endY; y += 1) {
      for (let x = startX; x <= endX; x += 1) {
        const id = getBlock(state, x, y);
        if (id !== BLOCK.AIR) drawBlock(ctx, id, x * TILE - camera.x, y * TILE - camera.y, time);
      }
    }

    const hoveredChest = getHoveredChest(state, camera, input, canvas);
    if (hoveredChest) drawChestHint(ctx, hoveredChest);

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

    for (const animal of state.animals) drawSheep(ctx, animal, camera, time);
    for (const zombie of state.zombies) drawZombie(ctx, zombie, camera, time);
    for (const spider of state.spiders) drawSpider(ctx, spider, camera, time);
    for (const dwarf of state.dwarves || []) drawDwarf(ctx, state, dwarf, camera, time);

    drawPlayer(ctx, state, camera, time);

    if (darkness > 0) drawDarknessMask(ctx, view, state, camera, input, location, darkness);

    ctx.restore();

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
