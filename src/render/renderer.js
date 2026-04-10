(() => {
  const Game = window.MC2D;
  const { TILE, CYCLE, WORLD_W, WORLD_H, VIEW_ZOOM } = Game.constants;
  const { BLOCK } = Game.blocks;
  const { clamp } = Game.math;
  const { getBlock, getLocationInfo } = Game.world;
  const { ITEM } = Game.items;
  const { countItem } = Game.inventory;
  const { phaseInfo } = Game.dayCycle;
  const { getWeatherState, WEATHER } = Game.weatherSystem;
  const { drawBlock, drawDoor, drawDungeonSeal } = Game.worldRenderer;
  const { drawItem } = Game.itemRenderer;
  const { drawPlayer, drawZombie, drawSpider, drawSheep, drawHuman, drawDwarf, drawFireGuard, drawFireBoss, drawFireKing, drawFriendlyFireKing, drawKraken, drawBossHealthBar } = Game.entityRenderer;
  const { drawUI } = Game.uiRenderer;
  const { drawCraftingOverlay } = Game.craftingRenderer;
  const { drawPauseOverlay } = Game.pauseRenderer;
  const { getLightSourcesInView } = Game.furnaceSystem;
  const { getDoorAt } = Game.doorSystem;
  const { findUsablePortal } = Game.portalSystem;
  const { findUsablePillow, findUsableWaterCrystal, hasAllFriendshipTools } = Game.interaction;

  let darknessMaskCanvas = null;
  let darknessMaskCtx = null;

  function weatherTint(type, intensity) {
    const a = clamp(intensity, 0, 1);
    if (type === WEATHER.RAIN) return `rgba(48,78,118,${0.14 * a})`;
    if (type === WEATHER.SNOW) return `rgba(220,235,255,${0.12 * a})`;
    if (type === WEATHER.SANDSTORM) return `rgba(210,170,96,${0.22 * a})`;
    if (type === WEATHER.FOG) return `rgba(210,220,230,${0.18 * a})`;
    if (type === WEATHER.ASHFALL) return `rgba(96,66,58,${0.22 * a})`;
    if (type === WEATHER.BLIZZARD) return `rgba(232,240,255,${0.18 * a})`;
    if (type === WEATHER.HEAT_HAZE) return `rgba(255,180,108,${0.12 * a})`;
    return null;
  }

  function weatherCelestialAlpha(type, intensity) {
    if (type === WEATHER.CLEAR) return 1;
    if (type === WEATHER.FOG) return 1 - intensity * 0.8;
    if (type === WEATHER.SANDSTORM || type === WEATHER.BLIZZARD) return 1 - intensity * 0.92;
    return 1 - intensity * 0.65;
  }

  function drawRain(ctx, canvas, time, intensity) {
    const count = Math.floor(110 + intensity * 150);
    ctx.save();
    ctx.strokeStyle = `rgba(180,210,255,${0.3 + intensity * 0.3})`;
    ctx.lineWidth = 1.2;
    for (let i = 0; i < count; i += 1) {
      const x = (i * 29 + time * 520) % (canvas.width + 40) - 20;
      const y = (i * 53 + time * 740) % (canvas.height + 80) - 40;
      const len = 9 + intensity * 7;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - 4 - intensity * 3, y + len);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawSnow(ctx, canvas, time, intensity, blizzard = false) {
    const count = Math.floor((blizzard ? 150 : 85) + intensity * (blizzard ? 160 : 110));
    ctx.save();
    ctx.fillStyle = `rgba(255,255,255,${0.46 + intensity * 0.28})`;
    for (let i = 0; i < count; i += 1) {
      const wind = blizzard ? 34 : 12;
      const x = (i * 37 + time * (35 + wind) + Math.sin(i * 13.1 + time * 0.9) * wind) % (canvas.width + 48) - 24;
      const y = (i * 61 + time * (70 + intensity * 55)) % (canvas.height + 48) - 24;
      const r = blizzard ? 1.2 + (i % 3) * 0.4 : 1 + (i % 4) * 0.35;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawSandstorm(ctx, canvas, time, intensity) {
    const count = Math.floor(120 + intensity * 180);
    ctx.save();
    ctx.fillStyle = `rgba(228,196,122,${0.08 + intensity * 0.1})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = `rgba(236,210,150,${0.2 + intensity * 0.22})`;
    ctx.lineWidth = 1.4;
    for (let i = 0; i < count; i += 1) {
      const x = (i * 41 + time * (220 + intensity * 260)) % (canvas.width + 90) - 45;
      const y = (i * 23 + Math.sin(time * 0.7 + i) * 18 + time * 12) % (canvas.height + 24) - 12;
      const len = 10 + intensity * 16;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + len, y + randSign(i) * 1.2);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawFog(ctx, canvas, time, intensity) {
    const layers = 6;
    ctx.save();
    ctx.fillStyle = `rgba(230,236,242,${0.05 + intensity * 0.08})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    for (let i = 0; i < layers; i += 1) {
      const y = canvas.height * (0.12 + i * 0.15) + Math.sin(time * 0.22 + i * 1.7) * 18;
      const h = 48 + intensity * 42 + i * 6;
      const grad = ctx.createLinearGradient(0, y, 0, y + h);
      grad.addColorStop(0, `rgba(232,238,246,0)`);
      grad.addColorStop(0.45, `rgba(232,238,246,${0.05 + intensity * 0.08})`);
      grad.addColorStop(1, `rgba(232,238,246,0)`);
      ctx.fillStyle = grad;
      ctx.fillRect(0, y, canvas.width, h);
    }
    ctx.restore();
  }

  function drawAshfall(ctx, canvas, time, intensity) {
    const count = Math.floor(70 + intensity * 120);
    ctx.save();
    ctx.fillStyle = `rgba(255,122,74,${0.05 + intensity * 0.05})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = `rgba(70,54,52,${0.28 + intensity * 0.24})`;
    for (let i = 0; i < count; i += 1) {
      const x = (i * 43 + Math.sin(time * 0.6 + i) * 22 + time * 28) % (canvas.width + 40) - 20;
      const y = (i * 67 + time * (42 + intensity * 24)) % (canvas.height + 40) - 20;
      const w = 2 + (i % 3);
      const h = 2 + ((i + 1) % 3);
      ctx.fillRect(x, y, w, h);
    }
    ctx.restore();
  }

  function drawHeatHaze(ctx, canvas, time, intensity) {
    const bands = 8;
    ctx.save();
    ctx.fillStyle = `rgba(255,186,118,${0.04 + intensity * 0.04})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    for (let i = 0; i < bands; i += 1) {
      const y = canvas.height * (i / bands) + Math.sin(time * 0.9 + i * 1.4) * 9;
      const h = 20 + intensity * 16;
      const x = Math.sin(time * 0.55 + i * 0.8) * 18;
      const grad = ctx.createLinearGradient(x, y, canvas.width + x, y + h);
      grad.addColorStop(0, `rgba(255,200,140,0)`);
      grad.addColorStop(0.5, `rgba(255,200,140,${0.04 + intensity * 0.05})`);
      grad.addColorStop(1, `rgba(255,200,140,0)`);
      ctx.fillStyle = grad;
      ctx.fillRect(-24, y, canvas.width + 48, h);
    }
    ctx.restore();
  }

  function randSign(i) {
    return i % 2 === 0 ? -1 : 1;
  }

  function drawWeatherOverlay(ctx, canvas, weather, time) {
    const intensity = clamp(weather.intensity, 0, 1);
    if (intensity <= 0.02 || weather.type === WEATHER.CLEAR) return;
    if (weather.type === WEATHER.RAIN) drawRain(ctx, canvas, time, intensity);
    else if (weather.type === WEATHER.SNOW) drawSnow(ctx, canvas, time, intensity, false);
    else if (weather.type === WEATHER.SANDSTORM) drawSandstorm(ctx, canvas, time, intensity);
    else if (weather.type === WEATHER.FOG) drawFog(ctx, canvas, time, intensity);
    else if (weather.type === WEATHER.ASHFALL) drawAshfall(ctx, canvas, time, intensity);
    else if (weather.type === WEATHER.BLIZZARD) {
      drawFog(ctx, canvas, time, intensity * 0.72);
      drawSnow(ctx, canvas, time, intensity, true);
    } else if (weather.type === WEATHER.HEAT_HAZE) drawHeatHaze(ctx, canvas, time, intensity);
  }

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
    if (state.worldMeta && state.worldMeta.mode === 'spectator') return null;
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

  function getHoveredHuman(state, camera, input, canvas) {
    if (!input.mouse || state.pause.open || state.crafting.open || state.gameOver) return null;
    if (state.worldMeta && state.worldMeta.mode === 'spectator') return null;
    if (state.ui && state.ui.controlMode === 'touch') return null;
    const wx = input.mouse.x / VIEW_ZOOM + camera.x;
    const wy = input.mouse.y / VIEW_ZOOM + camera.y;
    for (const human of state.humans || []) {
      if (human.role === 'guard') continue;
      if (wx >= human.x && wx <= human.x + human.w && wy >= human.y && wy <= human.y + human.h) {
        const dist = Math.hypot(human.x - state.player.x, human.y - state.player.y);
        if (dist <= 110) return human;
      }
    }
    return null;
  }

  function getHoveredPortal(state, camera, input, canvas) {
    if (!input.mouse || state.pause.open || state.crafting.open || state.gameOver) return null;
    if (state.worldMeta && state.worldMeta.mode === 'spectator') return null;
    if (state.ui && state.ui.controlMode === 'touch') return null;
    if (input.mouse.x < 0 || input.mouse.y < 0 || input.mouse.x > canvas.width || input.mouse.y > canvas.height) return null;
    const target = findUsablePortal(state, input, camera);
    if (!target) return null;
    return { tx: target.tx, ty: target.ty, sx: target.tx * TILE - camera.x, sy: target.ty * TILE - camera.y };
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

  function drawHumanHint(ctx, human, camera) {
    const labels = (Game.tradeSystem && Game.tradeSystem.HUMAN_PROFESSION_LABELS) || {};
    const label = `${labels[human.profession] || 'Житель'}: торговать`;
    const sx = human.x - camera.x + human.w / 2;
    const sy = human.y - camera.y - 24;
    ctx.save();
    ctx.font = '12px Arial';
    const textW = ctx.measureText(label).width;
    const boxW = textW + 12;
    const boxH = 20;
    ctx.fillStyle = 'rgba(15, 12, 8, 0.9)';
    ctx.fillRect(sx - boxW / 2, sy, boxW, boxH);
    ctx.strokeStyle = 'rgba(160, 220, 255, 0.65)';
    ctx.lineWidth = 1;
    ctx.strokeRect(sx - boxW / 2 + 0.5, sy + 0.5, boxW - 1, boxH - 1);
    ctx.fillStyle = '#e6f7ff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, sx, sy + boxH / 2 + 0.5);
    ctx.restore();
  }

  function drawPortalHint(ctx, portal) {
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 140, 80, 0.95)';
    ctx.lineWidth = 2;
    ctx.strokeRect(portal.sx + 1, portal.sy + 1, TILE - 2, TILE - 2);
    ctx.fillStyle = 'rgba(255, 120, 64, 0.16)';
    ctx.fillRect(portal.sx + 1, portal.sy + 1, TILE - 2, TILE - 2);

    const label = 'Войти в портал';
    ctx.font = '12px Arial';
    const textW = ctx.measureText(label).width;
    const boxW = textW + 12;
    const boxH = 20;
    const boxX = portal.sx + TILE / 2 - boxW / 2;
    const boxY = portal.sy - 24;
    ctx.fillStyle = 'rgba(20, 10, 8, 0.92)';
    ctx.fillRect(boxX, boxY, boxW, boxH);
    ctx.strokeStyle = 'rgba(255, 160, 96, 0.65)';
    ctx.lineWidth = 1;
    ctx.strokeRect(boxX + 0.5, boxY + 0.5, boxW - 1, boxH - 1);
    ctx.fillStyle = '#ffe2c8';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, portal.sx + TILE / 2, boxY + boxH / 2 + 0.5);
    ctx.restore();
  }

  function getHoveredPillow(state, camera, input, canvas) {
    if (!input.mouse || state.pause.open || state.crafting.open || state.gameOver || state.player.sleeping) return null;
    if (state.worldMeta && state.worldMeta.mode === 'spectator') return null;
    if (state.ui && state.ui.controlMode === 'touch') return null;
    const target = findUsablePillow(state, input, camera);
    if (!target) return null;
    return { tx: target.tx, ty: target.ty, sx: target.tx * TILE - camera.x, sy: target.ty * TILE - camera.y };
  }

  function drawPillowHint(ctx, pillow) {
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 210, 220, 0.95)';
    ctx.lineWidth = 2;
    ctx.strokeRect(pillow.sx + 1, pillow.sy + 1, TILE - 2, TILE - 2);
    ctx.fillStyle = 'rgba(255, 214, 224, 0.16)';
    ctx.fillRect(pillow.sx + 1, pillow.sy + 1, TILE - 2, TILE - 2);
    const label = 'E: спать';
    ctx.font = '12px Arial';
    const textW = ctx.measureText(label).width;
    const boxW = textW + 12;
    const boxH = 20;
    const boxX = pillow.sx + TILE / 2 - boxW / 2;
    const boxY = pillow.sy - 24;
    ctx.fillStyle = 'rgba(24, 16, 18, 0.92)';
    ctx.fillRect(boxX, boxY, boxW, boxH);
    ctx.strokeStyle = 'rgba(255, 210, 220, 0.65)';
    ctx.lineWidth = 1;
    ctx.strokeRect(boxX + 0.5, boxY + 0.5, boxW - 1, boxH - 1);
    ctx.fillStyle = '#fff1f4';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, pillow.sx + TILE / 2, boxY + boxH / 2 + 0.5);
    ctx.restore();
  }

  function getHoveredDungeonSeal(state, camera, input, canvas) {
    if (!input.mouse || state.pause.open || state.crafting.open || state.gameOver) return null;
    if (state.worldMeta && state.worldMeta.mode === 'spectator') return null;
    if (state.ui && state.ui.controlMode === 'touch') return null;
    const dungeon = state.fireDungeon;
    if (state.activeDimension !== 'fire' || !dungeon || dungeon.released || !hasFireDungeonKey(state)) return null;
    const tx = Math.floor((input.mouse.x / VIEW_ZOOM + camera.x) / TILE);
    const ty = Math.floor((input.mouse.y / VIEW_ZOOM + camera.y) / TILE);
    if (tx !== dungeon.sealX || ty !== dungeon.sealY) return null;
    const dist = Math.hypot(
      tx * TILE + TILE / 2 - (state.player.x + state.player.w / 2),
      ty * TILE + TILE / 2 - (state.player.y + state.player.h / 2)
    );
    if (dist > 110) return null;
    return { tx, ty, sx: tx * TILE - camera.x, sy: ty * TILE - camera.y };
  }

  function drawDungeonSealHint(ctx, seal) {
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 130, 100, 0.95)';
    ctx.lineWidth = 2;
    ctx.strokeRect(seal.sx + 1, seal.sy + 1, TILE - 2, TILE - 2);
    ctx.fillStyle = 'rgba(255, 96, 64, 0.16)';
    ctx.fillRect(seal.sx + 1, seal.sy + 1, TILE - 2, TILE - 2);
    const label = 'E: снять печать';
    ctx.font = '12px Arial';
    const textW = ctx.measureText(label).width;
    const boxW = textW + 12;
    const boxH = 20;
    const boxX = seal.sx + TILE / 2 - boxW / 2;
    const boxY = seal.sy - 24;
    ctx.fillStyle = 'rgba(20, 10, 8, 0.92)';
    ctx.fillRect(boxX, boxY, boxW, boxH);
    ctx.strokeStyle = 'rgba(255, 160, 96, 0.65)';
    ctx.lineWidth = 1;
    ctx.strokeRect(boxX + 0.5, boxY + 0.5, boxW - 1, boxH - 1);
    ctx.fillStyle = '#ffe2c8';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, seal.sx + TILE / 2, boxY + boxH / 2 + 0.5);
    ctx.restore();
  }

  function getHoveredWaterCrystal(state, camera, input, canvas) {
    if (!input.mouse || state.pause.open || state.crafting.open || state.gameOver) return null;
    if (state.worldMeta && state.worldMeta.mode === 'spectator') return null;
    if (state.ui && state.ui.controlMode === 'touch') return null;
    const target = findUsableWaterCrystal(state, input, camera);
    if (!target) return null;
    return { tx: target.tx, ty: target.ty, sx: target.tx * TILE - camera.x, sy: target.ty * TILE - camera.y };
  }

  function drawWaterCrystalHint(ctx, crystal, canTake) {
    ctx.save();
    ctx.strokeStyle = 'rgba(122, 232, 255, 0.95)';
    ctx.lineWidth = 2;
    ctx.strokeRect(crystal.sx + 1, crystal.sy + 1, TILE - 2, TILE - 2);
    ctx.fillStyle = 'rgba(104, 215, 240, 0.16)';
    ctx.fillRect(crystal.sx + 1, crystal.sy + 1, TILE - 2, TILE - 2);
    const label = canTake ? 'E: взять Кристалл воды' : 'Нужны все инструменты дружбы';
    ctx.font = '12px Arial';
    const textW = ctx.measureText(label).width;
    const boxW = textW + 12;
    const boxH = 20;
    const boxX = crystal.sx + TILE / 2 - boxW / 2;
    const boxY = crystal.sy - 24;
    ctx.fillStyle = 'rgba(8, 16, 20, 0.92)';
    ctx.fillRect(boxX, boxY, boxW, boxH);
    ctx.strokeStyle = 'rgba(122, 232, 255, 0.65)';
    ctx.lineWidth = 1;
    ctx.strokeRect(boxX + 0.5, boxY + 0.5, boxW - 1, boxH - 1);
    ctx.fillStyle = '#e9fdff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, crystal.sx + TILE / 2, boxY + boxH / 2 + 0.5);
    ctx.restore();
  }

  function hasFireDungeonKey(state) {
    return countItem(state, ITEM.FIRE_DUNGEON_KEY) > 0;
  }

  function getVisibleBlockId(state, tx, ty, id) {
    if (state.activeDimension !== 'fire' || !state.fireDungeon || hasFireDungeonKey(state)) return id;
    const d = state.fireDungeon;
    if (tx < d.x0 || tx > d.x1 || ty < d.y0 || ty > d.y1) return id;
    return state.biomeAt[tx] === 'lava_lake' ? BLOCK.BASALT : BLOCK.RED_EARTH;
  }

  function drawFireDungeonGuide(ctx, canvas, state) {
    if (state.activeDimension !== 'fire' || !state.fireDungeon || !hasFireDungeonKey(state)) return;
    const d = state.fireDungeon;
    const dx = d.centerX * TILE + TILE / 2 - (state.player.x + state.player.w / 2);
    const dy = d.centerY * TILE + TILE / 2 - (state.player.y + state.player.h / 2);
    const angle = Math.atan2(dy, dx);
    const cx = canvas.width / 2;
    const cy = 52;
    const len = 26;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);
    ctx.fillStyle = 'rgba(25,12,8,0.88)';
    ctx.fillRect(-52, -12, 104, 24);
    ctx.strokeStyle = 'rgba(255,145,90,0.55)';
    ctx.strokeRect(-51.5, -11.5, 103, 23);
    ctx.fillStyle = '#ffb982';
    ctx.beginPath();
    ctx.moveTo(len, 0);
    ctx.lineTo(-10, -7);
    ctx.lineTo(-10, 7);
    ctx.closePath();
    ctx.fill();
    ctx.fillRect(-34, -2, 22, 4);
    ctx.restore();
    ctx.fillStyle = '#ffe3ca';
    ctx.font = '12px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Ключ указывает на огненную темницу', cx, cy + 22);
    ctx.textAlign = 'left';
  }

  function draw(ctx, canvas, state, camera, input) {
    const time = performance.now() / 1000;
    const quake = state.quake;
    const quakeStrength = quake ? Math.max(0, quake.strength || 0) * Math.min(1, (quake.timer || 0) / 1.1) : 0;
    const renderCamera = quakeStrength > 0.01
      ? {
          ...camera,
          x: camera.x + Math.sin(time * 42) * quakeStrength,
          y: camera.y + Math.cos(time * 37) * quakeStrength * 0.7,
        }
      : camera;
    const view = { width: canvas.width / VIEW_ZOOM, height: canvas.height / VIEW_ZOOM };
    const phase = phaseInfo(state);
    const weather = getWeatherState(state);
    const playerTileX = Math.floor((state.player.x + state.player.w / 2) / TILE);
    const playerTileY = Math.floor((state.player.y + state.player.h / 2) / TILE);
    const location = getLocationInfo(state, playerTileX, playerTileY);
    const inFireDimension = state.activeDimension === 'fire';
    const caveDarkness = inFireDimension ? 0.42 : location.inCave ? 0.72 : 0;
    const darkness = Math.max(phase.darkness, caveDarkness);
    const skyTop = inFireDimension
      ? '#070304'
      : phase.phase === 'night'
        ? '#08111f'
        : phase.phase === 'sunset'
          ? '#ff9a5a'
          : phase.phase === 'sunrise'
            ? '#ffbf75'
            : '#7ec8ff';
    const skyBottom = inFireDimension ? '#341017' : phase.phase === 'night' ? '#13243d' : '#cfefff';
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, skyTop);
    gradient.addColorStop(1, skyBottom);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const tint = weatherTint(weather.type, weather.intensity);
    if (tint) {
      ctx.fillStyle = tint;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    if (!inFireDimension) {
      const skyProgress = (state.cycleTime % CYCLE) / CYCLE;
      const celestialX = canvas.width * skyProgress;
      const celestialY = 80 + Math.sin(skyProgress * Math.PI) * -140;
      ctx.save();
      ctx.globalAlpha = weatherCelestialAlpha(weather.type, weather.intensity);
      ctx.beginPath();
      ctx.fillStyle = phase.phase === 'night' ? '#e9edf5' : '#ffd84d';
      ctx.arc(celestialX, celestialY, 24, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    ctx.save();
    ctx.scale(VIEW_ZOOM, VIEW_ZOOM);

    const startX = Math.max(0, Math.floor(renderCamera.x / TILE));
    const endX = Math.min(WORLD_W - 1, Math.ceil((renderCamera.x + view.width) / TILE));
    const startY = Math.max(0, Math.floor(renderCamera.y / TILE));
    const endY = Math.min(WORLD_H - 1, Math.ceil((renderCamera.y + view.height) / TILE));

    for (let y = startY; y <= endY; y += 1) {
      for (let x = startX; x <= endX; x += 1) {
        const id = getVisibleBlockId(state, x, y, getBlock(state, x, y));
        if (id === BLOCK.AIR) continue;
        const sx = x * TILE - renderCamera.x;
        const sy = y * TILE - renderCamera.y;
        if (
          id === BLOCK.FIRE_SEAL &&
          state.activeDimension === 'fire' &&
          state.fireDungeon &&
          x === state.fireDungeon.sealX &&
          y === state.fireDungeon.sealY
        ) {
          drawDungeonSeal(ctx, sx, sy, time);
        } else if (id === BLOCK.DOOR) {
          const door = getDoorAt(state, x, y);
          drawDoor(ctx, sx, sy, !!(door && door.open), !!(door && door.upper));
        } else {
          drawBlock(ctx, id, sx, sy, time);
        }
      }
    }

    const hoveredChest = getHoveredChest(state, renderCamera, input, canvas);
    const hoveredHuman = getHoveredHuman(state, renderCamera, input, canvas);
    const hoveredPortal = getHoveredPortal(state, renderCamera, input, canvas);
    const hoveredPillow = getHoveredPillow(state, renderCamera, input, canvas);
    const hoveredDungeonSeal = getHoveredDungeonSeal(state, renderCamera, input, canvas);
    const hoveredWaterCrystal = getHoveredWaterCrystal(state, renderCamera, input, canvas);
    if (hoveredChest) drawChestHint(ctx, hoveredChest);
    if (hoveredHuman) drawHumanHint(ctx, hoveredHuman, renderCamera);
    if (hoveredPortal) drawPortalHint(ctx, hoveredPortal);
    if (hoveredPillow) drawPillowHint(ctx, hoveredPillow);
    if (hoveredDungeonSeal) drawDungeonSealHint(ctx, hoveredDungeonSeal);
    if (hoveredWaterCrystal) drawWaterCrystalHint(ctx, hoveredWaterCrystal, hasAllFriendshipTools(state));

    if (state.breaking) {
      const px = state.breaking.tx * TILE - renderCamera.x;
      const py = state.breaking.ty * TILE - renderCamera.y;
      const ratio = clamp(state.breaking.progress / state.breaking.need, 0, 1);
      ctx.strokeStyle = 'rgba(255,255,255,0.9)';
      ctx.lineWidth = 2;
      ctx.strokeRect(px + 1, py + 1, TILE - 2, TILE - 2);
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.fillRect(px + 2, py + TILE - 4, (TILE - 4) * ratio, 2);
    }

    for (const food of state.foods) {
      if (food.itemId != null) drawItem(ctx, food.itemId, food.x - renderCamera.x, food.y - renderCamera.y, 14);
      else {
        ctx.fillStyle = '#d88b39';
        ctx.fillRect(food.x - renderCamera.x, food.y - renderCamera.y, food.w, food.h);
        ctx.fillStyle = '#7a3c0b';
        ctx.fillRect(food.x - renderCamera.x + 2, food.y - renderCamera.y + 2, 4, 4);
      }
    }

    for (const animal of state.animals) drawSheep(ctx, animal, renderCamera, time);
    for (const zombie of state.zombies) drawZombie(ctx, zombie, renderCamera, time);
    for (const spider of state.spiders) drawSpider(ctx, spider, renderCamera, time);
    for (const guard of state.fireGuards || []) drawFireGuard(ctx, guard, renderCamera, time);
    for (const human of state.humans || []) drawHuman(ctx, human, renderCamera, time);
    for (const dwarf of state.dwarves || []) drawDwarf(ctx, state, dwarf, renderCamera, time);
    if (state.friendlyFireKing) drawFriendlyFireKing(ctx, state.friendlyFireKing, renderCamera, time);
    if (state.fireBoss) drawFireBoss(ctx, state.fireBoss, renderCamera, time);
    if (state.fireBoss) drawBossHealthBar(ctx, state.fireBoss, renderCamera);
    if (state.fireKing) drawFireKing(ctx, state.fireKing, renderCamera, time);
    if (state.fireKing) drawBossHealthBar(ctx, state.fireKing, renderCamera);
    if (state.kraken) drawKraken(ctx, state.kraken, renderCamera, time);
    if (state.kraken) drawBossHealthBar(ctx, state.kraken, renderCamera);

    drawPlayer(ctx, state, renderCamera, time);

    if (state.firePyramid && state.firePyramid.ritual && state.firePyramid.ritual.active) {
      const beamX = state.firePyramid.lavaX * TILE - renderCamera.x + TILE / 2;
      const beamBottom = state.firePyramid.lavaY * TILE - renderCamera.y + TILE / 2;
      let alpha = 0.85;
      if (state.firePyramid.ritual.phase === 'beam_rise') alpha = 0.55 + 0.3 * Math.min(1, state.firePyramid.ritual.timer / 1.6);
      if (state.firePyramid.ritual.phase === 'beam_fade') alpha = 0.85 * Math.max(0, 1 - state.firePyramid.ritual.timer / 0.9);
      const width = 18;
      const grad = ctx.createLinearGradient(beamX, 0, beamX, beamBottom);
      grad.addColorStop(0, `rgba(255,248,200,${alpha})`);
      grad.addColorStop(0.4, `rgba(255,168,64,${alpha})`);
      grad.addColorStop(1, `rgba(255,92,20,${alpha * 0.92})`);
      ctx.fillStyle = grad;
      ctx.fillRect(beamX - width / 2, 0, width, Math.max(0, beamBottom));
      ctx.fillStyle = `rgba(255,240,180,${alpha * 0.45})`;
      ctx.fillRect(beamX - 4, 0, 8, Math.max(0, beamBottom));
    }

    if (state.waterWell && state.waterWell.ritual && state.waterWell.ritual.active) {
      const beamX = state.waterWell.centerX * TILE - renderCamera.x + TILE / 2;
      const beamBottom = state.waterWell.waterY0 * TILE - renderCamera.y + TILE / 2;
      let alpha = 0.82;
      if (state.waterWell.ritual.phase === 'beam_rise') alpha = 0.48 + 0.32 * Math.min(1, state.waterWell.ritual.timer / 0.9);
      if (state.waterWell.ritual.phase === 'beam_fade') alpha = 0.82 * Math.max(0, 1 - state.waterWell.ritual.timer / 0.8);
      const width = 16;
      const grad = ctx.createLinearGradient(beamX, 0, beamX, beamBottom);
      grad.addColorStop(0, `rgba(236,252,255,${alpha})`);
      grad.addColorStop(0.4, `rgba(132,226,255,${alpha})`);
      grad.addColorStop(1, `rgba(74,158,255,${alpha * 0.92})`);
      ctx.fillStyle = grad;
      ctx.fillRect(beamX - width / 2, 0, width, Math.max(0, beamBottom));
      ctx.fillStyle = `rgba(235,252,255,${alpha * 0.46})`;
      ctx.fillRect(beamX - 3, 0, 6, Math.max(0, beamBottom));
    }

    if (darkness > 0) drawDarknessMask(ctx, view, state, renderCamera, input, location, darkness);

    ctx.restore();

    if (state.attackFlash > 0) {
      ctx.fillStyle = `rgba(255,0,0,${state.attackFlash * 0.5})`;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    drawWeatherOverlay(ctx, canvas, weather, time);

    drawUI(ctx, canvas, state, phase);
    drawFireDungeonGuide(ctx, canvas, state);
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
