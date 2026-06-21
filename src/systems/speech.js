(() => {
  const Game = window.MC2D;
  const { TILE } = Game.constants;
  const { phaseInfo } = Game.dayCycle;
  const { SPEECH_LINES } = Game.speechLines;

  const PRIORITY_SCORE = {
    critical_quest: 5,
    danger: 4,
    direct_interaction: 3,
    quest_hint: 2,
    ambient: 1,
  };
  const MAX_BUBBLES = 3;
  const NPC_COOLDOWN = 12;
  const GLOBAL_COOLDOWN = 1;
  const AMBIENT_SCAN_INTERVAL = 1.2;
  const MAX_RECENT = 8;

  function nowSeconds(state) {
    const speech = ensureSpeechState(state);
    return speech.clock || 0;
  }

  function ensureSettings(state) {
    if (!state.settings || typeof state.settings !== 'object') state.settings = {};
    if (state.settings.ambientNpcSpeech == null) state.settings.ambientNpcSpeech = true;
    return state.settings;
  }

  function ensureFactionMemory(state) {
    if (!state.factionMemory || typeof state.factionMemory !== 'object') state.factionMemory = {};
    const memory = state.factionMemory;
    if (!memory.humanVillages || typeof memory.humanVillages !== 'object') memory.humanVillages = {};
    if (!memory.humansGlobal) memory.humansGlobal = { reputation: 0, helped: false, harmed: false, tradedCount: 0 };
    if (!memory.dwarvesGlobal) memory.dwarvesGlobal = { reputation: 0, helped: false, harmed: false, tradedCount: 0 };
    if (!memory.waterfolk) memory.waterfolk = { reputation: 0, helped: false, harmed: false, tradedCount: 0 };
    if (!memory.windfolk) memory.windfolk = { reputation: 0, helped: false, harmed: false, tradedCount: 0 };
    return memory;
  }

  function ensureSpeechState(state) {
    if (!state.speechSystem || typeof state.speechSystem !== 'object') {
      state.speechSystem = {
        clock: 0,
        globalCooldown: 0,
        ambientMuteTimer: 0,
        ambientScanTimer: 0,
        lastPhase: null,
        recentLineIds: [],
        lineCooldowns: {},
        eventQueue: [],
        pendingReplies: [],
      };
    }
    const speech = state.speechSystem;
    speech.clock = Number.isFinite(speech.clock) ? speech.clock : 0;
    speech.globalCooldown = Number.isFinite(speech.globalCooldown) ? speech.globalCooldown : 0;
    speech.ambientMuteTimer = Number.isFinite(speech.ambientMuteTimer) ? speech.ambientMuteTimer : 0;
    speech.ambientScanTimer = Number.isFinite(speech.ambientScanTimer) ? speech.ambientScanTimer : 0;
    speech.lastPhase = typeof speech.lastPhase === 'string' ? speech.lastPhase : null;
    if (!Array.isArray(speech.recentLineIds)) speech.recentLineIds = [];
    if (!speech.lineCooldowns || typeof speech.lineCooldowns !== 'object') speech.lineCooldowns = {};
    if (!Array.isArray(speech.eventQueue)) speech.eventQueue = [];
    if (!Array.isArray(speech.pendingReplies)) speech.pendingReplies = [];
    if (!Array.isArray(state.speechBubbles)) state.speechBubbles = [];
    ensureSettings(state);
    ensureFactionMemory(state);
    return speech;
  }

  function ensureNpcMemory(npc) {
    if (!npc.speechMemory || typeof npc.speechMemory !== 'object') {
      npc.speechMemory = {
        seenPlayer: false,
        lastSpeechAt: -999,
        lastPlayerSpeechAt: -999,
        recentLineIds: [],
        tradedWithPlayer: false,
      };
    }
    const memory = npc.speechMemory;
    memory.seenPlayer = !!memory.seenPlayer;
    memory.lastSpeechAt = Number.isFinite(memory.lastSpeechAt) ? memory.lastSpeechAt : -999;
    memory.lastPlayerSpeechAt = Number.isFinite(memory.lastPlayerSpeechAt) ? memory.lastPlayerSpeechAt : -999;
    if (!Array.isArray(memory.recentLineIds)) memory.recentLineIds = [];
    memory.tradedWithPlayer = !!memory.tradedWithPlayer;
    return memory;
  }

  function getNpcMemory(state, npc) {
    const memory = ensureNpcMemory(npc);
    const now = nowSeconds(state);
    if (memory.lastSpeechAt > now + 5) memory.lastSpeechAt = -999;
    if (memory.lastPlayerSpeechAt > now + 5) memory.lastPlayerSpeechAt = -999;
    return memory;
  }

  function remember(list, id, max = MAX_RECENT) {
    const index = list.indexOf(id);
    if (index >= 0) list.splice(index, 1);
    list.unshift(id);
    while (list.length > max) list.pop();
  }

  function relationFor(reputation, hostile = false) {
    if (hostile) return 'hostile';
    if (reputation <= -50) return 'hostile';
    if (reputation <= -10) return 'wary';
    if (reputation >= 60) return 'grateful';
    if (reputation >= 20) return 'friendly';
    return 'neutral';
  }

  function getHumanVillage(state, villageId) {
    const villages = state.humanSettlements && state.humanSettlements.villages;
    return Array.isArray(villages) ? villages.find((village) => village.id === villageId) || null : null;
  }

  function factionEntryFor(state, group, npc) {
    const memory = ensureFactionMemory(state);
    if (group === 'human' && npc && npc.villageId) {
      if (!memory.humanVillages[npc.villageId]) {
        memory.humanVillages[npc.villageId] = { reputation: 0, helped: false, harmed: false, tradedCount: 0 };
      }
      return memory.humanVillages[npc.villageId];
    }
    if (group === 'human') return memory.humansGlobal;
    if (group === 'dwarf') return memory.dwarvesGlobal;
    if (group === 'waterfolk') return memory.waterfolk;
    if (group === 'windfolk') return memory.windfolk;
    return memory.humansGlobal;
  }

  function hasThreatNearby(state, npc, radius = 130) {
    const lists = [state.zombies || [], state.spiders || [], state.fireGuards || []];
    for (const list of lists) {
      for (const enemy of list) {
        if (!enemy) continue;
        if (Math.hypot(enemy.x - npc.x, enemy.y - npc.y) <= radius) return true;
      }
    }
    return false;
  }

  function npcCenter(npc) {
    return { x: npc.x + (npc.w || 12) / 2, y: npc.y + (npc.h || 20) / 2 };
  }

  function playerDistance(state, npc) {
    const pcx = state.player.x + state.player.w / 2;
    const pcy = state.player.y + state.player.h / 2;
    const center = npcCenter(npc);
    return Math.hypot(pcx - center.x, pcy - center.y);
  }

  function playerDistanceSq(state, npc) {
    const pcx = state.player.x + state.player.w / 2;
    const pcy = state.player.y + state.player.h / 2;
    const center = npcCenter(npc);
    const dx = pcx - center.x;
    const dy = pcy - center.y;
    return dx * dx + dy * dy;
  }

  function isSpeechBlocked(state) {
    return !!(state.gameOver || (state.pause && state.pause.open) || (state.crafting && state.crafting.open) || (state.endingScene && state.endingScene.active));
  }

  function isAmbientAllowed(state) {
    const settings = ensureSettings(state);
    const speech = ensureSpeechState(state);
    if (!settings.ambientNpcSpeech) return false;
    if (speech.ambientMuteTimer > 0) return false;
    if (state.ui && state.ui.noticeTimer > 0) return false;
    return !isSpeechBlocked(state);
  }

  function getNpcGroupKind(npc, group) {
    if (group === 'human') return npc.role === 'guard' ? 'guard' : 'villager';
    if (group === 'dwarf') return npc.role === 'guard' ? 'guard' : 'miner';
    if (group === 'waterfolk' || group === 'windfolk') return npc.chief ? 'chief' : 'villager';
    return npc.kind || null;
  }

  function buildContext(state, speaker, event) {
    const npc = speaker.npc;
    const group = speaker.group;
    const phase = phaseInfo(state);
    const npcMemory = getNpcMemory(state, npc);
    const faction = factionEntryFor(state, group, npc);
    const village = group === 'human' ? getHumanVillage(state, npc.villageId) : null;
    const hostile = !!(village && (village.alertLevel || 0) > 0);
    return {
      group,
      event,
      profession: npc.profession || null,
      kind: getNpcGroupKind(npc, group),
      time: phase.phase === 'night' ? 'night' : 'day',
      phase: phase.phase,
      playerRelation: relationFor(faction.reputation || 0, hostile),
      playerKnown: npcMemory.seenPlayer,
      enemiesNearby: hasThreatNearby(state, npc),
      tradedBefore: npcMemory.tradedWithPlayer || (faction.tradedCount || 0) > 0,
      helpedFaction: !!faction.helped,
      harmedFaction: !!faction.harmed,
      alert: hostile,
      activeDimension: state.activeDimension || 'overworld',
    };
  }

  function lineMatches(line, context) {
    if (line.group !== context.group || line.event !== context.event) return false;
    if (line.profession && line.profession !== context.profession) return false;
    if (line.kind && line.kind !== context.kind) return false;
    const tags = Array.isArray(line.tags) ? line.tags : [];
    if (tags.includes('first_seen') && context.playerKnown) return false;
    if (tags.includes('known') && !context.playerKnown) return false;
    if (line.event === 'greet_player') {
      const relationTags = ['hostile', 'wary', 'neutral', 'friendly', 'grateful'];
      const hasRelationTag = tags.some((tag) => relationTags.includes(tag));
      if (hasRelationTag && !tags.includes(context.playerRelation)) return false;
    }
    if (line.requires) {
      for (const [key, value] of Object.entries(line.requires)) {
        if (context[key] !== value) return false;
      }
    }
    if (line.excludes) {
      for (const [key, value] of Object.entries(line.excludes)) {
        if (context[key] === value) return false;
      }
    }
    return true;
  }

  function renderTemplate(line) {
    let text = line.text;
    if (!line.vars) return text;
    for (const [key, values] of Object.entries(line.vars)) {
      if (!Array.isArray(values) || values.length === 0) continue;
      const value = values[Math.floor(Math.random() * values.length)];
      text = text.replaceAll(`{${key}}`, value);
    }
    return text;
  }

  function chooseLine(state, speaker, event, options = {}) {
    const speech = ensureSpeechState(state);
    const npcMemory = getNpcMemory(state, speaker.npc);
    const context = buildContext(state, speaker, event);
    const candidates = [];
    const now = nowSeconds(state);
    for (const line of SPEECH_LINES) {
      if (!lineMatches(line, context)) continue;
      if (options.threadId && event === 'npc_to_npc_reply' && line.threadId && line.threadId !== options.threadId) continue;
      const cooldownUntil = speech.lineCooldowns[line.id] || 0;
      if (cooldownUntil > now) continue;
      const tags = Array.isArray(line.tags) ? line.tags : [];
      let score = line.weight || 1;
      for (const tag of tags) {
        if (tag === context.time || tag === context.playerRelation) score += 2;
        if (tag === 'known' && context.playerKnown) score += 2;
        if (tag === 'first_seen' && !context.playerKnown) score += 2;
        if (tag === 'danger' && context.enemiesNearby) score += 2;
        if (tag === 'trade' && context.tradedBefore) score += 1;
        if (tag === 'helped' && context.helpedFaction) score += 2;
        if (tag === 'harmed' && context.harmedFaction) score += 2;
      }
      if (options.threadId && line.threadId === options.threadId) score += 5;
      if (npcMemory.recentLineIds.includes(line.id)) score *= 0.15;
      if (speech.recentLineIds.includes(line.id)) score *= 0.35;
      if (score > 0) candidates.push({ line, score });
    }
    const total = candidates.reduce((sum, entry) => sum + entry.score, 0);
    if (total <= 0) return null;
    let roll = Math.random() * total;
    for (const entry of candidates) {
      roll -= entry.score;
      if (roll <= 0) return entry.line;
    }
    return candidates[candidates.length - 1].line;
  }

  function resolveSpeaker(state, ref) {
    if (!ref) return null;
    const list = state[ref.listKey];
    if (!Array.isArray(list)) return null;
    const npc = ref.id
      ? list.find((entry) => entry && entry.id === ref.id)
      : (Number.isFinite(ref.index) ? list[ref.index] : null);
    if (!npc) return null;
    const index = Number.isFinite(ref.index) ? ref.index : list.indexOf(npc);
    return { group: ref.group, listKey: ref.listKey, index, npc };
  }

  function speakerRef(group, listKey, npc, index) {
    return { group, listKey, id: npc.id || null, index };
  }

  function canSpeak(state, speaker, priority) {
    if (!speaker || !speaker.npc) return false;
    const speech = ensureSpeechState(state);
    const memory = getNpcMemory(state, speaker.npc);
    if (priority === 'ambient' && !isAmbientAllowed(state)) return false;
    if (priority === 'ambient' && speech.globalCooldown > 0) return false;
    if (nowSeconds(state) - memory.lastSpeechAt < NPC_COOLDOWN && priority === 'ambient') return false;
    if (state.speechBubbles.some((bubble) => bubble.speakerRef && bubble.speakerRef.listKey === speaker.listKey && bubble.speakerRef.index === speaker.index && (!bubble.speakerRef.id || bubble.speakerRef.id === (speaker.npc.id || null)))) return false;
    return true;
  }

  function addBubble(state, speaker, line, priority) {
    const speech = ensureSpeechState(state);
    const memory = getNpcMemory(state, speaker.npc);
    const text = renderTemplate(line);
    if (!text) return false;
    if (state.speechBubbles.length >= MAX_BUBBLES) {
      const ambientIndex = state.speechBubbles.findIndex((bubble) => bubble.priority === 'ambient');
      if (priority === 'critical_quest' && ambientIndex >= 0) state.speechBubbles.splice(ambientIndex, 1);
      else return false;
    }
    state.speechBubbles.push({
      id: `speech-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e5).toString(36)}`,
      speakerRef: speakerRef(speaker.group, speaker.listKey, speaker.npc, speaker.index),
      x: speaker.npc.x,
      y: speaker.npc.y,
      text,
      timer: 3.4,
      maxTimer: 3.4,
      priority,
    });
    memory.lastSpeechAt = nowSeconds(state);
    if (line.event === 'greet_player') {
      memory.seenPlayer = true;
      memory.lastPlayerSpeechAt = nowSeconds(state);
    }
    remember(memory.recentLineIds, line.id);
    remember(speech.recentLineIds, line.id);
    speech.lineCooldowns[line.id] = nowSeconds(state) + (line.cooldown || 60);
    speech.globalCooldown = GLOBAL_COOLDOWN;
    return true;
  }

  function enqueueSpeech(state, ref, event, priority = 'ambient', options = {}) {
    const speech = ensureSpeechState(state);
    if (priority === 'ambient' && !isAmbientAllowed(state)) return false;
    if (priority === 'critical_quest') speech.ambientMuteTimer = Math.max(speech.ambientMuteTimer, 4);
    const existing = speech.eventQueue.find((entry) => entry.event === event && entry.speakerRef && ref && entry.speakerRef.id === ref.id && entry.speakerRef.index === ref.index);
    if (existing) return false;
    speech.eventQueue.push({
      id: `event-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e5).toString(36)}`,
      priority,
      event,
      speakerRef: ref,
      targetRef: options.targetRef || null,
      threadId: options.threadId || null,
      createdAt: nowSeconds(state),
      expiresIn: options.expiresIn || (priority === 'ambient' ? 2 : 4),
    });
    return true;
  }

  function hasPendingReply(speech, ref) {
    return speech.pendingReplies.some((reply) => reply.speakerRef && reply.speakerRef.listKey === ref.listKey && reply.speakerRef.index === ref.index && (!reply.speakerRef.id || reply.speakerRef.id === ref.id));
  }

  function processQueue(state) {
    const speech = ensureSpeechState(state);
    const now = nowSeconds(state);
    speech.eventQueue = speech.eventQueue.filter((entry) => now - entry.createdAt <= entry.expiresIn);
    speech.eventQueue.sort((a, b) => (PRIORITY_SCORE[b.priority] || 0) - (PRIORITY_SCORE[a.priority] || 0));
    const event = speech.eventQueue.shift();
    if (!event) return;
    if (state.ui && state.ui.noticeTimer > 0 && (event.priority === 'ambient' || event.priority === 'quest_hint')) return;
    const speaker = resolveSpeaker(state, event.speakerRef);
    if (!canSpeak(state, speaker, event.priority)) return;
    const line = chooseLine(state, speaker, event.event, { threadId: event.threadId || null });
    if (!line) return;
    if (addBubble(state, speaker, line, event.priority) && event.event === 'npc_to_npc_start' && event.targetRef && !hasPendingReply(speech, event.targetRef)) {
      speech.pendingReplies.push({
        speakerRef: event.targetRef,
        event: 'npc_to_npc_reply',
        threadId: line.threadId || null,
        timer: 1 + Math.random(),
      });
    }
  }

  function updateBubbles(state, dt) {
    if (!Array.isArray(state.speechBubbles)) state.speechBubbles = [];
    for (let i = state.speechBubbles.length - 1; i >= 0; i -= 1) {
      const bubble = state.speechBubbles[i];
      bubble.timer -= dt;
      const speaker = resolveSpeaker(state, bubble.speakerRef);
      if (speaker) {
        bubble.x = speaker.npc.x;
        bubble.y = speaker.npc.y;
      }
      if (bubble.timer <= 0) state.speechBubbles.splice(i, 1);
    }
  }

  function updatePendingReplies(state, dt) {
    const speech = ensureSpeechState(state);
    for (let i = speech.pendingReplies.length - 1; i >= 0; i -= 1) {
      const reply = speech.pendingReplies[i];
      reply.timer -= dt;
      if (reply.timer > 0) continue;
      speech.pendingReplies.splice(i, 1);
      enqueueSpeech(state, reply.speakerRef, reply.event, 'ambient', { expiresIn: 2, threadId: reply.threadId || null });
    }
  }

  function collectSpeakers(state) {
    const speakers = [];
    function pushList(group, listKey, list) {
      if (!Array.isArray(list)) return;
      for (let i = 0; i < list.length; i += 1) {
        const npc = list[i];
        if (!npc || !Number.isFinite(npc.x) || !Number.isFinite(npc.y)) continue;
        speakers.push({ group, listKey, index: i, npc });
      }
    }
    pushList('human', 'humans', state.humans);
    pushList('dwarf', 'dwarves', state.dwarves);
    if (state.activeDimension === 'water') pushList('waterfolk', 'waterfolk', state.waterfolk);
    if (state.activeDimension === 'air') pushList('windfolk', 'windfolk', state.windfolk);
    return speakers;
  }

  function isNpcAvailableForAmbient(speaker) {
    const npc = speaker.npc;
    if (npc.sleeping) return false;
    if (npc.state === 'fight' || npc.state === 'flee' || npc.state === 'sleep') return false;
    return true;
  }

  function scanAmbient(state) {
    if (!isAmbientAllowed(state)) return;
    const invisibility = Game.invisibilitySystem || {};
    if (invisibility.isPlayerUndetectable && invisibility.isPlayerUndetectable(state)) return;
    const speech = ensureSpeechState(state);
    const speakers = [];
    for (const speaker of collectSpeakers(state)) {
      if (!isNpcAvailableForAmbient(speaker)) continue;
      const distanceSq = playerDistanceSq(state, speaker.npc);
      if (distanceSq > 130 * 130) continue;
      speakers.push({ ...speaker, distanceSq });
    }
    if (speakers.length === 0) return;
    const dangerSpeaker = speakers.find((speaker) => hasThreatNearby(state, speaker.npc));
    if (dangerSpeaker) {
      enqueueSpeech(state, speakerRef(dangerSpeaker.group, dangerSpeaker.listKey, dangerSpeaker.npc, dangerSpeaker.index), 'danger', 'danger');
      return;
    }
    const playerSpeaker = speakers.find((speaker) => speaker.distanceSq <= 78 * 78 && nowSeconds(state) - getNpcMemory(state, speaker.npc).lastPlayerSpeechAt > 45);
    if (playerSpeaker) {
      enqueueSpeech(state, speakerRef(playerSpeaker.group, playerSpeaker.listKey, playerSpeaker.npc, playerSpeaker.index), 'greet_player', 'direct_interaction');
      return;
    }
    const phase = phaseInfo(state);
    if (phase.phase === 'night') {
      const nightSpeaker = speakers.find((speaker) => nowSeconds(state) - getNpcMemory(state, speaker.npc).lastSpeechAt > 90);
      if (nightSpeaker) enqueueSpeech(state, speakerRef(nightSpeaker.group, nightSpeaker.listKey, nightSpeaker.npc, nightSpeaker.index), 'night', 'ambient');
      return;
    }
    for (let i = 0; i < speakers.length; i += 1) {
      for (let j = i + 1; j < speakers.length; j += 1) {
        const a = speakers[i];
        const b = speakers[j];
        if (a.group !== b.group) continue;
        if (Math.hypot(a.npc.x - b.npc.x, a.npc.y - b.npc.y) > 70) continue;
        const aRef = speakerRef(a.group, a.listKey, a.npc, a.index);
        const bRef = speakerRef(b.group, b.listKey, b.npc, b.index);
        if (hasPendingReply(speech, aRef) || hasPendingReply(speech, bRef)) continue;
        enqueueSpeech(state, aRef, 'npc_to_npc_start', 'ambient', {
          targetRef: bRef,
        });
        return;
      }
    }
  }

  function enqueueMorning(state) {
    if (!isAmbientAllowed(state)) return;
    const speakers = collectSpeakers(state).filter((speaker) => isNpcAvailableForAmbient(speaker) && playerDistance(state, speaker.npc) <= 130);
    const speaker = speakers.find((entry) => nowSeconds(state) - getNpcMemory(state, entry.npc).lastSpeechAt > 60);
    if (speaker) enqueueSpeech(state, speakerRef(speaker.group, speaker.listKey, speaker.npc, speaker.index), 'morning', 'ambient', { expiresIn: 3 });
  }

  function updatePhaseSpeech(state) {
    const speech = ensureSpeechState(state);
    const phase = phaseInfo(state).phase;
    const previous = speech.lastPhase;
    speech.lastPhase = phase;
    if (previous === 'night' && phase !== 'night') enqueueMorning(state);
  }

  function updateSpeech(state, dt) {
    const speech = ensureSpeechState(state);
    speech.clock += dt;
    speech.globalCooldown = Math.max(0, speech.globalCooldown - dt);
    speech.ambientMuteTimer = Math.max(0, speech.ambientMuteTimer - dt);
    updateBubbles(state, dt);
    if (isSpeechBlocked(state)) return;
    updatePhaseSpeech(state);
    updatePendingReplies(state, dt);
    speech.ambientScanTimer -= dt;
    if (speech.ambientScanTimer <= 0) {
      speech.ambientScanTimer = AMBIENT_SCAN_INTERVAL;
      scanAmbient(state);
    }
    processQueue(state);
  }

  function recordTrade(state, trader) {
    if (!trader) return;
    const speech = ensureSpeechState(state);
    let speaker = null;
    if (trader.kind === 'human' && trader.human) {
      const index = (state.humans || []).indexOf(trader.human);
      speaker = { group: 'human', listKey: 'humans', index, npc: trader.human };
    } else if (trader.dwarf) {
      const index = (state.dwarves || []).indexOf(trader.dwarf);
      speaker = { group: 'dwarf', listKey: 'dwarves', index, npc: trader.dwarf };
    }
    if (!speaker || speaker.index < 0) return;
    const npcMemory = getNpcMemory(state, speaker.npc);
    npcMemory.tradedWithPlayer = true;
    const faction = factionEntryFor(state, speaker.group, speaker.npc);
    faction.tradedCount = (faction.tradedCount || 0) + 1;
    faction.reputation = Math.min(100, (faction.reputation || 0) + 1);
    speech.ambientMuteTimer = Math.max(speech.ambientMuteTimer, 1);
    enqueueSpeech(state, speakerRef(speaker.group, speaker.listKey, speaker.npc, speaker.index), 'trade_after', 'direct_interaction', { expiresIn: 30 });
  }

  function notifyDwarfHostile(state, settlementId) {
    const speech = ensureSpeechState(state);
    let best = null;
    let bestDist = Infinity;
    for (let i = 0; i < (state.dwarves || []).length; i += 1) {
      const dwarf = state.dwarves[i];
      if (!dwarf || dwarf.settlementId !== settlementId) continue;
      const dist = playerDistance(state, dwarf);
      if (dist < bestDist) {
        best = { group: 'dwarf', listKey: 'dwarves', index: i, npc: dwarf };
        bestDist = dist;
      }
    }
    if (!best) return false;
    speech.ambientMuteTimer = Math.max(speech.ambientMuteTimer, 4);
    const faction = factionEntryFor(state, 'dwarf', best.npc);
    faction.harmed = true;
    return enqueueSpeech(state, speakerRef(best.group, best.listKey, best.npc, best.index), 'dwarf_hostile', 'direct_interaction', { expiresIn: 5 });
  }

  function findNearestSpeaker(state, group) {
    let best = null;
    let bestDist = Infinity;
    for (const speaker of collectSpeakers(state)) {
      if (speaker.group !== group) continue;
      const dist = playerDistance(state, speaker.npc);
      if (dist < bestDist) {
        best = speaker;
        bestDist = dist;
      }
    }
    return best;
  }

  function notifyPlayerHelped(state, group = 'human') {
    const speaker = findNearestSpeaker(state, group);
    if (!speaker) return false;
    const faction = factionEntryFor(state, speaker.group, speaker.npc);
    faction.helped = true;
    return enqueueSpeech(state, speakerRef(speaker.group, speaker.listKey, speaker.npc, speaker.index), 'player_helped', 'direct_interaction', { expiresIn: 5 });
  }

  function notifyPlayerHarmed(state, group = 'human') {
    const speaker = findNearestSpeaker(state, group);
    if (!speaker) return false;
    const faction = factionEntryFor(state, speaker.group, speaker.npc);
    faction.harmed = true;
    return enqueueSpeech(state, speakerRef(speaker.group, speaker.listKey, speaker.npc, speaker.index), 'player_harmed', 'direct_interaction', { expiresIn: 5 });
  }

  Game.speechSystem = {
    ensureSpeechState,
    ensureSettings,
    ensureFactionMemory,
    updateSpeech,
    enqueueSpeech,
    recordTrade,
    notifyDwarfHostile,
    notifyPlayerHelped,
    notifyPlayerHarmed,
  };
})();
