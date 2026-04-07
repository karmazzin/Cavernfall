(() => {
  const Game = window.MC2D;
  const { STACK_LIMIT } = Game.constants;
  const { BLOCK, PLACEABLE } = Game.blocks;

  const ITEM = {
    STICK: 'stick',
    RAW_MUTTON: 'raw_mutton',
    COAL: 'coal',
    CHARCOAL: 'charcoal',
    RAW_IRON: 'raw_iron',
    IRON_INGOT: 'iron_ingot',
    SMALL_DIAMOND: 'small_diamond',
    BIG_DIAMOND: 'big_diamond',
    RAW_GOLD: 'raw_gold',
    GOLD_INGOT: 'gold_ingot',
    COIN: 'coin',
    DEEP_CRYSTAL: 'deep_crystal',
    DEEP_DIAMOND: 'deep_diamond',
    FIRE_CRYSTAL: 'fire_crystal',
    FIRE_DUNGEON_KEY: 'fire_dungeon_key',
    FRIENDSHIP_INGOT: 'friendship_ingot',
    WHEAT: 'wheat',
    CARROT: 'carrot',
    WOODEN_PICKAXE: 'wooden_pickaxe',
    WOODEN_AXE: 'wooden_axe',
    WOODEN_SHOVEL: 'wooden_shovel',
    WOODEN_SWORD: 'wooden_sword',
    STONE_PICKAXE: 'stone_pickaxe',
    STONE_AXE: 'stone_axe',
    STONE_SHOVEL: 'stone_shovel',
    STONE_SWORD: 'stone_sword',
    IRON_PICKAXE: 'iron_pickaxe',
    IRON_AXE: 'iron_axe',
    IRON_SHOVEL: 'iron_shovel',
    IRON_SWORD: 'iron_sword',
    IRON_HELMET: 'iron_helmet',
    IRON_CHESTPLATE: 'iron_chestplate',
    IRON_LEGGINGS: 'iron_leggings',
    IRON_BOOTS: 'iron_boots',
    FRIENDSHIP_HELMET: 'friendship_helmet',
    FRIENDSHIP_CHESTPLATE: 'friendship_chestplate',
    FRIENDSHIP_LEGGINGS: 'friendship_leggings',
    FRIENDSHIP_BOOTS: 'friendship_boots',
    DIAMOND_PICKAXE: 'diamond_pickaxe',
    DIAMOND_AXE: 'diamond_axe',
    DIAMOND_SHOVEL: 'diamond_shovel',
    DIAMOND_SWORD: 'diamond_sword',
    FRIENDSHIP_PICKAXE: 'friendship_pickaxe',
    FRIENDSHIP_AXE: 'friendship_axe',
    FRIENDSHIP_SHOVEL: 'friendship_shovel',
    FRIENDSHIP_SWORD: 'friendship_sword',
  };

  const BLOCK_LABELS = {
    [BLOCK.GRASS]: 'Трава',
    [BLOCK.DIRT]: 'Земля',
    [BLOCK.STONE]: 'Камень',
    [BLOCK.WOOD]: 'Дерево',
    [BLOCK.LEAF]: 'Листва',
    [BLOCK.WATER]: 'Вода',
    [BLOCK.LAVA]: 'Лава',
    [BLOCK.BEDROCK]: 'Бедрок',
    [BLOCK.PLANK]: 'Доски',
    [BLOCK.COBWEB]: 'Паутина',
    [BLOCK.COAL_ORE]: 'Угольная руда',
    [BLOCK.TORCH]: 'Факел',
    [BLOCK.FURNACE]: 'Печка',
    [BLOCK.BLACKSTONE]: 'Чёрный камень',
    [BLOCK.GOLD_ORE]: 'Золотая руда',
    [BLOCK.IRON_ORE]: 'Железная руда',
    [BLOCK.DIAMOND_ORE]: 'Алмазная руда',
    [BLOCK.PILLAR]: 'Столб',
    [BLOCK.LADDER]: 'Лестница',
    [BLOCK.DEEPSTONE]: 'Глубинный камень',
    [BLOCK.DEEP_ORE]: 'Глубинная руда',
    [BLOCK.CHEST]: 'Сундук',
    [BLOCK.DOOR]: 'Дверь',
    [BLOCK.PATH]: 'Тропинка',
    [BLOCK.SAND]: 'Песок',
    [BLOCK.SANDSTONE]: 'Песчаник',
    [BLOCK.CACTUS]: 'Кактус',
    [BLOCK.DRY_BUSH]: 'Сухой куст',
    [BLOCK.BASALT]: 'Базальт',
    [BLOCK.FIRE_SEAL]: 'Огненная печать',
    [BLOCK.FIRE_PORTAL]: 'Портал в огненный мир',
    [BLOCK.RED_EARTH]: 'Красная земля',
    [BLOCK.FRIENDSHIP_ORE]: 'Руда дружбы',
    [BLOCK.FRIENDSHIP_AMULET]: 'Амулет дружбы',
    [BLOCK.PILLOW]: 'Подушка',
    [BLOCK.SNOW]: 'Снег',
    [BLOCK.SPRUCE_WOOD]: 'Еловый ствол',
    [BLOCK.SPRUCE_LEAF]: 'Еловая хвоя',
  };

  const ITEM_DEFS = {
    [ITEM.STICK]: { id: ITEM.STICK, label: 'Палка', kind: 'material', stackLimit: STACK_LIMIT },
    [ITEM.RAW_MUTTON]: { id: ITEM.RAW_MUTTON, label: 'Сырая баранина', kind: 'food', stackLimit: STACK_LIMIT, foodRestore: 20 },
    [ITEM.COAL]: { id: ITEM.COAL, label: 'Уголь', kind: 'material', stackLimit: STACK_LIMIT },
    [ITEM.CHARCOAL]: { id: ITEM.CHARCOAL, label: 'Древесный уголь', kind: 'material', stackLimit: STACK_LIMIT },
    [ITEM.RAW_IRON]: { id: ITEM.RAW_IRON, label: 'Необработанное железо', kind: 'material', stackLimit: STACK_LIMIT },
    [ITEM.IRON_INGOT]: { id: ITEM.IRON_INGOT, label: 'Железный слиток', kind: 'material', stackLimit: STACK_LIMIT },
    [ITEM.SMALL_DIAMOND]: { id: ITEM.SMALL_DIAMOND, label: 'Мелкий алмаз', kind: 'material', stackLimit: STACK_LIMIT },
    [ITEM.BIG_DIAMOND]: { id: ITEM.BIG_DIAMOND, label: 'Большой алмаз', kind: 'material', stackLimit: STACK_LIMIT },
    [ITEM.RAW_GOLD]: { id: ITEM.RAW_GOLD, label: 'Рудное золото', kind: 'material', stackLimit: STACK_LIMIT },
    [ITEM.GOLD_INGOT]: { id: ITEM.GOLD_INGOT, label: 'Золотой слиток', kind: 'material', stackLimit: STACK_LIMIT },
    [ITEM.COIN]: { id: ITEM.COIN, label: 'Монета', kind: 'material', stackLimit: STACK_LIMIT },
    [ITEM.DEEP_CRYSTAL]: { id: ITEM.DEEP_CRYSTAL, label: 'Глубинный кристалл', kind: 'material', stackLimit: STACK_LIMIT },
    [ITEM.DEEP_DIAMOND]: { id: ITEM.DEEP_DIAMOND, label: 'Глубинный алмаз', kind: 'material', stackLimit: STACK_LIMIT },
    [ITEM.FIRE_CRYSTAL]: { id: ITEM.FIRE_CRYSTAL, label: 'Огненный кристалл', kind: 'material', stackLimit: STACK_LIMIT },
    [ITEM.FIRE_DUNGEON_KEY]: { id: ITEM.FIRE_DUNGEON_KEY, label: 'Ключ от огненной темницы', kind: 'material', stackLimit: 1 },
    [ITEM.FRIENDSHIP_INGOT]: { id: ITEM.FRIENDSHIP_INGOT, label: 'Дружный слиток', kind: 'material', stackLimit: STACK_LIMIT },
    [ITEM.WHEAT]: { id: ITEM.WHEAT, label: 'Пшеница', kind: 'material', stackLimit: STACK_LIMIT },
    [ITEM.CARROT]: { id: ITEM.CARROT, label: 'Морковь', kind: 'food', stackLimit: STACK_LIMIT, foodRestore: 12 },
    [ITEM.WOODEN_PICKAXE]: {
      id: ITEM.WOODEN_PICKAXE,
      label: 'Деревянная кирка',
      kind: 'tool',
      stackLimit: 1,
      toolType: 'pickaxe',
      tier: 'wood',
      attackDamage: 1,
      durability: 59,
    },
    [ITEM.WOODEN_AXE]: {
      id: ITEM.WOODEN_AXE,
      label: 'Деревянный топор',
      kind: 'tool',
      stackLimit: 1,
      toolType: 'axe',
      tier: 'wood',
      attackDamage: 1,
      durability: 59,
    },
    [ITEM.WOODEN_SHOVEL]: {
      id: ITEM.WOODEN_SHOVEL,
      label: 'Деревянная лопата',
      kind: 'tool',
      stackLimit: 1,
      toolType: 'shovel',
      tier: 'wood',
      attackDamage: 1,
      durability: 59,
    },
    [ITEM.WOODEN_SWORD]: {
      id: ITEM.WOODEN_SWORD,
      label: 'Деревянный меч',
      kind: 'tool',
      stackLimit: 1,
      toolType: 'sword',
      tier: 'wood',
      attackDamage: 2,
      durability: 59,
    },
    [ITEM.STONE_PICKAXE]: {
      id: ITEM.STONE_PICKAXE,
      label: 'Каменная кирка',
      kind: 'tool',
      stackLimit: 1,
      toolType: 'pickaxe',
      tier: 'stone',
      attackDamage: 1,
      durability: 131,
    },
    [ITEM.STONE_AXE]: {
      id: ITEM.STONE_AXE,
      label: 'Каменный топор',
      kind: 'tool',
      stackLimit: 1,
      toolType: 'axe',
      tier: 'stone',
      attackDamage: 1,
      durability: 131,
    },
    [ITEM.STONE_SHOVEL]: {
      id: ITEM.STONE_SHOVEL,
      label: 'Каменная лопата',
      kind: 'tool',
      stackLimit: 1,
      toolType: 'shovel',
      tier: 'stone',
      attackDamage: 1,
      durability: 131,
    },
    [ITEM.STONE_SWORD]: {
      id: ITEM.STONE_SWORD,
      label: 'Каменный меч',
      kind: 'tool',
      stackLimit: 1,
      toolType: 'sword',
      tier: 'stone',
      attackDamage: 3,
      durability: 131,
    },
    [ITEM.IRON_PICKAXE]: {
      id: ITEM.IRON_PICKAXE,
      label: 'Железная кирка',
      kind: 'tool',
      stackLimit: 1,
      toolType: 'pickaxe',
      tier: 'iron',
      attackDamage: 2,
      durability: 250,
    },
    [ITEM.IRON_AXE]: {
      id: ITEM.IRON_AXE,
      label: 'Железный топор',
      kind: 'tool',
      stackLimit: 1,
      toolType: 'axe',
      tier: 'iron',
      attackDamage: 2,
      durability: 250,
    },
    [ITEM.IRON_SHOVEL]: {
      id: ITEM.IRON_SHOVEL,
      label: 'Железная лопата',
      kind: 'tool',
      stackLimit: 1,
      toolType: 'shovel',
      tier: 'iron',
      attackDamage: 2,
      durability: 250,
    },
    [ITEM.IRON_SWORD]: {
      id: ITEM.IRON_SWORD,
      label: 'Железный меч',
      kind: 'tool',
      stackLimit: 1,
      toolType: 'sword',
      tier: 'iron',
      attackDamage: 5,
      durability: 250,
    },
    [ITEM.IRON_HELMET]: {
      id: ITEM.IRON_HELMET,
      label: 'Железный шлем',
      kind: 'armor',
      armorSlot: 'head',
      defense: 1,
      bonusHealth: 1,
      stackLimit: 1,
    },
    [ITEM.IRON_CHESTPLATE]: {
      id: ITEM.IRON_CHESTPLATE,
      label: 'Железный нагрудник',
      kind: 'armor',
      armorSlot: 'chest',
      defense: 3,
      bonusHealth: 3,
      stackLimit: 1,
    },
    [ITEM.IRON_LEGGINGS]: {
      id: ITEM.IRON_LEGGINGS,
      label: 'Железные поножи',
      kind: 'armor',
      armorSlot: 'legs',
      defense: 2,
      bonusHealth: 2,
      stackLimit: 1,
    },
    [ITEM.IRON_BOOTS]: {
      id: ITEM.IRON_BOOTS,
      label: 'Железные ботинки',
      kind: 'armor',
      armorSlot: 'feet',
      defense: 1,
      bonusHealth: 1,
      stackLimit: 1,
    },
    [ITEM.FRIENDSHIP_HELMET]: {
      id: ITEM.FRIENDSHIP_HELMET,
      label: 'Шлем дружбы',
      kind: 'armor',
      armorSlot: 'head',
      defense: 1,
      bonusHealth: 1,
      stackLimit: 1,
    },
    [ITEM.FRIENDSHIP_CHESTPLATE]: {
      id: ITEM.FRIENDSHIP_CHESTPLATE,
      label: 'Нагрудник дружбы',
      kind: 'armor',
      armorSlot: 'chest',
      defense: 3,
      bonusHealth: 3,
      stackLimit: 1,
    },
    [ITEM.FRIENDSHIP_LEGGINGS]: {
      id: ITEM.FRIENDSHIP_LEGGINGS,
      label: 'Поножи дружбы',
      kind: 'armor',
      armorSlot: 'legs',
      defense: 2,
      bonusHealth: 2,
      stackLimit: 1,
    },
    [ITEM.FRIENDSHIP_BOOTS]: {
      id: ITEM.FRIENDSHIP_BOOTS,
      label: 'Ботинки дружбы',
      kind: 'armor',
      armorSlot: 'feet',
      defense: 1,
      bonusHealth: 1,
      stackLimit: 1,
    },
    [ITEM.DIAMOND_PICKAXE]: {
      id: ITEM.DIAMOND_PICKAXE,
      label: 'Алмазная кирка',
      kind: 'tool',
      stackLimit: 1,
      toolType: 'pickaxe',
      tier: 'diamond',
      attackDamage: 3,
      durability: 1561,
    },
    [ITEM.DIAMOND_AXE]: {
      id: ITEM.DIAMOND_AXE,
      label: 'Алмазный топор',
      kind: 'tool',
      stackLimit: 1,
      toolType: 'axe',
      tier: 'diamond',
      attackDamage: 3,
      durability: 1561,
    },
    [ITEM.DIAMOND_SHOVEL]: {
      id: ITEM.DIAMOND_SHOVEL,
      label: 'Алмазная лопата',
      kind: 'tool',
      stackLimit: 1,
      toolType: 'shovel',
      tier: 'diamond',
      attackDamage: 3,
      durability: 1561,
    },
    [ITEM.DIAMOND_SWORD]: {
      id: ITEM.DIAMOND_SWORD,
      label: 'Алмазный меч',
      kind: 'tool',
      stackLimit: 1,
      toolType: 'sword',
      tier: 'diamond',
      attackDamage: 7,
      durability: 1561,
    },
    [ITEM.FRIENDSHIP_PICKAXE]: {
      id: ITEM.FRIENDSHIP_PICKAXE,
      label: 'Кирка дружбы',
      kind: 'tool',
      stackLimit: 1,
      toolType: 'pickaxe',
      tier: 'friendship',
      attackDamage: 4,
      durability: 2200,
    },
    [ITEM.FRIENDSHIP_AXE]: {
      id: ITEM.FRIENDSHIP_AXE,
      label: 'Топор дружбы',
      kind: 'tool',
      stackLimit: 1,
      toolType: 'axe',
      tier: 'friendship',
      attackDamage: 5,
      durability: 2200,
    },
    [ITEM.FRIENDSHIP_SHOVEL]: {
      id: ITEM.FRIENDSHIP_SHOVEL,
      label: 'Лопата дружбы',
      kind: 'tool',
      stackLimit: 1,
      toolType: 'shovel',
      tier: 'friendship',
      attackDamage: 4,
      durability: 2200,
    },
    [ITEM.FRIENDSHIP_SWORD]: {
      id: ITEM.FRIENDSHIP_SWORD,
      label: 'Меч дружбы',
      kind: 'tool',
      stackLimit: 1,
      toolType: 'sword',
      tier: 'friendship',
      attackDamage: 9,
      durability: 2200,
    },
  };

  function isBlockItem(itemId) {
    return typeof itemId === 'number';
  }

  function getItemDefinition(itemId) {
    if (isBlockItem(itemId)) {
      return {
        id: itemId,
        label: BLOCK_LABELS[itemId] || 'Блок',
        kind: 'block',
        stackLimit: STACK_LIMIT,
        placeable: PLACEABLE.has(itemId),
        blockId: itemId,
      };
    }
    return ITEM_DEFS[itemId] || null;
  }

  function isPlaceableItem(itemId) {
    const def = getItemDefinition(itemId);
    return !!(def && def.kind === 'block' && def.placeable);
  }

  function isTool(itemId) {
    const def = getItemDefinition(itemId);
    return !!(def && def.kind === 'tool');
  }

  function isArmor(itemId) {
    const def = getItemDefinition(itemId);
    return !!(def && def.kind === 'armor');
  }

  function getArmorSlot(itemId) {
    const def = getItemDefinition(itemId);
    return def && def.kind === 'armor' ? def.armorSlot || null : null;
  }

  function getArmorDefense(itemId) {
    const def = getItemDefinition(itemId);
    return def && def.kind === 'armor' ? def.defense || 0 : 0;
  }

  function getArmorBonusHealth(itemId) {
    const def = getItemDefinition(itemId);
    return def && def.kind === 'armor' ? def.bonusHealth || 0 : 0;
  }

  function getPlacedBlockId(itemId) {
    const def = getItemDefinition(itemId);
    return def && def.kind === 'block' ? def.blockId : null;
  }

  function getMaxDurability(itemId) {
    const def = getItemDefinition(itemId);
    return def && def.kind === 'tool' ? def.durability || 0 : 0;
  }

  function getFoodRestore(itemId) {
    const def = getItemDefinition(itemId);
    return def && def.kind === 'food' ? def.foodRestore || 0 : 0;
  }

  Game.items = {
    ITEM,
    getItemDefinition,
    getMaxDurability,
    getFoodRestore,
    isBlockItem,
    isPlaceableItem,
    isTool,
    isArmor,
    getArmorSlot,
    getArmorDefense,
    getArmorBonusHealth,
    getPlacedBlockId,
  };
})();
