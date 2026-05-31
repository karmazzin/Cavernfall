(() => {
  const Game = window.MC2D;
  const { ITEM } = Game.items;
  const { selectedItemId, selectedToolId } = Game.inventory;

  function toolColor(tier, sword = false) {
    if (tier === 'friendship') return sword ? '#c8ffd8' : '#7be2af';
    if (tier === 'diamond') return sword ? '#9af2ff' : '#63d8ea';
    if (tier === 'iron') return sword ? '#dfe5ec' : '#b9c2cc';
    if (tier === 'stone') return sword ? '#d5dde8' : '#b4bfce';
    return sword ? '#d0b07d' : '#caa06c';
  }

  function drawHeldTool(ctx, itemId, x, y, dir, swing = 0) {
    if (itemId == null) return;
    const def = Game.items.getItemDefinition(itemId);
    if (!def) return;
    const ox = x + (dir > 0 ? 10 : 2);
    const oy = y + 10;
    ctx.save();
    ctx.translate(ox, oy);
    ctx.rotate((dir > 0 ? 1 : -1) * (0.25 + swing * 0.85));
    ctx.fillStyle = '#7a5432';
    ctx.fillRect(-1, -1, 2, 11);
    if (def.toolType === 'pickaxe') {
      ctx.fillStyle = toolColor(def.tier);
      ctx.fillRect(-5, -4, 10, 3);
      ctx.fillRect(-5, -2, 3, 2);
      ctx.fillRect(2, -2, 3, 2);
    } else if (def.toolType === 'axe') {
      ctx.fillStyle = toolColor(def.tier);
      ctx.fillRect(-5, -4, 6, 5);
    } else if (def.toolType === 'shovel') {
      ctx.fillStyle = toolColor(def.tier);
      ctx.beginPath();
      ctx.ellipse(0, -3, 3, 3, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (def.toolType === 'sword') {
      ctx.fillStyle = toolColor(def.tier, true);
      ctx.fillRect(-1, -7, 2, 8);
      ctx.fillStyle = '#7a5432';
      ctx.fillRect(-4, 0, 8, 2);
    } else if (itemId === 12) {
      ctx.fillStyle = '#ffb347';
      ctx.fillRect(-2, -5, 4, 4);
    }
    ctx.restore();
  }

  function drawMiningChips(ctx, x, y, dir, time, strength = 1) {
    const phase = time * 18;
    ctx.fillStyle = '#c7c1b5';
    for (let i = 0; i < 3; i += 1) {
      const ox = dir > 0 ? 14 + i * 2 : -2 - i * 2;
      const oy = 8 + Math.sin(phase + i) * 3;
      ctx.fillRect(x + ox, y + oy, Math.max(1, strength), Math.max(1, strength));
    }
  }

  function drawPlayer(ctx, state, camera, time) {
    const player = state.player;
    if (player.sleeping && Number.isFinite(player.sleepBlockX) && Number.isFinite(player.sleepBlockY)) {
      const x = player.sleepBlockX - camera.x - 6;
      const y = player.sleepBlockY - camera.y - 6;
      ctx.fillStyle = '#f0d9dc';
      ctx.fillRect(x + 2, y + 13, 18, 4);
      ctx.fillStyle = '#2e3e62';
      ctx.fillRect(x + 7, y + 7, 12, 6);
      ctx.fillStyle = '#d8b28d';
      ctx.fillRect(x + 2, y + 6, 6, 5);
      ctx.fillStyle = '#3c2a1f';
      ctx.fillRect(x + 2, y + 5, 6, 2);
      ctx.fillStyle = '#4c78c8';
      ctx.fillRect(x + 10, y + 13, 7, 4);
      ctx.fillStyle = '#d8b28d';
      ctx.fillRect(x + 18, y + 8, 2, 5);
      return;
    }
    const x = player.x - camera.x;
    const y = player.y - camera.y;
    if (player.steamForm) {
      const pulse = 0.5 + 0.5 * Math.sin(time * 5);
      ctx.fillStyle = `rgba(242,250,255,${0.88 + pulse * 0.08})`;
      ctx.beginPath();
      ctx.arc(x + player.w * 0.28, y + player.h * 0.58, 6, 0, Math.PI * 2);
      ctx.arc(x + player.w * 0.52, y + player.h * 0.36, 8, 0, Math.PI * 2);
      ctx.arc(x + player.w * 0.75, y + player.h * 0.58, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(188,221,236,0.72)';
      ctx.fillRect(x + 3, y + player.h * 0.56, player.w - 6, 4);
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.fillRect(x + 5, y + 6, player.w - 10, 2);
      return;
    }
    const dir = player.facing === -1 ? -1 : 1;
    const walkAmount = Math.min(1, Math.abs(player.vx) / 90);
    const walkPhase = Math.sin(time * 12) * 2.4 * walkAmount;
    const bodyBob = Math.abs(Math.sin(time * 12)) * 0.9 * walkAmount;
    const swing = state.breaking ? Math.sin((state.breaking.progress / Math.max(0.1, state.breaking.need)) * Math.PI * 4) * 0.5 + 0.5 : 0;
    ctx.fillStyle = '#2e3e62';
    ctx.fillRect(x + 2, y + 8 + bodyBob, 8, 9);
    ctx.fillStyle = '#d8b28d';
    ctx.fillRect(x + 2, y + 1 + bodyBob * 0.4, 8, 8);
    ctx.fillStyle = '#3c2a1f';
    ctx.fillRect(x + 2, y + bodyBob * 0.3, 8, 3);
    ctx.fillStyle = '#4c78c8';
    ctx.fillRect(x + 1, y + 17 + Math.max(0, walkPhase), 4, 7 - Math.min(3, Math.max(0, walkPhase)));
    ctx.fillRect(x + 7, y + 17 + Math.max(0, -walkPhase), 4, 7 - Math.min(3, Math.max(0, -walkPhase)));
    ctx.fillStyle = '#d8b28d';
    ctx.fillRect(x, y + 10 + Math.max(0, -walkPhase * 0.6), 2, 7);
    ctx.fillRect(x + 10, y + 10 + Math.max(0, walkPhase * 0.6), 2, 7);
    ctx.fillStyle = '#1d2638';
    ctx.fillRect(x + (dir > 0 ? 7 : 3), y + 4 + bodyBob * 0.3, 2, 2);
    drawHeldTool(ctx, selectedToolId(state) || selectedItemId(state), x, y, dir, swing);
    if (state.breaking) drawMiningChips(ctx, x, y, dir, time, 2);
  }

  function drawZombie(ctx, zombie, camera, time) {
    const x = zombie.x - camera.x;
    const y = zombie.y - camera.y;
    const walk = Math.sin(time * 8 + zombie.x * 0.02) * Math.min(2.3, Math.max(0.4, Math.abs(zombie.vx) / 40));
    const pirate = !!zombie.pirate;
    const ashGuardian = !!zombie.ashGuardian;
    ctx.fillStyle = ashGuardian ? '#4d4743' : pirate ? '#4f6d46' : '#597f4d';
    ctx.fillRect(x + 2, y + 7, ashGuardian ? 10 : 8, ashGuardian ? 11 : 10);
    ctx.fillStyle = ashGuardian ? '#7c716b' : '#7ea36f';
    ctx.fillRect(x + 2, y + 1, ashGuardian ? 10 : 8, 8);
    ctx.fillStyle = ashGuardian ? '#ff8b4a' : '#2d3d25';
    ctx.fillRect(x + 3, y + 4, 2, 2);
    ctx.fillRect(x + (ashGuardian ? 9 : 7), y + 4, 2, 2);
    ctx.fillStyle = ashGuardian ? '#342b28' : pirate ? '#7a4e2f' : '#4e6c9e';
    ctx.fillRect(x + 1, y + 17 + Math.max(0, walk), 4, 7 - Math.min(3, Math.max(0, walk)));
    ctx.fillRect(x + (ashGuardian ? 9 : 7), y + 17 + Math.max(0, -walk), 4, 7 - Math.min(3, Math.max(0, -walk)));
    ctx.fillStyle = ashGuardian ? '#7c716b' : '#7ea36f';
    ctx.fillRect(x, y + 10 + Math.max(0, -walk * 0.5), 2, 7);
    ctx.fillRect(x + (ashGuardian ? 12 : 10), y + 10 + Math.max(0, walk * 0.5), 2, 7);
    if (ashGuardian) {
      const pulse = 0.5 + 0.5 * Math.sin(time * 7 + zombie.x * 0.03);
      ctx.fillStyle = `rgba(255,110,42,${0.45 + pulse * 0.35})`;
      ctx.fillRect(x + 5, y + 10, 5, 5);
      ctx.fillStyle = '#2f2825';
      ctx.fillRect(x + 1, y, 12, 2);
      ctx.fillRect(x + 4, y + 2, 6, 2);
      ctx.fillStyle = '#9d9490';
      ctx.fillRect(x + 4, y + 6, 5, 1);
      return;
    }
    if (pirate) {
      ctx.fillStyle = '#2f2320';
      ctx.fillRect(x + 1, y, 10, 2);
      ctx.fillRect(x + 4, y + 2, 4, 2);
      ctx.fillStyle = '#b3312d';
      ctx.fillRect(x + 2, y + 1, 2, 1);
      ctx.fillRect(x + 8, y + 1, 2, 1);
      ctx.fillStyle = '#d7d0c0';
      ctx.fillRect(x + 5, y + 6, 2, 1);
    }
  }

  function drawSpider(ctx, spider, camera, time) {
    const x = spider.x - camera.x;
    const y = spider.y - camera.y;
    const leg = Math.sin(time * 10 + spider.x * 0.1) * 2;
    ctx.strokeStyle = '#1c1c20';
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 4; i += 1) {
      const ly = y + 4 + i * 2;
      ctx.beginPath();
      ctx.moveTo(x + 4, ly);
      ctx.lineTo(x - 2, ly + (i % 2 === 0 ? leg : -leg));
      ctx.moveTo(x + spider.w - 4, ly);
      ctx.lineTo(x + spider.w + 2, ly + (i % 2 === 0 ? -leg : leg));
      ctx.stroke();
    }
    ctx.fillStyle = '#121216';
    ctx.beginPath();
    ctx.ellipse(x + spider.w * 0.45, y + 6, 4, 3.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(x + spider.w * 0.7, y + 7, 5, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#b02f2f';
    ctx.fillRect(x + 4, y + 5, 2, 2);
    ctx.fillRect(x + 8, y + 5, 2, 2);
  }

  function drawSheep(ctx, animal, camera, time) {
    const x = animal.x - camera.x;
    const y = animal.y - camera.y;
    const walk = Math.sin(time * 10 + animal.x * 0.05) * Math.min(2, Math.abs(animal.vx) / 18);
    const bob = animal.grazing ? 2 : Math.sin(time * 5 + animal.x * 0.05) * 0.5;
    ctx.fillStyle = '#f3ecd8';
    ctx.fillRect(x + 1, y + 2, 10, 7);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x, y + 1, 12, 8);
    ctx.fillStyle = '#2f251d';
    ctx.fillRect(x + (animal.dir > 0 ? 8 : 1), y + 3 + bob, 3, 3);
    ctx.fillStyle = '#5a4a38';
    ctx.fillRect(x + 1, y + 9 + Math.max(0, walk), 2, 3 - Math.min(1.5, Math.max(0, walk)));
    ctx.fillRect(x + 4, y + 9 + Math.max(0, -walk), 2, 3 - Math.min(1.5, Math.max(0, -walk)));
    ctx.fillRect(x + 7, y + 9 + Math.max(0, -walk), 2, 3 - Math.min(1.5, Math.max(0, -walk)));
    ctx.fillRect(x + 10, y + 9 + Math.max(0, walk), 2, 3 - Math.min(1.5, Math.max(0, walk)));
  }

  function drawHuman(ctx, human, camera, time) {
    if (human.sleeping && Number.isFinite(human.sleepBlockX) && Number.isFinite(human.sleepBlockY)) {
      const x = human.sleepBlockX - camera.x - 5;
      const y = human.sleepBlockY - camera.y - 5;
      const palette = human.palette || { body: '#5477a7', accent: '#d6c28a', hat: '#8f6a3f' };
      const skin = '#d7b492';
      ctx.fillStyle = '#f0d9dc';
      ctx.fillRect(x + 2, y + 12, 16, 4);
      ctx.fillStyle = palette.body;
      ctx.fillRect(x + 7, y + 7, 10, 5);
      ctx.fillStyle = skin;
      ctx.fillRect(x + 2, y + 6, 5, 4);
      ctx.fillStyle = '#2a2a2d';
      ctx.fillRect(x + 4, y + 7, 1, 1);
      return;
    }
    const x = human.x - camera.x;
    const y = human.y - camera.y;
    const walkPhase = Math.sin(time * 8 + human.x * 0.04) * Math.min(2.2, Math.abs(human.vx) / 28);
    const palette = human.palette || { body: '#5477a7', accent: '#d6c28a', hat: '#8f6a3f' };
    const skin = '#d7b492';
    ctx.fillStyle = palette.body;
    ctx.fillRect(x + 2, y + 9, 8, 9);
    ctx.fillStyle = skin;
    ctx.fillRect(x + 2, y + 2, 8, 7);
    ctx.fillStyle = '#2a2a2d';
    ctx.fillRect(x + (human.dir > 0 ? 7 : 3), y + 5, 2, 2);
    ctx.fillStyle = palette.accent;
    ctx.fillRect(x + 1, y + 18 + Math.max(0, walkPhase), 4, 4 - Math.max(0, walkPhase) * 0.4);
    ctx.fillRect(x + 7, y + 18 + Math.max(0, -walkPhase), 4, 4 - Math.max(0, -walkPhase) * 0.4);
    ctx.fillStyle = skin;
    ctx.fillRect(x, y + 11 + Math.max(0, -walkPhase * 0.45), 2, 6);
    ctx.fillRect(x + 10, y + 11 + Math.max(0, walkPhase * 0.45), 2, 6);

    if (human.role === 'guard') {
      ctx.fillStyle = '#565861';
      ctx.fillRect(x + 2, y, 8, 3);
      ctx.fillStyle = '#8f949f';
      ctx.fillRect(x + 3, y + 1, 6, 1);
      ctx.fillStyle = '#4a4c54';
      ctx.fillRect(x + 3, y + 9, 6, 2);
      drawHeldTool(ctx, ITEM.STONE_SWORD, x, y, human.dir, 0.2);
      return;
    }

    if (human.profession === 'farmer') {
      ctx.fillStyle = '#9d7a43';
      ctx.fillRect(x + 2, y, 8, 3);
      ctx.fillStyle = '#d8bf74';
      ctx.fillRect(x + 3, y + 11, 6, 2);
      ctx.fillStyle = '#6f9b4f';
      ctx.fillRect(x + 4, y + 1, 1, 2);
      ctx.fillRect(x + 7, y + 1, 1, 2);
    } else if (human.profession === 'shepherd') {
      ctx.fillStyle = '#7f6d58';
      ctx.fillRect(x + 2, y, 8, 3);
      ctx.fillStyle = '#f0eee6';
      ctx.fillRect(x + 3, y + 9, 6, 3);
      ctx.fillStyle = '#caa8c9';
      ctx.fillRect(x + 2, y + 12, 8, 2);
    } else if (human.profession === 'lumber') {
      ctx.fillStyle = '#6d4e30';
      ctx.fillRect(x + 2, y, 8, 3);
      ctx.fillStyle = '#b98348';
      ctx.fillRect(x + 3, y + 10, 6, 2);
      ctx.fillStyle = '#5b3f24';
      ctx.fillRect(x + 2, y + 13, 8, 2);
      drawHeldTool(ctx, ITEM.STONE_AXE, x, y, human.dir, 0.1);
    } else if (human.profession === 'mason') {
      ctx.fillStyle = '#6c6f78';
      ctx.fillRect(x + 2, y, 8, 3);
      ctx.fillStyle = '#aeb2bb';
      ctx.fillRect(x + 3, y + 9, 6, 2);
      ctx.fillStyle = '#50545d';
      ctx.fillRect(x + 2, y + 13, 8, 2);
      drawHeldTool(ctx, ITEM.STONE_PICKAXE, x, y, human.dir, human.state === 'work' ? 0.22 : 0);
    } else if (human.profession === 'miner') {
      ctx.fillStyle = '#403a34';
      ctx.fillRect(x + 2, y, 8, 3);
      ctx.fillStyle = '#d1aa61';
      ctx.fillRect(x + 4, y + 1, 4, 1);
      ctx.fillStyle = '#72553c';
      ctx.fillRect(x + 3, y + 9, 6, 2);
      ctx.fillStyle = '#3d4048';
      ctx.fillRect(x + 2, y + 13, 8, 2);
      drawHeldTool(ctx, ITEM.STONE_PICKAXE, x, y, human.dir, human.state === 'work' ? 0.28 : 0);
    } else if (human.profession === 'merchant') {
      ctx.fillStyle = '#6c4a78';
      ctx.fillRect(x + 2, y, 8, 3);
      ctx.fillStyle = '#c8b06d';
      ctx.fillRect(x + 3, y + 9, 6, 2);
      ctx.fillStyle = '#8a5d2d';
      ctx.fillRect(x + 4, y + 2, 4, 1);
      ctx.fillStyle = '#53385d';
      ctx.fillRect(x + 2, y + 13, 8, 2);
    } else {
      ctx.fillStyle = palette.hat;
      ctx.fillRect(x + 2, y, 8, 3);
      ctx.fillStyle = palette.accent;
      ctx.fillRect(x + 3, y + 10, 6, 2);
    }
  }

  function drawWaterfolk(ctx, waterfolk, camera, time) {
    if (waterfolk.sleeping && Number.isFinite(waterfolk.sleepBlockX) && Number.isFinite(waterfolk.sleepBlockY)) {
      const x = waterfolk.sleepBlockX - camera.x - 4;
      const y = waterfolk.sleepBlockY - camera.y - 5;
      ctx.fillStyle = '#d7f5ff';
      ctx.fillRect(x + 1, y + 11, 16, 4);
      ctx.fillStyle = waterfolk.chief ? '#2f8fc6' : '#4ba6d8';
      ctx.fillRect(x + 6, y + 7, 10, 5);
      ctx.fillStyle = '#a3ecff';
      ctx.fillRect(x + 1, y + 6, 5, 4);
      ctx.fillStyle = '#174b69';
      ctx.fillRect(x + 3, y + 7, 1, 1);
      return;
    }
    const x = waterfolk.x - camera.x;
    const y = waterfolk.y - camera.y;
    const swim = Math.sin(time * 3.2 + waterfolk.x * 0.02) * 2.2;
    ctx.fillStyle = waterfolk.chief ? '#2f8fc6' : '#4ba6d8';
    ctx.fillRect(x + 2, y + 8 + swim * 0.2, 10, 9);
    ctx.fillStyle = '#a3ecff';
    ctx.fillRect(x + 3, y + 2 + swim * 0.12, 8, 7);
    ctx.fillStyle = '#174b69';
    ctx.fillRect(x + (waterfolk.dir > 0 ? 8 : 4), y + 5 + swim * 0.12, 2, 2);
    ctx.fillStyle = '#69d0ff';
    ctx.beginPath();
    ctx.moveTo(x + 12, y + 12);
    ctx.lineTo(x + 16, y + 10 + swim * 0.15);
    ctx.lineTo(x + 16, y + 16 - swim * 0.15);
    ctx.closePath();
    ctx.fill();
    ctx.fillRect(x + 4, y + 17, 3, 4);
    ctx.fillRect(x + 8, y + 17, 3, 4);
    if (waterfolk.chief) {
      ctx.fillStyle = '#d8f7ff';
      ctx.fillRect(x + 4, y + 1, 6, 1);
      ctx.fillRect(x + 5, y, 1, 2);
      ctx.fillRect(x + 8, y, 1, 2);
    }
  }

  function drawWindfolk(ctx, windy, camera, time) {
    if (windy.sleeping && Number.isFinite(windy.sleepBlockX) && Number.isFinite(windy.sleepBlockY)) {
      const x = windy.sleepBlockX - camera.x - 4;
      const y = windy.sleepBlockY - camera.y - 5;
      ctx.fillStyle = '#f6fcff';
      ctx.fillRect(x + 1, y + 11, 16, 4);
      ctx.fillStyle = '#d9f4ff';
      ctx.fillRect(x + 6, y + 7, 10, 5);
      ctx.fillStyle = '#9fdaf0';
      ctx.fillRect(x + 1, y + 6, 5, 4);
      return;
    }
    const x = windy.x - camera.x;
    const y = windy.y - camera.y;
    if (windy.steamForm) {
      const pulse = 0.5 + 0.5 * Math.sin(time * 5 + windy.x * 0.03);
      ctx.fillStyle = `rgba(244,251,255,${0.88 + pulse * 0.08})`;
      ctx.beginPath();
      ctx.arc(x + windy.w * 0.28, y + windy.h * 0.58, 5, 0, Math.PI * 2);
      ctx.arc(x + windy.w * 0.52, y + windy.h * 0.34, 7, 0, Math.PI * 2);
      ctx.arc(x + windy.w * 0.76, y + windy.h * 0.58, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(184,220,236,0.72)';
      ctx.fillRect(x + 3, y + windy.h * 0.56, windy.w - 6, 3);
      return;
    }
    const drift = Math.sin(time * 2.8 + windy.x * 0.02) * 1.6;
    ctx.fillStyle = windy.chief ? '#cbeeff' : '#dff6ff';
    ctx.fillRect(x + 2, y + 8 + drift * 0.2, 10, 9);
    ctx.fillStyle = '#f7fdff';
    ctx.fillRect(x + 3, y + 2 + drift * 0.12, 8, 7);
    ctx.fillStyle = '#7eb4cc';
    ctx.fillRect(x + (windy.dir > 0 ? 8 : 4), y + 5 + drift * 0.12, 2, 2);
    ctx.fillStyle = '#9fdaf0';
    ctx.fillRect(x + 4, y + 17, 3, 4);
    ctx.fillRect(x + 8, y + 17, 3, 4);
    if (windy.chief) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x + 4, y + 1, 6, 1);
      ctx.fillRect(x + 5, y, 1, 2);
      ctx.fillRect(x + 8, y, 1, 2);
    }
  }

  function drawUndergroundKing(ctx, king, camera, time) {
    const x = king.x - camera.x;
    const y = king.y - camera.y;
    const drift = Math.sin(time * 2.2) * 0.8;
    ctx.fillStyle = '#4c3326';
    ctx.fillRect(x + 2, y + 9 + drift * 0.2, 12, 11);
    ctx.fillStyle = '#d5b38e';
    ctx.fillRect(x + 3, y + 2 + drift * 0.1, 10, 8);
    ctx.fillStyle = '#2c231f';
    ctx.fillRect(x + 4, y + 7 + drift * 0.1, 8, 4);
    ctx.fillStyle = '#7a5a46';
    ctx.fillRect(x + 3, y + 20, 4, 4);
    ctx.fillRect(x + 9, y + 20, 4, 4);
    ctx.fillStyle = '#2a2a2d';
    ctx.fillRect(x + 8, y + 5 + drift * 0.1, 2, 2);
    ctx.fillStyle = '#d2b356';
    ctx.fillRect(x + 4, y + 1, 8, 2);
    ctx.fillRect(x + 5, y, 1, 2);
    ctx.fillRect(x + 8, y - 1, 1, 3);
    ctx.fillRect(x + 10, y, 1, 2);
  }

  function drawUndergroundKeeper(ctx, keeper, camera, time) {
    const x = keeper.x - camera.x;
    const y = keeper.y - camera.y;
    const drift = Math.sin(time * 2.4 + (keeper.anchorPhase || 0)) * 0.8;
    const crystal = keeper.kind === 'crystal';
    const lake = keeper.kind === 'lake';
    const mushroom = keeper.kind === 'mushroom';
    ctx.fillStyle = crystal ? '#4d3b66' : '#5a402f';
    ctx.fillRect(x + 2, y + 9 + drift * 0.2, 10, 10);
    ctx.fillStyle = crystal ? '#d4c5f7' : lake ? '#b9d7df' : mushroom ? '#d8c89b' : '#c7b193';
    ctx.fillRect(x + 3, y + 2 + drift * 0.12, 8, 8);
    ctx.fillStyle = crystal ? '#8c78d8' : lake ? '#4d92b1' : mushroom ? '#8f6f48' : '#7a5d43';
    ctx.fillRect(x + 3, y + 20, 3, 4);
    ctx.fillRect(x + 8, y + 20, 3, 4);
    ctx.fillStyle = '#24242a';
    ctx.fillRect(x + (keeper.dir > 0 ? 7 : 4), y + 5, 2, 2);
    if (crystal) {
      ctx.fillStyle = '#d7f0ff';
      ctx.fillRect(x + 1, y + 8, 2, 6);
      ctx.fillRect(x + 11, y + 6, 2, 5);
      ctx.fillStyle = 'rgba(230,250,255,0.45)';
      ctx.fillRect(x + 10, y + 4, 2, 2);
    } else if (lake) {
      ctx.fillStyle = '#79c7df';
      ctx.fillRect(x + 1, y + 11, 2, 5);
      ctx.fillRect(x + 11, y + 9, 2, 6);
      ctx.fillStyle = '#d7f7ff';
      ctx.fillRect(x + 4, y + 1, 4, 1);
    } else if (mushroom) {
      ctx.fillStyle = '#6b4f2d';
      ctx.fillRect(x + 1, y + 10, 2, 7);
      ctx.fillRect(x + 11, y + 10, 2, 7);
      ctx.fillStyle = '#78a255';
      ctx.fillRect(x + 3, y + 1, 7, 2);
      ctx.fillRect(x + 5, y, 3, 1);
    } else {
      ctx.fillStyle = '#6e4b33';
      ctx.fillRect(x + 1, y + 10, 2, 7);
      ctx.fillRect(x + 11, y + 8, 2, 7);
      ctx.fillStyle = '#4f7d39';
      ctx.fillRect(x + 10, y + 6, 2, 2);
    }
  }

  function drawGoldenFlowerGuardian(ctx, guardian, camera, time) {
    const x = guardian.x - camera.x;
    const y = guardian.y - camera.y;
    const pulse = 0.5 + 0.5 * Math.sin(time * 4 + guardian.x * 0.01);
    ctx.fillStyle = '#6f5520';
    ctx.fillRect(x + 10, y + 18, 24, 28);
    ctx.fillStyle = '#d2a93e';
    ctx.fillRect(x + 12, y + 8, 20, 14);
    ctx.fillStyle = '#fff1a0';
    ctx.beginPath();
    ctx.arc(x + 22, y + 15, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#8d6d1b';
    ctx.fillRect(x + 4, y + 22 + pulse, 8, 6);
    ctx.fillRect(x + 32, y + 22 - pulse, 8, 6);
    ctx.fillRect(x + 13, y + 46, 7, 10);
    ctx.fillRect(x + 24, y + 46, 7, 10);
    ctx.fillStyle = '#3f2f10';
    ctx.fillRect(x + (guardian.dir > 0 ? 24 : 18), y + 13, 2, 2);
    ctx.fillStyle = `rgba(255,227,120,${0.18 + pulse * 0.22})`;
    ctx.beginPath();
    ctx.arc(x + 22, y + 18, 20, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawAirGuardian(ctx, guardian, camera, time) {
    const x = guardian.x - camera.x;
    const y = guardian.y - camera.y;
    const pulse = 0.5 + 0.5 * Math.sin(time * 7 + guardian.x * 0.02);
    const wing = Math.sin(time * 10) * 6;
    ctx.fillStyle = 'rgba(230,248,255,0.92)';
    ctx.beginPath();
    ctx.ellipse(x + 18, y + 18, 14, 11, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(190,230,244,0.85)';
    ctx.beginPath();
    ctx.moveTo(x + 10, y + 18);
    ctx.lineTo(x - 3, y + 12 + wing);
    ctx.lineTo(x + 2, y + 24 - wing * 0.4);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x + 26, y + 18);
    ctx.lineTo(x + 39, y + 12 - wing);
    ctx.lineTo(x + 34, y + 24 + wing * 0.4);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x + 13, y + 13, 4, 4);
    ctx.fillRect(x + 20, y + 13, 4, 4);
    ctx.fillStyle = '#7fd6ff';
    ctx.fillRect(x + 14, y + 14, 2, 2);
    ctx.fillRect(x + 21, y + 14, 2, 2);
    ctx.fillStyle = `rgba(244,252,255,${0.16 + pulse * 0.24})`;
    ctx.beginPath();
    ctx.arc(x + 18, y + 18, 18, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawAirThief(ctx, thief, camera, time) {
    const x = thief.x - camera.x;
    const y = thief.y - camera.y;
    const drift = Math.sin(time * 2.4 + thief.x * 0.01) * 2.2;
    ctx.fillStyle = '#d2ecff';
    ctx.fillRect(x + 4, y + 16 + drift * 0.2, 20, 16);
    ctx.fillStyle = '#f7fdff';
    ctx.fillRect(x + 6, y + 4 + drift * 0.12, 16, 12);
    ctx.fillStyle = '#79a6c8';
    ctx.fillRect(x + (thief.dir > 0 ? 16 : 10), y + 10 + drift * 0.12, 3, 3);
    ctx.fillStyle = '#b8dcf2';
    ctx.fillRect(x + 7, y + 32, 6, 8);
    ctx.fillRect(x + 15, y + 32, 6, 8);
    ctx.fillStyle = 'rgba(244,251,255,0.38)';
    ctx.beginPath();
    ctx.arc(x + 14, y + 20, 20, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawEvilTrunk(ctx, trunk, camera, time) {
    const x = trunk.x - camera.x;
    const y = trunk.y - camera.y;
    const pulse = 0.5 + 0.5 * Math.sin(time * 5.5 + trunk.x * 0.01);
    const sway = Math.sin(time * 2.2) * 1.4;
    ctx.fillStyle = '#5f4227';
    ctx.fillRect(x + 8, y + 10 + sway, 20, 34);
    ctx.fillRect(x + 4, y + 20 + sway, 6, 20);
    ctx.fillRect(x + 26, y + 20 + sway, 6, 20);
    ctx.fillStyle = '#7d5832';
    ctx.fillRect(x + 10, y + 4 + sway * 0.6, 16, 12);
    ctx.fillRect(x + 12, y + 26 + sway, 12, 18);
    ctx.fillStyle = '#3c2818';
    ctx.fillRect(x + 11, y + 8 + sway * 0.6, 3, 3);
    ctx.fillRect(x + 22, y + 8 + sway * 0.6, 3, 3);
    ctx.fillStyle = `rgba(186,255,124,${0.26 + pulse * 0.28})`;
    ctx.fillRect(x + 10, y + 7 + sway * 0.6, 5, 5);
    ctx.fillRect(x + 21, y + 7 + sway * 0.6, 5, 5);
    ctx.fillStyle = '#9db471';
    ctx.fillRect(x + 6, y + 1, 24, 4);
    ctx.fillRect(x + 3, y + 4, 6, 4);
    ctx.fillRect(x + 27, y + 4, 6, 4);
  }

  function drawDwarf(ctx, state, dwarf, camera, time) {
    const x = dwarf.x - camera.x;
    const y = dwarf.y - camera.y;
    const swing = dwarf.state === 'mine' ? Math.sin(time * 12 + dwarf.x * 0.05) * 0.5 + 0.5 : 0;
    const walkPhase = Math.sin(time * 9 + dwarf.x * 0.04) * Math.min(2.1, Math.abs(dwarf.vx) / 32);
    const settlement = (state.dwarfColony && state.dwarfColony.settlements || []).find((entry) => entry.id === dwarf.settlementId);
    const clothes = settlement && settlement.clothes ? settlement.clothes : { hood: '#6c727f', tunic: '#8a5c34' };
    ctx.fillStyle = clothes.hood;
    ctx.fillRect(x + 1, y, 10, 4);
    ctx.fillStyle = '#c5935d';
    ctx.fillRect(x + 2, y + 3, 8, 7);
    ctx.fillStyle = clothes.tunic;
    ctx.fillRect(x + 2, y + 9, 8, 8);
    ctx.fillStyle = '#4d321d';
    ctx.fillRect(x + 2, y + 8, 8, 3);
    ctx.fillRect(x + 2, y + 16 + Math.max(0, walkPhase), 3, 4 - Math.max(0, walkPhase) * 0.6);
    ctx.fillRect(x + 7, y + 16 + Math.max(0, -walkPhase), 3, 4 - Math.max(0, -walkPhase) * 0.6);
    ctx.fillStyle = '#2a2a2d';
    ctx.fillRect(x + (dwarf.dir > 0 ? 7 : 3), y + 5, 2, 2);
    drawHeldTool(ctx, ITEM.STONE_PICKAXE, x, y, dwarf.dir, swing);
    if (dwarf.state === 'mine') drawMiningChips(ctx, x, y + 1, dwarf.dir, time + dwarf.x * 0.01, 2);
    if (settlement && settlement.hostileToPlayer) {
      ctx.fillStyle = 'rgba(255,64,64,0.9)';
      ctx.beginPath();
      ctx.arc(x + 6, y - 6, 4, 0, Math.PI * 2);
      ctx.fill();
    } else if (settlement && (settlement.alertLevel || 0) > 0) {
      ctx.fillStyle = 'rgba(255,210,64,0.95)';
      ctx.beginPath();
      ctx.moveTo(x + 6, y - 8);
      ctx.lineTo(x + 9, y - 2);
      ctx.lineTo(x + 3, y - 2);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#fff2b1';
      ctx.font = '10px Arial';
      ctx.fillText(String(Math.max(1, Math.ceil(settlement.alertTimer || 0))), x - 1, y - 10);
    }
  }

  function drawFireGuard(ctx, guard, camera, time) {
    const x = guard.x - camera.x;
    const y = guard.y - camera.y;
    const walk = Math.sin(time * 7.8 + guard.x * 0.03) * Math.min(2.4, Math.abs(guard.vx) / 24);
    const pulse = 0.5 + 0.5 * Math.sin(time * 9 + guard.x * 0.02);
    const destroyer = guard.role === 'destroyer';

    ctx.fillStyle = '#25110d';
    ctx.fillRect(x + 3, y + 8, 8, 12);
    ctx.fillRect(x + 1, y + 11, 2, 8);
    ctx.fillRect(x + 11, y + 11, 2, 8);

    ctx.fillStyle = '#4a1d15';
    ctx.fillRect(x + 2, y + 2, 10, 8);
    ctx.fillRect(x + 1, y + 9, 12, 3);

    ctx.fillStyle = destroyer ? '#8b2f18' : '#7a2c1c';
    ctx.fillRect(x + 4, y + 4, 6, 4);
    ctx.fillRect(x + 4, y + 12, 6, 2);

    ctx.fillStyle = '#ff7a2e';
    ctx.fillRect(x + 4, y + 5, 2, 2);
    ctx.fillRect(x + 8, y + 5, 2, 2);
    ctx.fillStyle = `rgba(255,214,120,${0.35 + pulse * 0.45})`;
    ctx.fillRect(x + 3, y + 4, 4, 4);
    ctx.fillRect(x + 7, y + 4, 4, 4);

    ctx.fillStyle = '#ff5a18';
    ctx.fillRect(x + 4, y - pulse, 2, 3 + pulse);
    ctx.fillRect(x + 8, y - pulse * 1.1, 2, 4 + pulse * 1.1);

    ctx.fillStyle = '#2e1711';
    ctx.fillRect(x + 3, y + 19 + Math.max(0, walk), 3, 5 - Math.min(2, Math.max(0, walk)) * 0.5);
    ctx.fillRect(x + 8, y + 19 + Math.max(0, -walk), 3, 5 - Math.min(2, Math.max(0, -walk)) * 0.5);

    ctx.fillStyle = '#6b3c1f';
    const toolX = guard.dir > 0 ? 10 : 1;
    const swing = destroyer ? Math.sin((guard.miningSwing || 0)) * 1.8 : 0;
    ctx.fillRect(x + toolX, y + 10 + swing, 2, 8);
    ctx.fillStyle = '#e9a84b';
    ctx.fillRect(x + (guard.dir > 0 ? 11 : 0), y + 8 + swing, 1, 3);
    if (destroyer && (guard.breakTimer || 0) > 0.1) {
      ctx.fillStyle = '#c1b6a5';
      ctx.fillRect(x + (guard.dir > 0 ? 14 : -2), y + 11, 2, 2);
      ctx.fillRect(x + (guard.dir > 0 ? 16 : -4), y + 8, 1, 1);
      ctx.fillRect(x + (guard.dir > 0 ? 13 : -1), y + 6, 1, 1);
    }
  }

  function drawFireBoss(ctx, boss, camera, time) {
    const x = boss.x - camera.x;
    const y = boss.y - camera.y;
    const bob = Math.sin(time * 5.6) * 1.2;
    const stride = Math.sin(time * 7.2) * Math.min(2.6, Math.abs(boss.vx) / 26);
    const flame = 0.5 + 0.5 * Math.sin(time * 11 + boss.x * 0.01);
    const eyeGlow = 0.6 + 0.4 * Math.sin(time * 9);

    ctx.fillStyle = '#2a120d';
    ctx.fillRect(x + 8, y + 18 + bob, 14, 18);
    ctx.fillRect(x + 5, y + 22 + bob, 4, 10);
    ctx.fillRect(x + 21, y + 22 + bob, 4, 10);

    ctx.fillStyle = '#4e1f14';
    ctx.fillRect(x + 6, y + 10 + bob, 18, 12);
    ctx.fillRect(x + 4, y + 13 + bob, 22, 8);
    ctx.fillRect(x + 7, y + 4 + bob * 0.4, 16, 9);

    ctx.fillStyle = '#7d2f1d';
    ctx.fillRect(x + 9, y + 5 + bob * 0.4, 12, 7);
    ctx.fillRect(x + 10, y + 21 + bob, 3, 12);
    ctx.fillRect(x + 17, y + 21 + bob, 3, 12);

    ctx.fillStyle = '#ff7a26';
    ctx.fillRect(x + 10, y + 7 + bob * 0.4, 2, 2);
    ctx.fillRect(x + 18, y + 7 + bob * 0.4, 2, 2);
    ctx.fillStyle = `rgba(255,193,92,${0.5 + eyeGlow * 0.35})`;
    ctx.fillRect(x + 9, y + 6 + bob * 0.4, 4, 4);
    ctx.fillRect(x + 17, y + 6 + bob * 0.4, 4, 4);

    ctx.fillStyle = '#ff5f18';
    ctx.fillRect(x + 11, y + 1 - flame, 3, 5 + flame);
    ctx.fillRect(x + 16, y + 0 - flame * 1.1, 3, 6 + flame * 1.1);
    ctx.fillRect(x + 6, y + 3 - flame * 0.5, 2, 4 + flame * 0.5);
    ctx.fillRect(x + 22, y + 2 - flame * 0.4, 2, 4 + flame * 0.4);

    ctx.fillStyle = '#2f170f';
    ctx.fillRect(x + 4, y + 18 + bob + Math.max(0, stride), 4, 10 - Math.max(0, stride) * 0.9);
    ctx.fillRect(x + 22, y + 18 + bob + Math.max(0, -stride), 4, 10 - Math.max(0, -stride) * 0.9);
    ctx.fillRect(x + 9, y + 35 + Math.max(0, stride), 5, 7 - Math.max(0, stride) * 0.7);
    ctx.fillRect(x + 17, y + 35 + Math.max(0, -stride), 5, 7 - Math.max(0, -stride) * 0.7);

    ctx.fillStyle = '#ff8f42';
    ctx.fillRect(x + 12, y + 16 + bob, 6, 2);
    ctx.fillRect(x + 13, y + 26 + bob, 4, 2);
  }

  function drawFireKing(ctx, king, camera, time) {
    const x = king.x - camera.x;
    const y = king.y - camera.y;
    const stride = Math.sin(time * 4.6) * Math.min(4.5, Math.abs(king.vx) / 24);
    const pulse = 0.5 + 0.5 * Math.sin(time * 7.5 + king.x * 0.003);
    const castPulse = king.phase === 'cast' ? 0.7 + 0.3 * Math.sin(time * 18) : 0;
    const slamOffset = king.phase === 'slam' ? Math.sin(time * 26) * 1.4 : 0;

    ctx.fillStyle = '#180708';
    ctx.fillRect(x + 18, y + 52 + slamOffset, 44, 72);
    ctx.fillRect(x + 10, y + 62 + slamOffset, 8, 40);
    ctx.fillRect(x + 62, y + 62 + slamOffset, 8, 40);

    ctx.fillStyle = '#3a1112';
    ctx.fillRect(x + 12, y + 20 + slamOffset, 56, 42);
    ctx.fillRect(x + 18, y + 8 + slamOffset, 44, 24);
    ctx.fillRect(x + 6, y + 30 + slamOffset, 68, 14);

    ctx.fillStyle = '#68221b';
    ctx.fillRect(x + 22, y + 12 + slamOffset, 36, 18);
    ctx.fillRect(x + 24, y + 56 + slamOffset, 14, 38);
    ctx.fillRect(x + 42, y + 56 + slamOffset, 14, 38);
    ctx.fillRect(x + 15, y + 30 + slamOffset, 50, 8);

    ctx.fillStyle = '#ff7b2a';
    ctx.fillRect(x + 28, y + 18 + slamOffset, 6, 6);
    ctx.fillRect(x + 46, y + 18 + slamOffset, 6, 6);
    ctx.fillStyle = `rgba(255,215,130,${0.36 + pulse * 0.5})`;
    ctx.fillRect(x + 26, y + 16 + slamOffset, 10, 10);
    ctx.fillRect(x + 44, y + 16 + slamOffset, 10, 10);
    ctx.fillStyle = `rgba(255,115,40,${0.25 + pulse * 0.35 + castPulse * 0.2})`;
    ctx.fillRect(x + 33, y + 42 + slamOffset, 14, 16);

    ctx.fillStyle = '#ff531c';
    ctx.fillRect(x + 22, y + 2 - pulse * 3 + slamOffset, 6, 10 + pulse * 3);
    ctx.fillRect(x + 52, y + 1 - pulse * 3.2 + slamOffset, 6, 11 + pulse * 3.2);
    ctx.fillRect(x + 14, y + 9 - pulse * 1.4 + slamOffset, 4, 7 + pulse * 1.4);
    ctx.fillRect(x + 62, y + 7 - pulse * 1.2 + slamOffset, 4, 7 + pulse * 1.2);

    ctx.fillStyle = '#24090a';
    ctx.fillRect(x + 18, y + 120 + Math.max(0, stride), 14, 30 - Math.max(0, stride) * 1.2);
    ctx.fillRect(x + 48, y + 120 + Math.max(0, -stride), 14, 30 - Math.max(0, -stride) * 1.2);
    ctx.fillRect(x + 4, y + 64 + Math.max(0, stride * 0.7), 10, 34);
    ctx.fillRect(x + 66, y + 64 + Math.max(0, -stride * 0.7), 10, 34);

    ctx.fillStyle = '#8f5a22';
    ctx.fillRect(x + (king.dir > 0 ? 71 : 2), y + 58, 5, 40);
    ctx.fillStyle = '#f0bc62';
    ctx.fillRect(x + (king.dir > 0 ? 73 : 0), y + 50, 2, 10);

    if (king.phase === 'cast') {
      ctx.fillStyle = `rgba(255,140,60,${0.18 + castPulse * 0.25})`;
      ctx.beginPath();
      ctx.arc(x + 40, y + 54, 24 + castPulse * 8, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawFriendlyFireKing(ctx, king, camera, time) {
    const x = king.x - camera.x;
    const y = king.y - camera.y;
    const pulse = 0.5 + 0.5 * Math.sin(time * 4.5);
    if (king.state === 'sealed' || king.state === 'awakening') {
      ctx.fillStyle = `rgba(255,120,80,${0.16 + pulse * 0.16})`;
      ctx.fillRect(x - 6, y - 6, king.w + 12, king.h + 12);
    }
    ctx.fillStyle = '#173028';
    ctx.fillRect(x + 6, y + 18, 20, 30);
    ctx.fillStyle = '#2d6854';
    ctx.fillRect(x + 4, y + 10, 24, 16);
    ctx.fillRect(x + 7, y + 2, 18, 12);
    ctx.fillStyle = '#ffb987';
    ctx.fillRect(x + 10, y + 6, 12, 8);
    ctx.fillStyle = '#87ffd1';
    ctx.fillRect(x + 12, y + 8, 2, 2);
    ctx.fillRect(x + 18, y + 8, 2, 2);
    ctx.fillStyle = `rgba(150,255,212,${0.22 + pulse * 0.25})`;
    ctx.fillRect(x + 8, y + 4, 16, 10);
    ctx.fillStyle = '#1d4237';
    ctx.fillRect(x + 8, y + 47, 5, 9);
    ctx.fillRect(x + 19, y + 47, 5, 9);
    ctx.fillStyle = '#6af0bf';
    ctx.fillRect(x + 9, y + 0, 3, 5);
    ctx.fillRect(x + 20, y + 0, 3, 5);
  }

  function drawKraken(ctx, kraken, camera, time) {
    const x = kraken.x - camera.x;
    const y = kraken.y - camera.y;
    const pulse = 0.5 + 0.5 * Math.sin(time * 6.5);
    const sway = Math.sin(time * 4.8) * 5;

    ctx.fillStyle = '#102b38';
    ctx.beginPath();
    ctx.ellipse(x + 32, y + 22, 24, 18, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1b4a5e';
    ctx.beginPath();
    ctx.ellipse(x + 32, y + 18, 20, 13, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#6ee7ff';
    ctx.fillRect(x + 22, y + 14, 4, 4);
    ctx.fillRect(x + 38, y + 14, 4, 4);
    ctx.fillStyle = `rgba(210,255,255,${0.25 + pulse * 0.25})`;
    ctx.fillRect(x + 20, y + 12, 8, 8);
    ctx.fillRect(x + 36, y + 12, 8, 8);

    ctx.fillStyle = '#14394a';
    for (let i = 0; i < 6; i += 1) {
      const ox = 10 + i * 8;
      const len = 18 + (i % 2) * 6;
      const wave = Math.sin(time * 8 + i * 0.9) * 4;
      ctx.fillRect(x + ox, y + 28, 4, len);
      ctx.fillRect(x + ox + wave, y + 28 + len - 2, 4, 10 + sway * 0.2);
    }

    ctx.fillStyle = '#1f6077';
    ctx.fillRect(x + 26, y + 24, 12, 6);
  }

  function drawBossHealthBar(ctx, boss, camera) {
    if (!boss || !boss.isBoss || !Number.isFinite(boss.maxHp) || boss.maxHp <= 0) return;
    const ratio = Math.max(0, Math.min(1, boss.hp / boss.maxHp));
    const width = Math.max(42, boss.w + 12);
    const height = 7;
    const x = boss.x - camera.x + boss.w / 2 - width / 2;
    const y = boss.y - camera.y - 16;
    const label = boss.name || 'Босс';

    ctx.save();
    ctx.fillStyle = 'rgba(10, 8, 8, 0.88)';
    ctx.fillRect(x - 2, y - 12, width + 4, height + 16);
    ctx.strokeStyle = 'rgba(255, 200, 120, 0.65)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x - 1.5, y - 11.5, width + 3, height + 15);
    ctx.fillStyle = '#f9d7a3';
    ctx.font = '10px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${label} ${Math.max(0, Math.ceil(boss.hp))}/${boss.maxHp}`, x + width / 2, y - 5);
    ctx.fillStyle = '#3c1d16';
    ctx.fillRect(x, y, width, height);
    ctx.fillStyle = ratio > 0.45 ? '#ff6b2f' : ratio > 0.2 ? '#ff9d2e' : '#ffd24d';
    ctx.fillRect(x, y, width * ratio, height);
    ctx.restore();
  }

  Game.entityRenderer = { drawPlayer, drawZombie, drawSpider, drawSheep, drawHuman, drawDwarf, drawFireGuard, drawFireBoss, drawFireKing, drawFriendlyFireKing, drawKraken, drawWaterfolk, drawWindfolk, drawUndergroundKing, drawUndergroundKeeper, drawGoldenFlowerGuardian, drawAirGuardian, drawAirThief, drawEvilTrunk, drawBossHealthBar };
})();
