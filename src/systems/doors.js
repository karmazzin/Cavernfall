(() => {
  const Game = window.MC2D;
  const { BLOCK } = Game.blocks;
  const { getBlock, setBlock } = Game.world;

  function doorKey(tx, ty) {
    return `${tx},${ty}`;
  }

  function ensureDoorMap(state) {
    if (!state.doors || typeof state.doors !== 'object') state.doors = {};
    return state.doors;
  }

  function ensureDoorAt(state, tx, ty, ownerSettlementId = null, tower = false) {
    const doors = ensureDoorMap(state);
    const key = doorKey(tx, ty);
    if (!doors[key]) doors[key] = { open: false, ownerSettlementId, tower: !!tower, baseX: tx, baseY: ty, upper: false, height: 1 };
    if (ownerSettlementId && !doors[key].ownerSettlementId) doors[key].ownerSettlementId = ownerSettlementId;
    if (tower) doors[key].tower = true;
    return doors[key];
  }

  function resolveDoorBase(state, tx, ty) {
    const doors = ensureDoorMap(state);
    const direct = doors[doorKey(tx, ty)];
    if (direct) return { tx: direct.baseX ?? tx, ty: direct.baseY ?? ty };
    const below = doors[doorKey(tx, ty + 1)];
    if (below && below.upper) return { tx: below.baseX ?? tx, ty: below.baseY ?? ty + 1 };
    const above = doors[doorKey(tx, ty - 1)];
    if (above && !above.upper && above.height === 2) return { tx: above.baseX ?? tx, ty: above.baseY ?? ty - 1 };
    return null;
  }

  function getDoorAt(state, tx, ty) {
    const doors = ensureDoorMap(state);
    return doors[doorKey(tx, ty)] || null;
  }

  function placeDoor(state, tx, baseY, options = {}) {
    const { ownerSettlementId = null, tower = false, open = true, height = 2 } = options;
    const doors = ensureDoorMap(state);
    const parts = Math.max(1, height | 0);
    for (let i = 0; i < parts; i += 1) {
      const ty = baseY - i;
      setBlock(state, tx, ty, BLOCK.DOOR);
      doors[doorKey(tx, ty)] = {
        open: !!open,
        ownerSettlementId,
        tower: !!tower,
        baseX: tx,
        baseY,
        upper: i > 0,
        height: parts,
      };
    }
    return doors[doorKey(tx, baseY)];
  }

  function setDoorOpen(state, tx, ty, open) {
    const base = resolveDoorBase(state, tx, ty);
    if (!base) return false;
    const doors = ensureDoorMap(state);
    const root = doors[doorKey(base.tx, base.ty)];
    if (!root) return false;
    for (let i = 0; i < (root.height || 1); i += 1) {
      const part = doors[doorKey(base.tx, base.ty - i)];
      if (part) part.open = !!open;
    }
    return true;
  }

  function toggleDoor(state, tx, ty) {
    const door = getDoorAt(state, tx, ty);
    return setDoorOpen(state, tx, ty, !(door && door.open));
  }

  function removeDoorAt(state, tx, ty) {
    const doors = ensureDoorMap(state);
    const base = resolveDoorBase(state, tx, ty);
    if (!base) return null;
    const root = doors[doorKey(base.tx, base.ty)] || null;
    if (!root) return null;
    for (let i = 0; i < (root.height || 1); i += 1) {
      delete doors[doorKey(base.tx, base.ty - i)];
      if (getBlock(state, base.tx, base.ty - i) === BLOCK.DOOR) setBlock(state, base.tx, base.ty - i, BLOCK.AIR);
    }
    return root;
  }

  Game.doorSystem = {
    doorKey,
    ensureDoorMap,
    ensureDoorAt,
    resolveDoorBase,
    getDoorAt,
    placeDoor,
    setDoorOpen,
    toggleDoor,
    removeDoorAt,
  };
})();
