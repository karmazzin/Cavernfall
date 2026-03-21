(() => {
  const Game = window.MC2D;

  function setupInput(canvas, state, actions) {
    const keys = new Set();
    const mouse = { x: 0, y: 0, down: false, justPressed: false };

    function onKeyDown(event) {
      const key = event.key.toLowerCase();
      keys.add(key);

      if (key === 'e' && !state.gameOver) actions.eatFood();
      if (state.gameOver && key === 'r') actions.restart();

      const slotNumber = Number(event.key);
      if (slotNumber >= 1 && slotNumber <= 9) state.player.selectedSlot = slotNumber - 1;
    }

    function onKeyUp(event) {
      keys.delete(event.key.toLowerCase());
    }

    function onMouseMove(event) {
      const rect = canvas.getBoundingClientRect();
      mouse.x = event.clientX - rect.left;
      mouse.y = event.clientY - rect.top;
    }

    function onMouseDown() {
      mouse.down = true;
      mouse.justPressed = true;
    }

    function onMouseUp() {
      mouse.down = false;
    }

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);

    return { keys, mouse };
  }

  Game.input = { setupInput };
})();
