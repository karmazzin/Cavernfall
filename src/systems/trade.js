(() => {
  const Game = window.MC2D;
  const { ITEM } = Game.items;
  const { addToInventory, countItem, removeItem } = Game.inventory;
  const { getNearestTrader } = Game.dwarvesEntity;

  const TRADE_OFFERS = [
    { id: 'torches', label: '4 факела', costId: ITEM.COIN, cost: 1, rewardId: 12, rewardCount: 4 },
    { id: 'coal', label: '2 угля', costId: ITEM.COIN, cost: 2, rewardId: ITEM.COAL, rewardCount: 2 },
    { id: 'ladder', label: '6 лестниц', costId: ITEM.COIN, cost: 2, rewardId: 17, rewardCount: 6 },
    { id: 'crystal', label: '1 глубинный кристалл', costId: ITEM.COIN, cost: 6, rewardId: ITEM.DEEP_CRYSTAL, rewardCount: 1 },
  ];

  function getAvailableTrader(state) {
    return getNearestTrader(state, 86);
  }

  function canAfford(state, offer) {
    return countItem(state, offer.costId) >= offer.cost;
  }

  function performTrade(state, offerId) {
    const offer = TRADE_OFFERS.find((entry) => entry.id === offerId);
    if (!offer) return false;
    if (!canAfford(state, offer)) return false;
    if (!removeItem(state, offer.costId, offer.cost)) return false;
    addToInventory(state, offer.rewardId, offer.rewardCount);
    return true;
  }

  Game.tradeSystem = { TRADE_OFFERS, getAvailableTrader, performTrade, canAfford };
})();
