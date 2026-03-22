(() => {
  const Game = window.MC2D;

  function rand(a, b) {
    const random = Game.random && typeof Game.random.random === 'function' ? Game.random.random() : Math.random();
    return random * (b - a) + a;
  }

  function randi(a, b) {
    return Math.floor(rand(a, b + 1));
  }

  function clamp(v, a, b) {
    return Math.max(a, Math.min(b, v));
  }

  function aabb(ax, ay, aw, ah, bx, by, bw, bh) {
    return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
  }

  Game.math = { rand, randi, clamp, aabb };
})();
