(() => {
  const Game = window.MC2D;
  const { ITEM } = Game.items;
  const { BLOCK } = Game.blocks;
  const { countItem } = Game.inventory;
  const { getLocationInfo } = Game.world;
  const { hasFullFriendshipArmor } = Game.combat;

  const ACHIEVEMENTS = [
    { id: 'craft_planks', title: 'Доски', desc: 'Скрафти доски.', iconId: BLOCK.PLANK, group: 'Старт' },
    { id: 'craft_sticks', title: 'Палки', desc: 'Скрафти палки.', iconId: ITEM.STICK, group: 'Старт' },
    { id: 'craft_torch', title: 'Первый факел', desc: 'Скрафти факел.', iconId: BLOCK.TORCH, group: 'Старт' },
    { id: 'craft_stone_pickaxe', title: 'Каменный век', desc: 'Скрафти каменную кирку.', iconId: ITEM.STONE_PICKAXE, group: 'Старт' },
    { id: 'obtain_raw_iron', title: 'Железная руда', desc: 'Добудь железо.', iconId: BLOCK.IRON_ORE, group: 'Железо' },
    { id: 'obtain_iron_ingot', title: 'Железный слиток', desc: 'Получи железный слиток.', iconId: ITEM.IRON_INGOT, group: 'Железо' },
    { id: 'craft_iron_pickaxe', title: 'Железная кирка', desc: 'Скрафти железную кирку.', iconId: ITEM.IRON_PICKAXE, group: 'Железо' },
    { id: 'craft_iron_armor', title: 'Железная броня', desc: 'Скрафти любую часть железной брони.', iconId: ITEM.IRON_CHESTPLATE, group: 'Железо' },
    { id: 'obtain_small_diamond', title: 'Мелкий алмаз', desc: 'Добудь мелкий алмаз.', iconId: ITEM.SMALL_DIAMOND, group: 'Алмазы' },
    { id: 'craft_big_diamond', title: 'Большой алмаз', desc: 'Скрафти большой алмаз.', iconId: ITEM.BIG_DIAMOND, group: 'Алмазы' },
    { id: 'craft_diamond_pickaxe', title: 'Алмазная кирка', desc: 'Скрафти алмазную кирку.', iconId: ITEM.DIAMOND_PICKAXE, group: 'Алмазы' },
    { id: 'obtain_deep_crystal', title: 'Глубинный кристалл', desc: 'Получи глубинный кристалл.', iconId: ITEM.DEEP_CRYSTAL, group: 'Глубины' },
    { id: 'craft_deep_diamond', title: 'Глубинный алмаз', desc: 'Скрафти глубинный алмаз.', iconId: ITEM.DEEP_DIAMOND, group: 'Глубины' },
    { id: 'discover_fire_caves', title: 'Огненные пещеры', desc: 'Найди огненные пещеры.', iconId: BLOCK.BASALT, group: 'Огонь' },
    { id: 'obtain_fire_crystal', title: 'Огненный кристалл', desc: 'Получи огненный кристалл.', iconId: ITEM.FIRE_CRYSTAL, group: 'Огонь' },
    { id: 'fire_ritual', title: 'Ритуал огня', desc: 'Активируй Пирамиду огня.', iconId: BLOCK.FIRE_SEAL, group: 'Огонь' },
    { id: 'defeat_fire_guardian', title: 'Пламя пробуждено', desc: 'Победи огненного стража у пирамиды.', iconId: BLOCK.FIRE_PORTAL, group: 'Огонь' },
    { id: 'enter_fire_dimension', title: 'Огненный мир', desc: 'Войди в огненное измерение.', iconId: BLOCK.FIRE_PORTAL, group: 'Огонь' },
    { id: 'discover_red_land', title: 'Красная земля', desc: 'Открой основной биом огненного мира.', iconId: BLOCK.RED_EARTH, group: 'Огненный мир' },
    { id: 'discover_fire_castle', title: 'Замок огненного короля', desc: 'Найди замок огненного короля.', iconId: BLOCK.BLACKSTONE, group: 'Огненный мир' },
    { id: 'defeat_fire_king', title: 'Огненный король', desc: 'Победи огненного короля.', iconId: ITEM.FIRE_DUNGEON_KEY, group: 'Огненный мир' },
    { id: 'obtain_fire_dungeon_key', title: 'Ключ темницы', desc: 'Получи ключ от огненной темницы.', iconId: ITEM.FIRE_DUNGEON_KEY, group: 'Огненный мир' },
    { id: 'discover_fire_dungeon', title: 'Огненная темница', desc: 'Найди огненную темницу.', iconId: BLOCK.FIRE_SEAL, group: 'Огненный мир' },
    { id: 'free_friendly_king', title: 'Освобождение', desc: 'Освободи доброго огненного короля.', iconId: BLOCK.FIRE_SEAL, group: 'Дружба' },
    { id: 'obtain_friendship_amulet', title: 'Амулет дружбы', desc: 'Получи амулет дружбы.', iconId: BLOCK.FRIENDSHIP_AMULET, group: 'Дружба' },
    { id: 'create_friendship_ore', title: 'Руда дружбы', desc: 'Создай руду дружбы из лавы и воды.', iconId: BLOCK.FRIENDSHIP_ORE, group: 'Дружба' },
    { id: 'obtain_friendship_ingot', title: 'Дружный слиток', desc: 'Получи дружный слиток.', iconId: ITEM.FRIENDSHIP_INGOT, group: 'Дружба' },
    { id: 'craft_friendship_tool', title: 'Высшая дружба', desc: 'Скрафти любой инструмент дружбы.', iconId: ITEM.FRIENDSHIP_PICKAXE, group: 'Дружба' },
    { id: 'full_friendship_armor', title: 'Броня дружбы', desc: 'Надень полный сет брони дружбы.', iconId: ITEM.FRIENDSHIP_CHESTPLATE, group: 'Дружба' },
  ];

  const ACHIEVEMENT_MAP = Object.fromEntries(ACHIEVEMENTS.map((entry) => [entry.id, entry]));
  const CRAFT_UNLOCKS = {
    [BLOCK.PLANK]: 'craft_planks',
    [ITEM.STICK]: 'craft_sticks',
    [BLOCK.TORCH]: 'craft_torch',
    [ITEM.STONE_PICKAXE]: 'craft_stone_pickaxe',
    [ITEM.IRON_PICKAXE]: 'craft_iron_pickaxe',
    [ITEM.IRON_HELMET]: 'craft_iron_armor',
    [ITEM.IRON_CHESTPLATE]: 'craft_iron_armor',
    [ITEM.IRON_LEGGINGS]: 'craft_iron_armor',
    [ITEM.IRON_BOOTS]: 'craft_iron_armor',
    [ITEM.BIG_DIAMOND]: 'craft_big_diamond',
    [ITEM.DIAMOND_PICKAXE]: 'craft_diamond_pickaxe',
    [ITEM.DEEP_DIAMOND]: 'craft_deep_diamond',
    [ITEM.FRIENDSHIP_PICKAXE]: 'craft_friendship_tool',
    [ITEM.FRIENDSHIP_AXE]: 'craft_friendship_tool',
    [ITEM.FRIENDSHIP_SHOVEL]: 'craft_friendship_tool',
    [ITEM.FRIENDSHIP_SWORD]: 'craft_friendship_tool',
  };

  function ensureAchievementsState(state) {
    if (!state.achievements || typeof state.achievements !== 'object') {
      state.achievements = { unlocked: {}, order: [], scanTick: 0 };
    }
    if (!state.achievements.unlocked || typeof state.achievements.unlocked !== 'object') state.achievements.unlocked = {};
    if (!Array.isArray(state.achievements.order)) state.achievements.order = [];
    if (!Number.isFinite(state.achievements.scanTick)) state.achievements.scanTick = 0;
    return state.achievements;
  }

  function isEnabled(state) {
    return !!(state.worldMeta && state.worldMeta.mode === 'survival');
  }

  function isUnlocked(state, id) {
    const achievements = ensureAchievementsState(state);
    return !!achievements.unlocked[id];
  }

  function unlockAchievement(state, id) {
    if (!isEnabled(state)) return false;
    const achievements = ensureAchievementsState(state);
    const achievement = ACHIEVEMENT_MAP[id];
    if (!achievement || achievements.unlocked[id]) return false;
    achievements.unlocked[id] = true;
    achievements.order.push(id);
    state.ui.noticeText = `Достижение: ${achievement.title}`;
    state.ui.noticeTimer = 4;
    return true;
  }

  function recordCraft(state, itemId) {
    const achievementId = CRAFT_UNLOCKS[itemId];
    if (achievementId) unlockAchievement(state, achievementId);
  }

  function recordEvent(state, eventId) {
    if (eventId === 'fire_ritual') unlockAchievement(state, 'fire_ritual');
    else if (eventId === 'defeat_fire_guardian') unlockAchievement(state, 'defeat_fire_guardian');
    else if (eventId === 'enter_fire_dimension') unlockAchievement(state, 'enter_fire_dimension');
    else if (eventId === 'defeat_fire_king') unlockAchievement(state, 'defeat_fire_king');
    else if (eventId === 'free_friendly_king') unlockAchievement(state, 'free_friendly_king');
    else if (eventId === 'create_friendship_ore') unlockAchievement(state, 'create_friendship_ore');
  }

  function scanInventory(state) {
    if (countItem(state, ITEM.RAW_IRON) > 0) unlockAchievement(state, 'obtain_raw_iron');
    if (countItem(state, ITEM.IRON_INGOT) > 0) unlockAchievement(state, 'obtain_iron_ingot');
    if (countItem(state, ITEM.SMALL_DIAMOND) > 0) unlockAchievement(state, 'obtain_small_diamond');
    if (countItem(state, ITEM.DEEP_CRYSTAL) > 0) unlockAchievement(state, 'obtain_deep_crystal');
    if (countItem(state, ITEM.FIRE_CRYSTAL) > 0) unlockAchievement(state, 'obtain_fire_crystal');
    if (countItem(state, ITEM.FIRE_DUNGEON_KEY) > 0) unlockAchievement(state, 'obtain_fire_dungeon_key');
    if (countItem(state, BLOCK.FRIENDSHIP_AMULET) > 0) unlockAchievement(state, 'obtain_friendship_amulet');
    if (countItem(state, ITEM.FRIENDSHIP_INGOT) > 0) unlockAchievement(state, 'obtain_friendship_ingot');
    if (hasFullFriendshipArmor(state)) unlockAchievement(state, 'full_friendship_armor');
  }

  function scanLocation(state) {
    const tx = Math.floor((state.player.x + state.player.w / 2) / Game.constants.TILE);
    const ty = Math.floor((state.player.y + state.player.h / 2) / Game.constants.TILE);
    const location = getLocationInfo(state, tx, ty);
    if (location.biome === 'fire_caves') unlockAchievement(state, 'discover_fire_caves');
    if (state.activeDimension === 'fire') {
      unlockAchievement(state, 'enter_fire_dimension');
      if (location.biome === 'red_land') unlockAchievement(state, 'discover_red_land');
      if (state.fireWorldMeta && state.fireWorldMeta.castle) {
        const castle = state.fireWorldMeta.castle;
        if (tx >= castle.x0 && tx <= castle.x1 && ty >= castle.roofY && ty <= castle.baseY + 2) unlockAchievement(state, 'discover_fire_castle');
      }
      if (state.fireDungeon) {
        const dungeon = state.fireDungeon;
        if (tx >= dungeon.x0 && tx <= dungeon.x1 && ty >= dungeon.y0 && ty <= dungeon.y1) unlockAchievement(state, 'discover_fire_dungeon');
      }
    }
  }

  function updateAchievements(state, dt) {
    ensureAchievementsState(state);
    if (!isEnabled(state)) return;
    state.achievements.scanTick += dt;
    if (state.achievements.scanTick < 0.45) return;
    state.achievements.scanTick = 0;
    scanInventory(state);
    scanLocation(state);
  }

  function getGroupedAchievements() {
    const groups = [];
    const byName = new Map();
    for (const achievement of ACHIEVEMENTS) {
      if (!byName.has(achievement.group)) {
        const entry = { title: achievement.group, items: [] };
        byName.set(achievement.group, entry);
        groups.push(entry);
      }
      byName.get(achievement.group).items.push(achievement);
    }
    return groups;
  }

  Game.achievementsSystem = {
    ACHIEVEMENTS,
    ensureAchievementsState,
    isEnabled,
    isUnlocked,
    unlockAchievement,
    recordCraft,
    recordEvent,
    updateAchievements,
    getGroupedAchievements,
  };
})();
