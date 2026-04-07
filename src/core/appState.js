(() => {
  const Game = window.MC2D;

  function createAppState() {
    return {
      screen: 'menu',
      currentWorldId: null,
      worlds: [],
      pendingInitialSave: false,
      newWorld: {
        name: '',
        seed: '',
        mode: 'survival',
        worldType: 'normal',
        singleBiome: 'forest',
        cavernBiome: 'mix',
      },
    };
  }

  Game.appState = { createAppState };
})();
