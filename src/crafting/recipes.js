(() => {
  const Game = window.MC2D;
  const { BLOCK } = Game.blocks;
  const { ITEM } = Game.items;

  const RECIPES = [
    {
      name: 'Доски',
      pattern: [[BLOCK.WOOD]],
      result: { id: BLOCK.PLANK, count: 4 },
    },
    {
      name: 'Доски',
      pattern: [[BLOCK.SPRUCE_WOOD]],
      result: { id: BLOCK.PLANK, count: 4 },
    },
    {
      name: 'Палки',
      pattern: [
        [BLOCK.PLANK],
        [BLOCK.PLANK],
      ],
      result: { id: ITEM.STICK, count: 4 },
    },
    {
      name: 'Факел',
      pattern: [
        [null, ITEM.COAL, null],
        [null, ITEM.STICK, null],
      ],
      result: { id: BLOCK.TORCH, count: 4 },
    },
    {
      name: 'Факел',
      pattern: [
        [null, ITEM.CHARCOAL, null],
        [null, ITEM.STICK, null],
      ],
      result: { id: BLOCK.TORCH, count: 4 },
    },
    {
      name: 'Печка',
      pattern: [
        [BLOCK.STONE, BLOCK.STONE, BLOCK.STONE],
        [BLOCK.STONE, ITEM.COAL, BLOCK.STONE],
        [BLOCK.STONE, BLOCK.STONE, BLOCK.STONE],
      ],
      result: { id: BLOCK.FURNACE, count: 1 },
    },
    {
      name: 'Монеты',
      pattern: [[ITEM.GOLD_INGOT]],
      result: { id: ITEM.COIN, count: 4 },
    },
    {
      name: 'Подушка',
      pattern: [
        [BLOCK.LEAF, BLOCK.LEAF, BLOCK.LEAF],
        [BLOCK.PLANK, BLOCK.PLANK, BLOCK.PLANK],
      ],
      result: { id: BLOCK.PILLOW, count: 1 },
    },
    {
      name: 'Деревянная кирка',
      pattern: [
        [BLOCK.PLANK, BLOCK.PLANK, BLOCK.PLANK],
        [null, ITEM.STICK, null],
        [null, ITEM.STICK, null],
      ],
      result: { id: ITEM.WOODEN_PICKAXE, count: 1 },
    },
    {
      name: 'Деревянный топор',
      pattern: [
        [BLOCK.PLANK, BLOCK.PLANK, null],
        [BLOCK.PLANK, ITEM.STICK, null],
        [null, ITEM.STICK, null],
      ],
      result: { id: ITEM.WOODEN_AXE, count: 1 },
    },
    {
      name: 'Деревянная лопата',
      pattern: [
        [null, BLOCK.PLANK, null],
        [null, ITEM.STICK, null],
        [null, ITEM.STICK, null],
      ],
      result: { id: ITEM.WOODEN_SHOVEL, count: 1 },
    },
    {
      name: 'Деревянный меч',
      pattern: [
        [null, BLOCK.PLANK, null],
        [null, BLOCK.PLANK, null],
        [null, ITEM.STICK, null],
      ],
      result: { id: ITEM.WOODEN_SWORD, count: 1 },
    },
    {
      name: 'Каменная кирка',
      pattern: [
        [BLOCK.STONE, BLOCK.STONE, BLOCK.STONE],
        [null, ITEM.STICK, null],
        [null, ITEM.STICK, null],
      ],
      result: { id: ITEM.STONE_PICKAXE, count: 1 },
    },
    {
      name: 'Каменный топор',
      pattern: [
        [BLOCK.STONE, BLOCK.STONE, null],
        [BLOCK.STONE, ITEM.STICK, null],
        [null, ITEM.STICK, null],
      ],
      result: { id: ITEM.STONE_AXE, count: 1 },
    },
    {
      name: 'Каменная лопата',
      pattern: [
        [null, BLOCK.STONE, null],
        [null, ITEM.STICK, null],
        [null, ITEM.STICK, null],
      ],
      result: { id: ITEM.STONE_SHOVEL, count: 1 },
    },
    {
      name: 'Каменный меч',
      pattern: [
        [null, BLOCK.STONE, null],
        [null, BLOCK.STONE, null],
        [null, ITEM.STICK, null],
      ],
      result: { id: ITEM.STONE_SWORD, count: 1 },
    },
    {
      name: 'Железная кирка',
      pattern: [
        [ITEM.IRON_INGOT, ITEM.IRON_INGOT, ITEM.IRON_INGOT],
        [null, ITEM.STICK, null],
        [null, ITEM.STICK, null],
      ],
      result: { id: ITEM.IRON_PICKAXE, count: 1 },
    },
    {
      name: 'Железный топор',
      pattern: [
        [ITEM.IRON_INGOT, ITEM.IRON_INGOT, null],
        [ITEM.IRON_INGOT, ITEM.STICK, null],
        [null, ITEM.STICK, null],
      ],
      result: { id: ITEM.IRON_AXE, count: 1 },
    },
    {
      name: 'Железная лопата',
      pattern: [
        [null, ITEM.IRON_INGOT, null],
        [null, ITEM.STICK, null],
        [null, ITEM.STICK, null],
      ],
      result: { id: ITEM.IRON_SHOVEL, count: 1 },
    },
    {
      name: 'Железный меч',
      pattern: [
        [null, ITEM.IRON_INGOT, null],
        [null, ITEM.IRON_INGOT, null],
        [null, ITEM.STICK, null],
      ],
      result: { id: ITEM.IRON_SWORD, count: 1 },
    },
    {
      name: 'Железный шлем',
      pattern: [
        [ITEM.IRON_INGOT, ITEM.IRON_INGOT, ITEM.IRON_INGOT],
        [ITEM.IRON_INGOT, null, ITEM.IRON_INGOT],
      ],
      result: { id: ITEM.IRON_HELMET, count: 1 },
    },
    {
      name: 'Железный нагрудник',
      pattern: [
        [ITEM.IRON_INGOT, null, ITEM.IRON_INGOT],
        [ITEM.IRON_INGOT, ITEM.IRON_INGOT, ITEM.IRON_INGOT],
        [ITEM.IRON_INGOT, ITEM.IRON_INGOT, ITEM.IRON_INGOT],
      ],
      result: { id: ITEM.IRON_CHESTPLATE, count: 1 },
    },
    {
      name: 'Железные поножи',
      pattern: [
        [ITEM.IRON_INGOT, ITEM.IRON_INGOT, ITEM.IRON_INGOT],
        [ITEM.IRON_INGOT, null, ITEM.IRON_INGOT],
        [ITEM.IRON_INGOT, null, ITEM.IRON_INGOT],
      ],
      result: { id: ITEM.IRON_LEGGINGS, count: 1 },
    },
    {
      name: 'Железные ботинки',
      pattern: [
        [ITEM.IRON_INGOT, null, ITEM.IRON_INGOT],
        [ITEM.IRON_INGOT, null, ITEM.IRON_INGOT],
      ],
      result: { id: ITEM.IRON_BOOTS, count: 1 },
    },
    {
      name: 'Шлем дружбы',
      pattern: [
        [ITEM.FRIENDSHIP_INGOT, ITEM.FRIENDSHIP_INGOT, ITEM.FRIENDSHIP_INGOT],
        [ITEM.FRIENDSHIP_INGOT, null, ITEM.FRIENDSHIP_INGOT],
      ],
      result: { id: ITEM.FRIENDSHIP_HELMET, count: 1 },
    },
    {
      name: 'Нагрудник дружбы',
      pattern: [
        [ITEM.FRIENDSHIP_INGOT, null, ITEM.FRIENDSHIP_INGOT],
        [ITEM.FRIENDSHIP_INGOT, ITEM.FRIENDSHIP_INGOT, ITEM.FRIENDSHIP_INGOT],
        [ITEM.FRIENDSHIP_INGOT, ITEM.FRIENDSHIP_INGOT, ITEM.FRIENDSHIP_INGOT],
      ],
      result: { id: ITEM.FRIENDSHIP_CHESTPLATE, count: 1 },
    },
    {
      name: 'Поножи дружбы',
      pattern: [
        [ITEM.FRIENDSHIP_INGOT, ITEM.FRIENDSHIP_INGOT, ITEM.FRIENDSHIP_INGOT],
        [ITEM.FRIENDSHIP_INGOT, null, ITEM.FRIENDSHIP_INGOT],
        [ITEM.FRIENDSHIP_INGOT, null, ITEM.FRIENDSHIP_INGOT],
      ],
      result: { id: ITEM.FRIENDSHIP_LEGGINGS, count: 1 },
    },
    {
      name: 'Ботинки дружбы',
      pattern: [
        [ITEM.FRIENDSHIP_INGOT, null, ITEM.FRIENDSHIP_INGOT],
        [ITEM.FRIENDSHIP_INGOT, null, ITEM.FRIENDSHIP_INGOT],
      ],
      result: { id: ITEM.FRIENDSHIP_BOOTS, count: 1 },
    },
    {
      name: 'Большой алмаз',
      pattern: [
        [ITEM.SMALL_DIAMOND, ITEM.SMALL_DIAMOND, ITEM.SMALL_DIAMOND],
        [ITEM.SMALL_DIAMOND, ITEM.SMALL_DIAMOND, ITEM.SMALL_DIAMOND],
        [ITEM.SMALL_DIAMOND, ITEM.SMALL_DIAMOND, ITEM.SMALL_DIAMOND],
      ],
      result: { id: ITEM.BIG_DIAMOND, count: 1 },
    },
    {
      name: 'Алмазная кирка',
      pattern: [
        [ITEM.BIG_DIAMOND, ITEM.BIG_DIAMOND, ITEM.BIG_DIAMOND],
        [null, ITEM.STICK, null],
        [null, ITEM.STICK, null],
      ],
      result: { id: ITEM.DIAMOND_PICKAXE, count: 1 },
    },
    {
      name: 'Алмазный топор',
      pattern: [
        [ITEM.BIG_DIAMOND, ITEM.BIG_DIAMOND, null],
        [ITEM.BIG_DIAMOND, ITEM.STICK, null],
        [null, ITEM.STICK, null],
      ],
      result: { id: ITEM.DIAMOND_AXE, count: 1 },
    },
    {
      name: 'Алмазная лопата',
      pattern: [
        [null, ITEM.BIG_DIAMOND, null],
        [null, ITEM.STICK, null],
        [null, ITEM.STICK, null],
      ],
      result: { id: ITEM.DIAMOND_SHOVEL, count: 1 },
    },
    {
      name: 'Алмазный меч',
      pattern: [
        [null, ITEM.BIG_DIAMOND, null],
        [null, ITEM.BIG_DIAMOND, null],
        [null, ITEM.STICK, null],
      ],
      result: { id: ITEM.DIAMOND_SWORD, count: 1 },
    },
    {
      name: 'Глубинный алмаз',
      pattern: [
        [null, ITEM.BIG_DIAMOND, null],
        [null, ITEM.DEEP_CRYSTAL, null],
      ],
      result: { id: ITEM.DEEP_DIAMOND, count: 1 },
    },
    {
      name: 'Кирка дружбы',
      pattern: [
        [ITEM.FRIENDSHIP_INGOT, ITEM.FRIENDSHIP_INGOT, ITEM.FRIENDSHIP_INGOT],
        [null, ITEM.STICK, null],
        [null, ITEM.STICK, null],
      ],
      result: { id: ITEM.FRIENDSHIP_PICKAXE, count: 1 },
    },
    {
      name: 'Топор дружбы',
      pattern: [
        [ITEM.FRIENDSHIP_INGOT, ITEM.FRIENDSHIP_INGOT, null],
        [ITEM.FRIENDSHIP_INGOT, ITEM.STICK, null],
        [null, ITEM.STICK, null],
      ],
      result: { id: ITEM.FRIENDSHIP_AXE, count: 1 },
    },
    {
      name: 'Лопата дружбы',
      pattern: [
        [null, ITEM.FRIENDSHIP_INGOT, null],
        [null, ITEM.STICK, null],
        [null, ITEM.STICK, null],
      ],
      result: { id: ITEM.FRIENDSHIP_SHOVEL, count: 1 },
    },
    {
      name: 'Меч дружбы',
      pattern: [
        [null, ITEM.FRIENDSHIP_INGOT, null],
        [null, ITEM.FRIENDSHIP_INGOT, null],
        [null, ITEM.STICK, null],
      ],
      result: { id: ITEM.FRIENDSHIP_SWORD, count: 1 },
    },
  ];

  function trimPattern(pattern) {
    const rows = pattern
      .map((row) => row.slice())
      .filter((row) => row.some((cell) => cell !== null && cell !== undefined));

    if (rows.length === 0) return [];

    let minX = rows[0].length;
    let maxX = -1;
    for (const row of rows) {
      for (let x = 0; x < row.length; x += 1) {
        if (row[x] !== null && row[x] !== undefined) {
          minX = Math.min(minX, x);
          maxX = Math.max(maxX, x);
        }
      }
    }

    return rows.map((row) => row.slice(minX, maxX + 1));
  }

  function gridToPattern(gridSlots) {
    const rows = [];
    for (let y = 0; y < 3; y += 1) {
      const row = [];
      for (let x = 0; x < 3; x += 1) {
        const slot = gridSlots[y * 3 + x];
        row.push(slot && slot.count > 0 ? slot.id : null);
      }
      rows.push(row);
    }
    return trimPattern(rows);
  }

  function patternsEqual(a, b) {
    if (a.length !== b.length) return false;
    for (let y = 0; y < a.length; y += 1) {
      if (a[y].length !== b[y].length) return false;
      for (let x = 0; x < a[y].length; x += 1) {
        if (a[y][x] !== b[y][x]) return false;
      }
    }
    return true;
  }

  function findMatchingRecipe(gridSlots) {
    const pattern = gridToPattern(gridSlots);
    if (pattern.length === 0) return null;

    for (const recipe of RECIPES) {
      if (patternsEqual(pattern, trimPattern(recipe.pattern))) {
        return { recipe, result: recipe.result };
      }
    }
    return null;
  }

  Game.craftingRecipes = { RECIPES, findMatchingRecipe };
})();
