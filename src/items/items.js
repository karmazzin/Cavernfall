(() => {
  const Game = window.MC2D;
  const { STACK_LIMIT } = Game.constants;
  const { BLOCK, PLACEABLE } = Game.blocks;

  const ITEM = {
    STICK: 'stick',
    RAW_MUTTON: 'raw_mutton',
    COAL: 'coal',
    CHARCOAL: 'charcoal',
    WOODEN_PICKAXE: 'wooden_pickaxe',
    WOODEN_AXE: 'wooden_axe',
    WOODEN_SHOVEL: 'wooden_shovel',
    WOODEN_SWORD: 'wooden_sword',
    STONE_PICKAXE: 'stone_pickaxe',
    STONE_AXE: 'stone_axe',
    STONE_SHOVEL: 'stone_shovel',
    STONE_SWORD: 'stone_sword',
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
  };

  const ITEM_DEFS = {
    [ITEM.STICK]: { id: ITEM.STICK, label: 'Палка', kind: 'material', stackLimit: STACK_LIMIT },
    [ITEM.RAW_MUTTON]: { id: ITEM.RAW_MUTTON, label: 'Сырая баранина', kind: 'food', stackLimit: STACK_LIMIT, foodRestore: 20 },
    [ITEM.COAL]: { id: ITEM.COAL, label: 'Уголь', kind: 'material', stackLimit: STACK_LIMIT },
    [ITEM.CHARCOAL]: { id: ITEM.CHARCOAL, label: 'Древесный уголь', kind: 'material', stackLimit: STACK_LIMIT },
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
    getPlacedBlockId,
  };
})();
