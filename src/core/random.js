(() => {
  const Game = window.MC2D;

  let activeRandom = Math.random;

  function hashSeed(seed) {
    const source = String(seed ?? '');
    let h = 2166136261 >>> 0;
    for (let i = 0; i < source.length; i += 1) {
      h ^= source.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function createSeededRandom(seed) {
    let state = hashSeed(seed) || 0x6d2b79f5;
    return function seeded() {
      state += 0x6d2b79f5;
      let t = state;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function random() {
    return activeRandom();
  }

  function withSeed(seed, fn) {
    const prevRandom = activeRandom;
    const prevMathRandom = Math.random;
    activeRandom = createSeededRandom(seed);
    Math.random = activeRandom;
    try {
      return fn();
    } finally {
      activeRandom = prevRandom;
      Math.random = prevMathRandom;
    }
  }

  function makeSeed() {
    return `${Date.now().toString(36)}-${Math.floor(Math.random() * 1e9).toString(36)}`;
  }

  Game.random = { random, withSeed, makeSeed, createSeededRandom };
})();
