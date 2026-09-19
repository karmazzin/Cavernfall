const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
function loadGame() {
  const context = vm.createContext({ window: {}, document: { getElementById: () => null }, console });
  const scripts = [...fs.readFileSync(path.join(root, 'index.html'), 'utf8').matchAll(/src="\.\/(src\/[^" ]+\.js)"/g)];
  for (const [, file] of scripts) {
    if (file === 'src/app/menuUi.js') break;
    vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context, { filename: file });
  }
  return context.window.MC2D;
}
function click(Game, state, canvas, rect) {
  assert.ok(rect, 'button must exist');
  Game.crafting.handleCraftingPointer(state, { mouse: { x: rect.x + rect.w / 2, y: rect.y + rect.h / 2, button: 0, justPressed: true } }, canvas);
}
test('survival ladder can be selected, placed in empty space and consumed', () => {
  const G = loadGame();
  const s = G.state.createGameState();
  const ladder = G.blocks.BLOCK.LADDER;
  s.player.hotbar[0] = G.inventory.createItemStack(ladder, 2);
  s.player.selectedSlot = 0;
  assert.equal(G.inventory.selectedPlaceableId(s), ladder);
  assert.equal(G.interaction.canPlaceBlock(s, 10, 10, ladder), true);
  const used = G.inventory.consumeSelectedPlaceable(s);
  G.world.setBlock(s, 10, 10, used);
  assert.equal(G.world.getBlock(s, 10, 10), ladder);
  assert.equal(s.player.hotbar[0].count, 1);
  assert.equal(G.interaction.canPlaceBlock(s, 10, 10, ladder), false);
});
for (const canvas of [{ width: 1280, height: 800 }, { width: 390, height: 640 }]) {
  test(`recipe book pages are reachable and browsing preserves items at ${canvas.width}px`, () => {
    const G = loadGame();
    const s = G.state.createGameState();
    G.crafting.openCrafting(s);
    s.crafting.grid[0] = G.inventory.createItemStack(G.blocks.BLOCK.WOOD, 3);
    s.crafting.cursor = G.inventory.createItemStack(G.items.ITEM.STICK, 4);
    const before = JSON.stringify([s.crafting.grid, s.crafting.cursor, s.player.inventory]);
    const layout = G.crafting.getCraftingLayout(canvas, s);
    click(G, s, canvas, layout.tabs.recipes);
    assert.equal(s.crafting.tab, 'recipes');
    const entries = G.crafting.getRecipeBookEntries();
    assert.ok(entries.length >= G.craftingRecipes.RECIPES.length);
    const pages = G.crafting.getRecipePagination(layout, entries.length);
    assert.ok(pages.pageCount > 1);
    for (let i = 1; i < pages.pageCount; i++) {
      click(G, s, canvas, layout.recipeBookNav.next);
      assert.equal(s.crafting.recipesPage, i);
    }
    click(G, s, canvas, layout.recipeBookNav.next);
    assert.equal(s.crafting.recipesPage, pages.pageCount - 1);
    for (let i = pages.pageCount - 2; i >= 0; i--) click(G, s, canvas, layout.recipeBookNav.prev);
    click(G, s, canvas, layout.recipeBookNav.prev);
    assert.equal(s.crafting.recipesPage, 0);
    click(G, s, canvas, layout.tabs.craft);
    assert.equal(s.crafting.tab, 'craft');
    assert.equal(JSON.stringify([s.crafting.grid, s.crafting.cursor, s.player.inventory]), before);
  });
}

test('every craft and furnace recipe renders on reachable pages without overflowing the panel', () => {
  const G = loadGame();
  for (const canvas of [{ width: 1280, height: 800 }, { width: 390, height: 640 }]) {
    const s = G.state.createGameState();
    G.crafting.openCrafting(s);
    s.crafting.tab = 'recipes';
    const layout = G.crafting.getCraftingLayout(canvas, s);
    const entries = G.crafting.getRecipeBookEntries();
    const pagination = G.crafting.getRecipePagination(layout, entries.length);
    const seen = [];
    const context = new Proxy({}, {
      get(target, key) {
        if (key in target) return target[key];
        if (key === 'fillText') return text => seen.push(String(text));
        if (key === 'measureText') return text => ({ width: String(text).length * 7 });
        if (key === 'createLinearGradient' || key === 'createRadialGradient') return () => ({ addColorStop() {} });
        if (key === 'fillRect' || key === 'strokeRect') return (x, y, w, h) => {
          assert.ok([x, y, w, h].every(Number.isFinite), 'drawing dimensions are finite');
        };
        return () => {};
      },
    });
    for (let page = 0; page < pagination.pageCount; page++) {
      s.crafting.recipesPage = page;
      const start = seen.length;
      G.craftingRenderer.drawCraftingOverlay(context, canvas, s, { mouse: { x: 0, y: 0 } });
      const drawn = seen.slice(start);
      for (const recipe of entries.slice(page * pagination.pageSize, (page + 1) * pagination.pageSize)) {
        assert.ok(drawn.includes(recipe.name), `missing recipe ${recipe.name}`);
      }
    }
    const area = layout.recipeBook.area;
    const lastRow = Math.ceil(pagination.pageSize / pagination.cols) - 1;
    assert.ok(area.y + 54 + lastRow * (pagination.cardH + pagination.gap) + pagination.cardH <= layout.recipeBookNav.prev.y);
    assert.ok(seen.includes('Печь + топливо'));
  }
});

test('recipe book controls stay visible between compact and desktop widths', () => {
  const G = loadGame();
  const s = G.state.createGameState();
  for (const width of [390, 900, 1024, 1120, 1280]) {
    const layout = G.crafting.getCraftingLayout({ width, height: 800 }, s);
    for (const rect of [layout.tabs.craft, layout.tabs.recipes, layout.recipeBookNav.prev, layout.recipeBookNav.next]) {
      assert.ok(rect.x >= 0 && rect.x + rect.w <= width, `control outside ${width}px canvas`);
    }
  }
});
