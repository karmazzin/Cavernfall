(() => {
  const Game = window.MC2D;
  const { ITEM } = Game.items;
  const { selectedItemId, selectedToolId } = Game.inventory;

  function toolColor(tier, sword = false) {
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
    const x = player.x - camera.x;
    const y = player.y - camera.y;
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
    ctx.fillStyle = '#597f4d';
    ctx.fillRect(x + 2, y + 7, 8, 10);
    ctx.fillStyle = '#7ea36f';
    ctx.fillRect(x + 2, y + 1, 8, 8);
    ctx.fillStyle = '#2d3d25';
    ctx.fillRect(x + 3, y + 4, 2, 2);
    ctx.fillRect(x + 7, y + 4, 2, 2);
    ctx.fillStyle = '#4e6c9e';
    ctx.fillRect(x + 1, y + 17 + Math.max(0, walk), 4, 7 - Math.min(3, Math.max(0, walk)));
    ctx.fillRect(x + 7, y + 17 + Math.max(0, -walk), 4, 7 - Math.min(3, Math.max(0, -walk)));
    ctx.fillStyle = '#7ea36f';
    ctx.fillRect(x, y + 10 + Math.max(0, -walk * 0.5), 2, 7);
    ctx.fillRect(x + 10, y + 10 + Math.max(0, walk * 0.5), 2, 7);
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

  Game.entityRenderer = { drawPlayer, drawZombie, drawSpider, drawSheep, drawHuman, drawDwarf };
})();
