(() => {
  const Game = window.MC2D;
  const { TILE, WORLD_W, WORLD_H } = Game.constants;
  const { BLOCK: B } = Game.blocks;
  const CHUNK_TILES = 16;
  const MAX_CHUNKS = 32; // At most 8 MiB of picture pixels, regardless of world size.
  const tiles = new Map();
  const chunks = new Map();
  let activeBackdrop = null;

  function materialAt(backdrop, x, y) {
    if (!backdrop || x < 0 || y < 0 || x >= WORLD_W || y >= WORLD_H) return B.AIR;
    const c = backdrop.columns[x];
    if (!c) return B.AIR;
    if (y >= c[0] && y < c[1]) return y === c[0] ? c[4] : y < c[0] + 5 ? c[5] : c[6];
    if (y < c[2]) return B.AIR;
    if (y < c[1]) return c[5];
    for (const r of backdrop.regions) {
      if (x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1) return B.STONE;
    }
    return y >= c[3] ? B.DEEPSTONE : c[7];
  }

  function tileImage(id) {
    if (!tiles.has(id)) {
      const image = document.createElement('canvas');
      image.width = image.height = TILE;
      const ctx = image.getContext('2d');
      Game.worldRenderer.drawBlock(ctx, id, 0, 0, 0);
      ctx.globalCompositeOperation = 'source-atop';
      const shade = id === B.BLACKSTONE || id === B.BASALT ? 0.34 : 0.24;
      ctx.fillStyle = `rgba(0,0,0,${shade})`;
      ctx.fillRect(0, 0, TILE, TILE);
      tiles.set(id, image);
    }
    return tiles.get(id);
  }

  function chunkImage(backdrop, cx, cy) {
    const key = `${cx},${cy}`;
    if (chunks.has(key)) {
      const image = chunks.get(key);
      chunks.delete(key);
      chunks.set(key, image);
      return image;
    }
    const image = document.createElement('canvas');
    image.width = image.height = CHUNK_TILES * TILE;
    const ctx = image.getContext('2d');
    for (let dy = 0; dy < CHUNK_TILES; dy++) for (let dx = 0; dx < CHUNK_TILES; dx++) {
      const id = materialAt(backdrop, cx * CHUNK_TILES + dx, cy * CHUNK_TILES + dy);
      if (id !== B.AIR) ctx.drawImage(tileImage(id), dx * TILE, dy * TILE);
    }
    if (chunks.size >= MAX_CHUNKS) chunks.delete(chunks.keys().next().value);
    chunks.set(key, image);
    return image;
  }

  function draw(ctx, backdrop, camera, x0, y0, x1, y1) {
    if (!backdrop) return;
    if (activeBackdrop !== backdrop) {
      chunks.clear();
      activeBackdrop = backdrop;
    }
    const firstX = Math.max(0, Math.floor(x0 / CHUNK_TILES));
    const firstY = Math.max(0, Math.floor(y0 / CHUNK_TILES));
    const lastX = Math.floor(Math.min(WORLD_W - 1, x1) / CHUNK_TILES);
    const lastY = Math.floor(Math.min(WORLD_H - 1, y1) / CHUNK_TILES);
    for (let cy = firstY; cy <= lastY; cy++) for (let cx = firstX; cx <= lastX; cx++) {
      ctx.drawImage(chunkImage(backdrop, cx, cy), cx * CHUNK_TILES * TILE - camera.x, cy * CHUNK_TILES * TILE - camera.y);
    }
  }

  Game.backgroundRenderer = { draw, materialAt };
})();
