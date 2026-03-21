(() => {
  const Game = window.MC2D;

  function setupInput(canvas, state, actions) {
    const keys = new Set();
    const mouse = { x: 0, y: 0, down: false, justPressed: false, button: 0 };

    function isGameControl(code) {
      return (
        code === 'Space' ||
        code === 'KeyW' ||
        code === 'KeyA' ||
        code === 'KeyS' ||
        code === 'KeyD' ||
        code === 'KeyE' ||
        code === 'KeyR' ||
        code === 'KeyY' ||
        code === 'Escape' ||
        code.startsWith('Digit') ||
        code.startsWith('Numpad')
      );
    }

    function onKeyDown(event) {
      if (isGameControl(event.code)) event.preventDefault();
      keys.add(event.code);
      actions.unlockAudio();

      if (event.code === 'KeyE' && !state.gameOver) actions.eatFood();
      if (event.code === 'KeyY' && !event.repeat) actions.toggleCrafting();
      if (event.code === 'Escape' && !event.repeat) actions.togglePause();
      if (state.gameOver && event.code === 'KeyR') actions.restart();

      let slotNumber = null;
      if (event.code.startsWith('Digit')) slotNumber = Number(event.code.slice(5));
      if (event.code.startsWith('Numpad')) slotNumber = Number(event.code.slice(6));
      if (slotNumber >= 1 && slotNumber <= 9) state.player.selectedSlot = slotNumber - 1;
    }

    function onKeyUp(event) {
      if (isGameControl(event.code)) event.preventDefault();
      keys.delete(event.code);
    }

    function onMouseMove(event) {
      const rect = canvas.getBoundingClientRect();
      mouse.x = event.clientX - rect.left;
      mouse.y = event.clientY - rect.top;
    }

    function onMouseDown(event) {
      event.preventDefault();
      actions.unlockAudio();
      mouse.down = true;
      mouse.justPressed = true;
      mouse.button = event.button;
    }

    function onMouseUp() {
      mouse.down = false;
    }

    function onContextMenu(event) {
      event.preventDefault();
    }

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('contextmenu', onContextMenu);
    window.addEventListener('mouseup', onMouseUp);

    return { keys, mouse };
  }

  Game.input = { setupInput };
})();
