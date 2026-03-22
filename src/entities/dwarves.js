(() => {
  const Game = window.MC2D;
  const { TILE, GRAVITY } = Game.constants;
  const { BLOCK } = Game.blocks;
  const { rand, aabb, clamp } = Game.math;
  const { getBlock, blockSolid } = Game.world;
  const { moveEntity } = Game.physics;
  const { ensureMobState, updateMobMediumState, getWaterEscapeDir, applyMobEnvironmentDamage } = Game.mobUtils;

  const MAX_DWARVES = 24;
  const DWARF_STATE = {
    IDLE: 'idle',
    ROAM: 'roam',
    MINE: 'mine',
    FIGHT: 'fight',
    ALERT: 'alert',
  };

  function ensureColony(state) {
    if (!state.dwarfColony || typeof state.dwarfColony !== 'object') {
      state.dwarfColony = { homes: [], stockpiles: [], halls: [], shafts: [], worksites: [], nodes: [], edges: [], settlements: [] };
    }
    if (!Array.isArray(state.dwarfColony.nodes)) state.dwarfColony.nodes = [];
    if (!Array.isArray(state.dwarfColony.edges)) state.dwarfColony.edges = [];
    const colorFallback = [
      { tunic: '#8a5c34', hood: '#6c727f' },
      { tunic: '#5a6f8f', hood: '#7e868f' },
      { tunic: '#6f5d8d', hood: '#88808f' },
      { tunic: '#4f7a64', hood: '#758174' },
      { tunic: '#8a4f4f', hood: '#7f6c6c' },
      { tunic: '#8b7442', hood: '#867b67' },
    ];
    for (let i = 0; i < state.dwarfColony.settlements.length; i += 1) {
      const settlement = state.dwarfColony.settlements[i];
      if (!Number.isFinite(settlement.alertLevel)) settlement.alertLevel = 0;
      if (!Number.isFinite(settlement.alertTimer)) settlement.alertTimer = 0;
      if (settlement.hostileToPlayer == null) settlement.hostileToPlayer = false;
      if (!settlement.clothes) settlement.clothes = colorFallback[i % colorFallback.length];
    }
    for (const home of state.dwarfColony.homes) {
      if (!Number.isFinite(home.respawnTimer)) home.respawnTimer = 0;
      if (home.residentId == null) home.residentId = null;
    }
  }

  function findSettlement(state, id) {
    ensureColony(state);
    return state.dwarfColony.settlements.find((settlement) => settlement.id === id) || null;
  }

  function createDwarf(home) {
    const dwarf = {
      id: `${home.id}-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e5).toString(36)}`,
      settlementId: home.settlementId,
      homeId: home.id,
      x: home.spawnX * TILE + 2,
      y: (home.spawnY - 1) * TILE,
      w: 12,
      h: 20,
      vx: 0,
      vy: 0,
      onGround: false,
      hp: 5,
      dir: Math.random() < 0.5 ? -1 : 1,
      state: DWARF_STATE.IDLE,
      stateTimer: rand(1.2, 2.8),
      attackCd: 0,
      mineTimer: 0,
      jumpCd: 0,
      obstacleTimer: 0,
      targetX: home.spawnX,
      targetY: home.spawnY,
      route: [],
      routeIndex: 0,
      routeTargetId: home.nodeId || null,
      role: Math.random() < 0.32 ? 'guard' : 'miner',
      worksiteIndex: -1,
    };
    ensureMobState(dwarf);
    return dwarf;
  }

  function spawnHomeResident(state, home) {
    if (state.dwarves.length >= MAX_DWARVES) return false;
    if (home.residentId) return false;
    const dwarf = createDwarf(home);
    home.residentId = dwarf.id;
    state.dwarves.push(dwarf);
    return true;
  }

  function findHome(state, homeId) {
    ensureColony(state);
    return state.dwarfColony.homes.find((home) => home.id === homeId) || null;
  }

  function setTask(dwarf, kind, tx, ty, worksiteIndex = -1) {
    dwarf.state = kind;
    dwarf.targetX = tx;
    dwarf.targetY = ty;
    dwarf.worksiteIndex = worksiteIndex;
    dwarf.stateTimer =
      kind === DWARF_STATE.IDLE ? rand(1, 2.5) :
      kind === DWARF_STATE.MINE ? rand(7, 11) :
      rand(2.4, 4.6);
  }

  function getNodeById(state, nodeId) {
    return state.dwarfColony.nodes.find((node) => node.id === nodeId) || null;
  }

  function getNearestNode(state, settlementId, x, y, kinds = null) {
    let best = null;
    let bestDist = Infinity;
    for (const node of state.dwarfColony.nodes) {
      if (node.settlementId !== settlementId) continue;
      if (kinds && !kinds.includes(node.kind)) continue;
      const dist = Math.abs(node.x - x) + Math.abs(node.y - y);
      if (dist < bestDist) {
        best = node;
        bestDist = dist;
      }
    }
    return best;
  }

  function findPath(state, settlementId, fromId, toId) {
    if (!fromId || !toId || fromId === toId) return fromId && toId ? [fromId] : [];
    const queue = [fromId];
    const prev = new Map([[fromId, null]]);
    while (queue.length) {
      const current = queue.shift();
      for (const edge of state.dwarfColony.edges) {
        if (edge.from !== current) continue;
        const next = edge.to;
        const nextNode = getNodeById(state, next);
        if (!nextNode || nextNode.settlementId !== settlementId || prev.has(next)) continue;
        prev.set(next, current);
        if (next === toId) {
          const path = [toId];
          let cursor = current;
          while (cursor) {
            path.unshift(cursor);
            cursor = prev.get(cursor);
          }
          return path;
        }
        queue.push(next);
      }
    }
    return [];
  }

  function assignRoute(state, dwarf, destinationNode, kind, worksiteIndex = -1) {
    const startNode = getNearestNode(state, dwarf.settlementId, Math.floor((dwarf.x + dwarf.w / 2) / TILE), Math.floor((dwarf.y + dwarf.h) / TILE), ['hall', 'shaft', 'home', 'stock', 'worksite']);
    const path = findPath(state, dwarf.settlementId, startNode ? startNode.id : destinationNode.id, destinationNode.id);
    dwarf.route = path.length ? path : [destinationNode.id];
    dwarf.routeIndex = 0;
    dwarf.routeTargetId = destinationNode.id;
    dwarf.state = kind;
    dwarf.worksiteIndex = worksiteIndex;
    dwarf.stateTimer = kind === DWARF_STATE.MINE ? rand(7, 11) : rand(2.4, 4.6);
  }

  function isMineableBlock(block) {
    return blockSolid(block) &&
      block !== BLOCK.BEDROCK &&
      block !== BLOCK.PLANK &&
      block !== BLOCK.PILLAR &&
      block !== BLOCK.LADDER &&
      block !== BLOCK.TORCH &&
      block !== BLOCK.CHEST;
  }

  function advanceWorksiteToRock(state, worksite) {
    let steps = 0;
    while (steps <= worksite.maxAdvance) {
      const block = getBlock(state, worksite.targetTx, worksite.targetTy);
      if (isMineableBlock(block)) return true;
      worksite.targetTx += worksite.dir;
      worksite.x += worksite.dir;
      steps += 1;
      if (Math.abs(worksite.targetTx - worksite.originTx) > worksite.maxAdvance) return false;
    }
    return false;
  }

  function chooseRoutineTask(state, dwarf, settlement) {
    ensureColony(state);
    const home = findHome(state, dwarf.homeId);
    const hallNode = getNearestNode(state, dwarf.settlementId, settlement.hallX, settlement.hallY, ['hall']);
    const stockNodes = state.dwarfColony.nodes.filter((node) => node.settlementId === dwarf.settlementId && node.kind === 'stock');
    const workNodes = state.dwarfColony.nodes.filter((node) => node.settlementId === dwarf.settlementId && node.kind === 'worksite');
    const homeNode = home && home.nodeId ? getNodeById(state, home.nodeId) : null;
    const roll = Math.random();

    if (roll < 0.18 && homeNode) {
      assignRoute(state, dwarf, homeNode, DWARF_STATE.IDLE);
      return;
    }
    if (dwarf.role === 'guard') {
      const patrolNodes = state.dwarfColony.nodes.filter((node) => node.settlementId === dwarf.settlementId && (node.kind === 'hall' || node.kind === 'shaft' || node.kind === 'stock'));
      if (patrolNodes.length > 0) {
        assignRoute(state, dwarf, patrolNodes[Math.floor(rand(0, patrolNodes.length))], DWARF_STATE.ROAM);
        return;
      }
    }
    if (roll < 0.36 && stockNodes.length > 0) {
      const stock = stockNodes[Math.floor(rand(0, stockNodes.length))];
      assignRoute(state, dwarf, stock, DWARF_STATE.ROAM);
      return;
    }
    if (roll < 0.9 && workNodes.length > 0 && dwarf.role !== 'guard') {
      const site = workNodes[Math.floor(rand(0, workNodes.length))];
      assignRoute(state, dwarf, site, DWARF_STATE.MINE, site.worksiteIndex ?? -1);
      return;
    }
    if (hallNode) {
      assignRoute(state, dwarf, hallNode, DWARF_STATE.ROAM);
      return;
    }
    if (homeNode) assignRoute(state, dwarf, homeNode, DWARF_STATE.ROAM);
  }

  function nearestThreat(state, dwarf) {
    let best = null;
    let bestDist = 140;
    for (const zombie of state.zombies) {
      const dist = Math.hypot((zombie.x - dwarf.x), (zombie.y - dwarf.y));
      if (dist < bestDist) {
        best = zombie;
        bestDist = dist;
      }
    }
    for (const spider of state.spiders) {
      const dist = Math.hypot((spider.x - dwarf.x), (spider.y - dwarf.y));
      if (dist < bestDist) {
        best = spider;
        bestDist = dist;
      }
    }
    return best;
  }

  function applySettlementAlert(state, settlementId, severity = 1) {
    const settlement = findSettlement(state, settlementId);
    if (!settlement) return;
    settlement.alertLevel = Math.max(settlement.alertLevel || 0, severity);
    settlement.alertTimer = 24;
    if (severity >= 2) settlement.hostileToPlayer = true;
    for (const dwarf of state.dwarves) {
      if (dwarf.settlementId !== settlementId) continue;
      dwarf.state = DWARF_STATE.ALERT;
      dwarf.stateTimer = 3;
    }
  }

  function getNearestTrader(state, maxDistance = 72) {
    ensureColony(state);
    let best = null;
    let bestDist = maxDistance;
    for (const dwarf of state.dwarves) {
      const settlement = findSettlement(state, dwarf.settlementId);
      if (!settlement || settlement.hostileToPlayer || (settlement.alertLevel || 0) > 0) continue;
      const dist = Math.hypot((state.player.x - dwarf.x), (state.player.y - dwarf.y));
      if (dist <= bestDist) {
        best = { dwarf, settlement };
        bestDist = dist;
      }
    }
    return best;
  }

  function breakMineTarget(state, worksite) {
    if (!advanceWorksiteToRock(state, worksite)) return;
    const block = getBlock(state, worksite.targetTx, worksite.targetTy);
    if (isMineableBlock(block)) {
      Game.world.setBlock(state, worksite.targetTx, worksite.targetTy, BLOCK.AIR);
      const advance = Math.abs((worksite.targetTx + worksite.dir) - worksite.originTx);
      if (advance <= worksite.maxAdvance) {
        worksite.targetTx += worksite.dir;
        worksite.x += worksite.dir;
      }
    }
  }

  function getLadderState(state, dwarf) {
    const centerTx = Math.floor((dwarf.x + dwarf.w / 2) / TILE);
    const centerTy = Math.floor((dwarf.y + dwarf.h / 2) / TILE);
    const headTy = Math.floor((dwarf.y + 2) / TILE);
    const feetTy = Math.floor((dwarf.y + dwarf.h - 2) / TILE);
    return getBlock(state, centerTx, centerTy) === BLOCK.LADDER || getBlock(state, centerTx, headTy) === BLOCK.LADDER || getBlock(state, centerTx, feetTy) === BLOCK.LADDER;
  }

  function edgeTypeBetween(state, fromId, toId) {
    const edge = state.dwarfColony.edges.find((entry) => entry.from === fromId && entry.to === toId);
    return edge ? edge.type : 'walk';
  }

  function moveTowardTarget(state, dwarf, settlement, dt) {
    if (!dwarf.route || dwarf.route.length === 0) return;
    const currentNode = getNodeById(state, dwarf.route[dwarf.routeIndex]) || null;
    const nextNode = getNodeById(state, dwarf.route[Math.min(dwarf.routeIndex + 1, dwarf.route.length - 1)]) || currentNode;
    const targetNode = nextNode || currentNode;
    if (!targetNode) return;
    const targetPx = targetNode.x * TILE + 2;
    const targetPy = (targetNode.y - 1) * TILE;
    const onLadder = getLadderState(state, dwarf);
    const dx = targetPx - dwarf.x;
    const dy = targetPy - dwarf.y;
    dwarf.vx = 0;
    dwarf.stepUpHeight = TILE;
    const edgeType = currentNode && nextNode ? edgeTypeBetween(state, currentNode.id, nextNode.id) : 'walk';

    if (edgeType === 'ladder') {
      if (Math.abs(dx) > 2) {
        dwarf.vx = Math.sign(dx) * 54;
        dwarf.dir = dwarf.vx < 0 ? -1 : 1;
        dwarf.vy += GRAVITY * dt;
      } else {
        dwarf.x = targetNode.x * TILE + 2;
        dwarf.vx = 0;
        dwarf.vy = Math.abs(dy) > 4 ? Math.sign(dy) * 128 : 0;
      }
      dwarf.obstacleTimer = 0;
      return;
    }

    if (Math.abs(dx) > 3) dwarf.vx = Math.sign(dx) * 56;
    dwarf.dir = dwarf.vx < 0 ? -1 : dwarf.vx > 0 ? 1 : dwarf.dir;
    dwarf.vy += GRAVITY * dt;
  }

  function removeDwarf(state, index, byPlayer = false) {
    const dwarf = state.dwarves[index];
    const home = findHome(state, dwarf.homeId);
    if (home) {
      home.residentId = null;
      home.respawnTimer = rand(28, 46);
    }
    if (byPlayer) applySettlementAlert(state, dwarf.settlementId, 2);
    state.dwarves.splice(index, 1);
  }

  function hitHostile(target, damage) {
    target.hp -= damage;
  }

  function moveDirectToward(dwarf, target, dt) {
    const dx = target.x - dwarf.x;
    dwarf.vx = Math.abs(dx) > 4 ? Math.sign(dx) * 68 : 0;
    if (dwarf.vx !== 0) dwarf.dir = dwarf.vx < 0 ? -1 : 1;
    dwarf.vy += GRAVITY * dt;
    dwarf.stepUpHeight = TILE;
  }

  function updateDwarves(state, dt) {
    ensureColony(state);

    for (const settlement of state.dwarfColony.settlements) {
      settlement.alertTimer = Math.max(0, (settlement.alertTimer || 0) - dt);
      if (settlement.alertTimer <= 0 && !settlement.hostileToPlayer) settlement.alertLevel = 0;
    }

    for (const home of state.dwarfColony.homes) {
      if (home.residentId) continue;
      home.respawnTimer = Math.max(0, (home.respawnTimer || 0) - dt);
      if (home.respawnTimer <= 0 && state.dwarves.length < MAX_DWARVES) spawnHomeResident(state, home);
    }

    for (let i = state.dwarves.length - 1; i >= 0; i -= 1) {
      const dwarf = state.dwarves[i];
      ensureMobState(dwarf);
      if (!Array.isArray(dwarf.route)) dwarf.route = [];
      if (!Number.isFinite(dwarf.routeIndex)) dwarf.routeIndex = 0;
      if (!dwarf.role) dwarf.role = Math.random() < 0.32 ? 'guard' : 'miner';
      dwarf.jumpCd = Math.max(0, (dwarf.jumpCd || 0) - dt);
      dwarf.obstacleTimer = dwarf.obstacleTimer || 0;
      const settlement = findSettlement(state, dwarf.settlementId);
      const threat = nearestThreat(state, dwarf);
      dwarf.attackCd = Math.max(0, (dwarf.attackCd || 0) - dt);
      dwarf.stateTimer -= dt;
      updateMobMediumState(state, dwarf);

      if (dwarf.inWater) {
        dwarf.dir = getWaterEscapeDir(state, dwarf, dwarf.dir);
        dwarf.vx = dwarf.dir * 70;
        dwarf.vy = -220;
      } else if (threat) {
        dwarf.state = DWARF_STATE.FIGHT;
        dwarf.targetX = Math.floor((threat.x + threat.w / 2) / TILE);
        dwarf.targetY = Math.floor((threat.y + threat.h / 2) / TILE);
        moveDirectToward(dwarf, threat, dt);
        if (aabb(dwarf.x, dwarf.y, dwarf.w, dwarf.h, threat.x, threat.y, threat.w, threat.h) && dwarf.attackCd <= 0) {
          dwarf.attackCd = 0.7;
          hitHostile(threat, 1);
        }
      } else if (settlement && settlement.hostileToPlayer) {
        dwarf.state = DWARF_STATE.FIGHT;
        dwarf.targetX = Math.floor((state.player.x + state.player.w / 2) / TILE);
        dwarf.targetY = Math.floor((state.player.y + state.player.h / 2) / TILE);
        moveDirectToward(dwarf, state.player, dt);
        if (aabb(dwarf.x, dwarf.y, dwarf.w, dwarf.h, state.player.x, state.player.y, state.player.w, state.player.h) && dwarf.attackCd <= 0) {
          dwarf.attackCd = 0.85;
          state.player.health = Math.max(0, state.player.health - 1);
          state.attackFlash = 0.18;
          if (state.player.health <= 0) state.gameOver = true;
        }
      } else {
        const playerDist = Math.hypot((state.player.x - dwarf.x), (state.player.y - dwarf.y));
        if (playerDist < 34 && settlement && !settlement.hostileToPlayer && dwarf.state !== DWARF_STATE.MINE) {
          dwarf.vx = 0;
          dwarf.dir = state.player.x < dwarf.x ? -1 : 1;
          dwarf.vy += GRAVITY * dt;
          dwarf.state = DWARF_STATE.ALERT;
        } else {
          if (dwarf.stateTimer <= 0 || dwarf.state === DWARF_STATE.FIGHT) chooseRoutineTask(state, dwarf, settlement);
          moveTowardTarget(state, dwarf, settlement, dt);

          if (dwarf.route && dwarf.route.length) {
            const currentTarget = getNodeById(state, dwarf.route[Math.min(dwarf.routeIndex + 1, dwarf.route.length - 1)]) || getNodeById(state, dwarf.route[dwarf.routeIndex]);
            if (currentTarget && Math.abs(dwarf.x - (currentTarget.x * TILE + 2)) < 5 && Math.abs(dwarf.y - ((currentTarget.y - 1) * TILE)) < 8) {
              if (dwarf.routeIndex < dwarf.route.length - 1) dwarf.routeIndex += 1;
            }
          }

          if (dwarf.state === DWARF_STATE.MINE && dwarf.worksiteIndex >= 0) {
            const worksites = state.dwarfColony.worksites.filter((entry) => entry.settlementId === dwarf.settlementId);
            const worksite = worksites[dwarf.worksiteIndex] || worksites[0];
            if (worksite && advanceWorksiteToRock(state, worksite)) {
              dwarf.targetX = worksite.x;
              dwarf.targetY = worksite.y;
            } else if (worksite) {
              dwarf.stateTimer = 0;
            }
            if (worksite && Math.abs(dwarf.x - worksite.x * TILE) < 10 && Math.abs(dwarf.y - (worksite.y - 1) * TILE) < 20) {
              dwarf.vx = 0;
              dwarf.mineTimer += dt;
              dwarf.dir = worksite.dir;
              if (dwarf.mineTimer >= 1.2) {
                dwarf.mineTimer = 0;
                breakMineTarget(state, worksite);
                dwarf.targetX = worksite.x;
                dwarf.targetY = worksite.y;
              }
            } else {
              dwarf.mineTimer = 0;
            }
          } else {
            dwarf.mineTimer = 0;
          }
        }
      }

      const wasOnGround = dwarf.onGround;
      const preMoveVy = dwarf.vy;
      moveEntity(state, dwarf, dt);
      dwarf.stepUpHeight = 0;
      applyMobEnvironmentDamage(state, dwarf, dt, wasOnGround, preMoveVy);

      if (dwarf.hp <= 0) removeDwarf(state, i, false);
    }
  }

  function onColonyBlockBroken(state, tx, ty) {
    ensureColony(state);
    const brokenBlock = getBlock(state, tx, ty);
    const protectedBlocks = new Set([
      BLOCK.PLANK,
      BLOCK.PILLAR,
      BLOCK.LADDER,
      BLOCK.TORCH,
      BLOCK.CHEST,
      BLOCK.FURNACE,
    ]);
    if (!protectedBlocks.has(brokenBlock)) return false;
    const rooms = [...state.dwarfColony.homes, ...state.dwarfColony.stockpiles, ...state.dwarfColony.halls];
    const hit = rooms.find((room) => tx >= room.x - room.halfW - 1 && tx <= room.x + room.halfW + 1 && ty >= room.y - room.halfH - 2 && ty <= room.y + room.halfH + 2);
    if (!hit) return false;
    const settlement = findSettlement(state, hit.settlementId);
    const severity = settlement && settlement.alertLevel >= 1 ? 2 : 1;
    applySettlementAlert(state, hit.settlementId, severity);
    return true;
  }

  function onChestLootTaken(state, ownerSettlementId) {
    if (!ownerSettlementId) return false;
    const settlement = findSettlement(state, ownerSettlementId);
    if (!settlement) return false;
    let seen = false;
    for (const dwarf of state.dwarves) {
      if (dwarf.settlementId !== ownerSettlementId) continue;
      const dist = Math.hypot((state.player.x - dwarf.x), (state.player.y - dwarf.y));
      if (dist <= 84) {
        seen = true;
        break;
      }
    }
    if (seen) applySettlementAlert(state, ownerSettlementId, settlement.alertLevel >= 1 ? 2 : 1);
    return seen;
  }

  function hitDwarf(state, dwarf, damage = 1) {
    dwarf.hp -= damage;
    applySettlementAlert(state, dwarf.settlementId, 2);
  }

  Game.dwarvesEntity = { updateDwarves, onColonyBlockBroken, onChestLootTaken, hitDwarf, removeDwarf, getNearestTrader };
})();
