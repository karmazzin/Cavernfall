(() => {
  const Game = window.MC2D;
  const { TILE, GRAVITY } = Game.constants;
  const { rand, aabb } = Game.math;
  const { moveEntity } = Game.physics;
  const { BLOCK } = Game.blocks;
  const { getBlock } = Game.world;
  const { ensureMobState, updateMobMediumState, getWaterEscapeDir, applyMobEnvironmentDamage } = Game.mobUtils;
  const { setDoorOpen } = Game.doorSystem;

  const HUMAN_ROLE = {
    VILLAGER: 'villager',
    GUARD: 'guard',
  };

  const HUMAN_STATE = {
    IDLE: 'idle',
    ROAM: 'roam',
    WORK: 'work',
    FLEE: 'flee',
    GUARD: 'guard',
    FIGHT: 'fight',
  };

  const MAX_HUMANS = 40;

  function ensureSettlements(state) {
    if (!state.humanSettlements || typeof state.humanSettlements !== 'object') {
      state.humanSettlements = { villages: [], nodes: [], edges: [] };
    }
    if (!Array.isArray(state.humanSettlements.villages)) state.humanSettlements.villages = [];
    if (!Array.isArray(state.humanSettlements.nodes)) state.humanSettlements.nodes = [];
    if (!Array.isArray(state.humanSettlements.edges)) state.humanSettlements.edges = [];
    for (const village of state.humanSettlements.villages) {
      if (!Number.isFinite(village.alertLevel)) village.alertLevel = 0;
      if (!Number.isFinite(village.alertTimer)) village.alertTimer = 0;
      if (!Array.isArray(village.houses)) village.houses = [];
      if (!Array.isArray(village.towers)) village.towers = [];
      if (!village.palette) village.palette = { body: '#75624f', accent: '#5477a7', hat: '#8f6a3f' };
    }
    for (const village of state.humanSettlements.villages) {
      for (const house of village.houses || []) {
        if (!Number.isFinite(house.respawnTimer)) house.respawnTimer = 0;
        if (house.residentId == null) house.residentId = null;
      }
    }
  }

  function getVillage(state, id) {
    ensureSettlements(state);
    return state.humanSettlements.villages.find((village) => village.id === id) || null;
  }

  function getNodeById(state, nodeId) {
    return state.humanSettlements.nodes.find((node) => node.id === nodeId) || null;
  }

  function getNearestNode(state, settlementId, x, y, allowedKinds = null) {
    let best = null;
    let bestDist = Infinity;
    for (const node of state.humanSettlements.nodes) {
      if (node.settlementId !== settlementId) continue;
      if (allowedKinds && !allowedKinds.includes(node.kind)) continue;
      const dist = Math.abs(node.x - x) + Math.abs(node.y - y);
      if (dist < bestDist) {
        best = node;
        bestDist = dist;
      }
    }
    return best;
  }

  function edgeTypeBetween(state, fromId, toId) {
    const edge = state.humanSettlements.edges.find((entry) => entry.from === fromId && entry.to === toId);
    return edge ? edge.type : 'walk';
  }

  function findPath(state, settlementId, fromId, toId) {
    if (!fromId || !toId) return [];
    if (fromId === toId) return [fromId];
    const queue = [fromId];
    const prev = new Map([[fromId, null]]);
    while (queue.length) {
      const current = queue.shift();
      for (const edge of state.humanSettlements.edges) {
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

  function createHuman(house, village) {
    const human = {
      id: `${house.id}-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e5).toString(36)}`,
      villageId: village.id,
      homeId: house.id,
      x: house.spawnX * TILE + 2,
      y: (house.spawnY - 1) * TILE,
      w: 12,
      h: 22,
      vx: 0,
      vy: 0,
      hp: 4,
      onGround: false,
      dir: Math.random() < 0.5 ? -1 : 1,
      role: house.role,
      profession: house.profession,
      palette: village.palette,
      state: house.role === HUMAN_ROLE.GUARD ? HUMAN_STATE.GUARD : HUMAN_STATE.IDLE,
      stateTimer: rand(1.2, 2.8),
      route: [],
      routeIndex: 0,
      routeTargetId: house.nodeId,
      attackCd: 0,
      clickCd: 0,
      homeNodeId: house.nodeId,
      workNodeId: house.workNodeId || null,
      towerNodeId: house.towerNodeId || null,
    };
    ensureMobState(human);
    return human;
  }

  function spawnResident(state, house, village) {
    if (state.humans.length >= MAX_HUMANS || house.residentId) return false;
    const human = createHuman(house, village);
    house.residentId = human.id;
    state.humans.push(human);
    return true;
  }

  function assignRoute(state, human, destinationNode, nextState) {
    if (!destinationNode) return;
    const startNode = getNearestNode(
      state,
      human.villageId,
      Math.floor((human.x + human.w / 2) / TILE),
      Math.floor((human.y + human.h) / TILE),
      ['center', 'house', 'tower_base', 'tower_top', 'work']
    );
    const path = findPath(state, human.villageId, startNode ? startNode.id : destinationNode.id, destinationNode.id);
    human.route = path.length ? path : [destinationNode.id];
    human.routeIndex = 0;
    human.routeTargetId = destinationNode.id;
    human.state = nextState;
    human.stateTimer = nextState === HUMAN_STATE.WORK ? rand(6, 10) : rand(2.5, 5.2);
  }

  function nearestThreat(state, human) {
    let best = null;
    let bestDist = 150;
    for (const zombie of state.zombies) {
      const dist = Math.hypot(zombie.x - human.x, zombie.y - human.y);
      if (dist < bestDist) {
        best = zombie;
        bestDist = dist;
      }
    }
    for (const spider of state.spiders) {
      const dist = Math.hypot(spider.x - human.x, spider.y - human.y);
      if (dist < bestDist) {
        best = spider;
        bestDist = dist;
      }
    }
    return best;
  }

  function setVillageAlert(state, villageId, level = 1) {
    const village = getVillage(state, villageId);
    if (!village) return;
    village.alertLevel = Math.max(village.alertLevel || 0, level);
    village.alertTimer = 18;
    for (const tower of village.towers || []) {
      for (const doorX of tower.doorXs || [tower.doorX]) setDoorOpen(state, doorX, tower.doorY, false);
    }
  }

  function clearVillageAlert(state, village) {
    village.alertLevel = 0;
    village.alertTimer = 0;
    for (const tower of village.towers || []) {
      for (const doorX of tower.doorXs || [tower.doorX]) setDoorOpen(state, doorX, tower.doorY, true);
    }
  }

  function getHumanHouse(state, human) {
    const village = getVillage(state, human.villageId);
    if (!village) return null;
    return (village.houses || []).find((house) => house.id === human.homeId) || null;
  }

  function setHouseDoors(state, house, open) {
    if (!house) return;
    if (Number.isFinite(house.leftDoorX)) setDoorOpen(state, house.leftDoorX, house.doorY, open);
    if (Number.isFinite(house.rightDoorX)) setDoorOpen(state, house.rightDoorX, house.doorY, open);
  }

  function moveAlongRoute(state, human, dt) {
    if (!human.route || !human.route.length) return;
    const currentNode = getNodeById(state, human.route[human.routeIndex]) || null;
    const nextNode = getNodeById(state, human.route[Math.min(human.routeIndex + 1, human.route.length - 1)]) || currentNode;
    const targetNode = nextNode || currentNode;
    if (!targetNode) return;
    const targetPx = targetNode.x * TILE + 2;
    const targetPy = (targetNode.y - 1) * TILE;
    const edgeType = currentNode && nextNode ? edgeTypeBetween(state, currentNode.id, nextNode.id) : 'walk';
    human.vx = 0;
    human.stepUpHeight = TILE;

    if (edgeType === 'ladder') {
      if (Math.abs(targetPx - human.x) > 2) {
        human.vx = Math.sign(targetPx - human.x) * 54;
        human.dir = human.vx < 0 ? -1 : 1;
        human.vy += GRAVITY * dt;
      } else {
        human.x = targetNode.x * TILE + 2;
        human.vx = 0;
        human.vy = Math.abs(targetPy - human.y) > 4 ? Math.sign(targetPy - human.y) * 126 : 0;
      }
    } else {
      const dx = targetPx - human.x;
      if (Math.abs(dx) > 3) {
        human.vx = Math.sign(dx) * (human.role === HUMAN_ROLE.GUARD ? 62 : 48);
        human.dir = human.vx < 0 ? -1 : 1;
      }
      human.vy += GRAVITY * dt;
    }

    if (Math.abs(human.x - targetPx) < 5 && Math.abs(human.y - targetPy) < 8 && human.routeIndex < human.route.length - 1) {
      human.routeIndex += 1;
    }
  }

  function chooseTask(state, human, village) {
    const centerNodes = state.humanSettlements.nodes.filter((node) => node.settlementId === human.villageId && node.kind === 'center');
    const towerBaseNodes = state.humanSettlements.nodes.filter((node) => node.settlementId === human.villageId && node.kind === 'tower_base');
    const workNodes = state.humanSettlements.nodes.filter((node) => node.settlementId === human.villageId && node.kind === 'work');
    const homeNode = getNodeById(state, human.homeNodeId);
    const roll = Math.random();

    if (human.role === HUMAN_ROLE.GUARD) {
      const preferredTower = human.towerNodeId ? getNodeById(state, human.towerNodeId) : null;
      const target = preferredTower && roll < 0.62
        ? preferredTower
        : roll < 0.8 && towerBaseNodes.length
          ? towerBaseNodes[Math.floor(rand(0, towerBaseNodes.length))]
        : centerNodes[Math.floor(rand(0, centerNodes.length))] || homeNode;
      assignRoute(state, human, target, HUMAN_STATE.GUARD);
      return;
    }

    if (roll < 0.2 && homeNode) {
      assignRoute(state, human, homeNode, HUMAN_STATE.IDLE);
      return;
    }
    if (roll < 0.72 && workNodes.length) {
      const filtered = workNodes.filter((node) => !node.profession || node.profession === human.profession);
      const pool = filtered.length ? filtered : workNodes;
      assignRoute(state, human, pool[Math.floor(rand(0, pool.length))], HUMAN_STATE.WORK);
      return;
    }
    if (centerNodes.length) {
      assignRoute(state, human, centerNodes[Math.floor(rand(0, centerNodes.length))], HUMAN_STATE.ROAM);
      return;
    }
    if (homeNode) assignRoute(state, human, homeNode, HUMAN_STATE.ROAM);
  }

  function getNearestHumanTrader(state, maxDistance = 80) {
    ensureSettlements(state);
    let best = null;
    let bestDist = maxDistance;
    for (const human of state.humans) {
      if (human.role !== HUMAN_ROLE.VILLAGER) continue;
      const village = getVillage(state, human.villageId);
      if (!village || (village.alertLevel || 0) > 0) continue;
      const dist = Math.hypot(state.player.x - human.x, state.player.y - human.y);
      if (dist <= bestDist) {
        best = { kind: 'human', human, village };
        bestDist = dist;
      }
    }
    return best;
  }

  function updateHumans(state, dt) {
    ensureSettlements(state);

    for (const village of state.humanSettlements.villages) {
      village.alertTimer = Math.max(0, (village.alertTimer || 0) - dt);
      if (village.alertTimer <= 0 && (village.alertLevel || 0) > 0) clearVillageAlert(state, village);
    }

    for (const village of state.humanSettlements.villages) {
      for (const house of village.houses || []) {
        if (house.residentId) continue;
        house.respawnTimer = Math.max(0, (house.respawnTimer || 0) - dt);
        if (house.respawnTimer <= 0 && state.humans.length < MAX_HUMANS) spawnResident(state, house, village);
      }
    }

    for (let i = state.humans.length - 1; i >= 0; i -= 1) {
      const human = state.humans[i];
      ensureMobState(human);
      if (!Array.isArray(human.route)) human.route = [];
      const village = getVillage(state, human.villageId);
      const threat = nearestThreat(state, human);
      human.attackCd = Math.max(0, (human.attackCd || 0) - dt);
      human.stateTimer -= dt;
      updateMobMediumState(state, human);

      if (village && threat) setVillageAlert(state, village.id, 1);

      if (human.inWater) {
        human.dir = getWaterEscapeDir(state, human, human.dir);
        human.vx = human.dir * 72;
        human.vy = -220;
      } else if (threat && human.role === HUMAN_ROLE.GUARD) {
        human.state = HUMAN_STATE.FIGHT;
        const dx = threat.x - human.x;
        human.vx = Math.abs(dx) > 4 ? Math.sign(dx) * 74 : 0;
        if (human.vx !== 0) human.dir = human.vx < 0 ? -1 : 1;
        human.vy += GRAVITY * dt;
        if (aabb(human.x, human.y, human.w, human.h, threat.x, threat.y, threat.w, threat.h) && human.attackCd <= 0) {
          human.attackCd = 0.8;
          threat.hp -= 1;
        }
      } else {
        if (threat && human.role !== HUMAN_ROLE.GUARD) {
          const homeNode = getNodeById(state, human.homeNodeId);
          if (homeNode && human.state !== HUMAN_STATE.FLEE) assignRoute(state, human, homeNode, HUMAN_STATE.FLEE);
        } else if (human.stateTimer <= 0 || !human.route.length) {
          chooseTask(state, human, village);
        }

        moveAlongRoute(state, human, dt);

        const homeNode = getNodeById(state, human.homeNodeId);
        const house = getHumanHouse(state, human);
        const shouldAutoOpenDoors = !(threat && human.role !== HUMAN_ROLE.GUARD && human.state !== HUMAN_STATE.FLEE);
        if (shouldAutoOpenDoors) {
          const tx = Math.floor((human.x + human.w / 2) / TILE);
          const ty = Math.floor((human.y + human.h) / TILE);
          for (let yy = ty - 2; yy <= ty + 1; yy += 1) {
            for (let xx = tx - 1; xx <= tx + 1; xx += 1) {
              if (getBlock(state, xx, yy) === BLOCK.DOOR) setDoorOpen(state, xx, yy, true);
            }
          }
        }

        if (human.state === HUMAN_STATE.FLEE && homeNode) {
          const homePx = homeNode.x * TILE + 2;
          const homePy = (homeNode.y - 1) * TILE;
          if (Math.abs(human.x - homePx) < 8 && Math.abs(human.y - homePy) < 12) {
            human.vx = 0;
            setHouseDoors(state, house, false);
            human.state = HUMAN_STATE.IDLE;
            human.stateTimer = threat ? 1.25 : rand(1.5, 2.5);
          }
        } else if (!threat && human.role !== HUMAN_ROLE.GUARD && house && human.state !== HUMAN_STATE.FLEE && Math.random() < dt * 0.6) {
          setHouseDoors(state, house, true);
        }

        if (human.state === HUMAN_STATE.WORK && human.route.length) {
          const node = getNodeById(state, human.route[human.route.length - 1]);
          if (node && Math.abs(human.x - (node.x * TILE + 2)) < 8 && Math.abs(human.y - ((node.y - 1) * TILE)) < 12) {
            human.vx = 0;
          }
        }
      }

      const wasOnGround = human.onGround;
      const preMoveVy = human.vy;
      moveEntity(state, human, dt);
      human.stepUpHeight = 0;
      applyMobEnvironmentDamage(state, human, dt, wasOnGround, preMoveVy);

      if (human.hp <= 0) {
        const villageData = getVillage(state, human.villageId);
        if (villageData) {
          const house = (villageData.houses || []).find((entry) => entry.id === human.homeId);
          if (house) {
            house.residentId = null;
            house.respawnTimer = rand(35, 60);
          }
        }
        state.humans.splice(i, 1);
      }
    }
  }

  Game.humansEntity = { updateHumans, getNearestHumanTrader, HUMAN_ROLE };
})();
