(() => {
  const Game = window.MC2D;
  const { ITEM } = Game.items;
  const { BLOCK } = Game.blocks;
  const { addToInventory, countItem, removeItem } = Game.inventory;
  const { getNearestTrader } = Game.dwarvesEntity;
  const { getNearestHumanTrader } = Game.humansEntity;

  const DWARF_TRADE_OFFERS = [
    { id: 'd_torches', label: '4 факела', costId: ITEM.COIN, cost: 1, rewardId: BLOCK.TORCH, rewardCount: 4 },
    { id: 'd_coal', label: '2 угля', costId: ITEM.COIN, cost: 2, rewardId: ITEM.COAL, rewardCount: 2 },
    { id: 'd_ladder', label: '6 лестниц', costId: ITEM.COIN, cost: 2, rewardId: BLOCK.LADDER, rewardCount: 6 },
    { id: 'd_crystal', label: '1 глубинный кристалл', costId: ITEM.COIN, cost: 6, rewardId: ITEM.DEEP_CRYSTAL, rewardCount: 1 },
  ];

  const HUMAN_OFFERS = {
    farmer: [
      { id: 'h_wheat', label: '6 пшеницы', costId: ITEM.COIN, cost: 1, rewardId: ITEM.WHEAT, rewardCount: 6 },
      { id: 'h_carrot', label: '4 моркови', costId: ITEM.COIN, cost: 1, rewardId: ITEM.CARROT, rewardCount: 4 },
      { id: 'h_torch', label: '2 факела', costId: ITEM.COIN, cost: 1, rewardId: BLOCK.TORCH, rewardCount: 2 },
    ],
    shepherd: [
      { id: 'h_sheep_food', label: '3 сырой баранины', costId: ITEM.COIN, cost: 2, rewardId: ITEM.RAW_MUTTON, rewardCount: 3 },
      { id: 'h_carrot_feed', label: '5 моркови', costId: ITEM.COIN, cost: 1, rewardId: ITEM.CARROT, rewardCount: 5 },
      { id: 'h_torch_shepherd', label: '2 факела', costId: ITEM.COIN, cost: 1, rewardId: BLOCK.TORCH, rewardCount: 2 },
    ],
    mason: [
      { id: 'h_stone', label: '10 камня', costId: ITEM.COIN, cost: 2, rewardId: BLOCK.STONE, rewardCount: 10 },
      { id: 'h_deepstone', label: '8 глубинного камня', costId: ITEM.COIN, cost: 3, rewardId: BLOCK.DEEPSTONE, rewardCount: 8 },
      { id: 'h_pillar', label: '4 столба', costId: ITEM.COIN, cost: 2, rewardId: BLOCK.PILLAR, rewardCount: 4 },
    ],
    lumber: [
      { id: 'h_wood', label: '8 дерева', costId: ITEM.COIN, cost: 2, rewardId: BLOCK.WOOD, rewardCount: 8 },
      { id: 'h_plank', label: '10 досок', costId: ITEM.COIN, cost: 2, rewardId: BLOCK.PLANK, rewardCount: 10 },
      { id: 'h_stick', label: '10 палок', costId: ITEM.COIN, cost: 1, rewardId: ITEM.STICK, rewardCount: 10 },
    ],
    miner: [
      { id: 'h_coal_2', label: '3 угля', costId: ITEM.COIN, cost: 2, rewardId: ITEM.COAL, rewardCount: 3 },
      { id: 'h_gold', label: '1 рудное золото', costId: ITEM.COIN, cost: 3, rewardId: ITEM.RAW_GOLD, rewardCount: 1 },
      { id: 'h_crystal_2', label: '1 глубинный кристалл', costId: ITEM.COIN, cost: 5, rewardId: ITEM.DEEP_CRYSTAL, rewardCount: 1 },
    ],
    merchant: [
      { id: 'h_ladder_2', label: '8 лестниц', costId: ITEM.COIN, cost: 2, rewardId: BLOCK.LADDER, rewardCount: 8 },
      { id: 'h_door', label: '2 двери', costId: ITEM.COIN, cost: 2, rewardId: BLOCK.DOOR, rewardCount: 2 },
      { id: 'h_ingot', label: '1 золотой слиток', costId: ITEM.COIN, cost: 4, rewardId: ITEM.GOLD_INGOT, rewardCount: 1 },
    ],
  };

  const HUMAN_PROFESSION_LABELS = {
    farmer: 'Фермер',
    shepherd: 'Пастух',
    mason: 'Каменщик',
    lumber: 'Плотник',
    miner: 'Шахтер',
    merchant: 'Торговец',
    guard: 'Страж',
  };

  function getAvailableTrader(state) {
    return getNearestTrader(state, 86) || getNearestHumanTrader(state, 86);
  }

  function getTraderOffers(trader) {
    if (!trader) return [];
    if (trader.kind === 'human') return HUMAN_OFFERS[trader.human.profession] || [];
    return DWARF_TRADE_OFFERS;
  }

  function getTraderTitle(trader) {
    if (!trader) return '';
    if (trader.kind === 'human') return `Житель: ${HUMAN_PROFESSION_LABELS[trader.human.profession] || 'Житель'}`;
    return 'Спокойный гном рядом';
  }

  function canAfford(state, offer) {
    return countItem(state, offer.costId) >= offer.cost;
  }

  function performTrade(state, trader, offerId) {
    const offer = getTraderOffers(trader).find((entry) => entry.id === offerId);
    if (!offer) return false;
    if (!canAfford(state, offer)) return false;
    if (!removeItem(state, offer.costId, offer.cost)) return false;
    addToInventory(state, offer.rewardId, offer.rewardCount);
    return true;
  }

  Game.tradeSystem = {
    DWARF_TRADE_OFFERS,
    HUMAN_OFFERS,
    HUMAN_PROFESSION_LABELS,
    getAvailableTrader,
    getTraderOffers,
    getTraderTitle,
    performTrade,
    canAfford,
  };
})();
