(() => {
  const Game = window.MC2D;

  function setupInput(canvas, state, actions) {
    const keys = new Set();
    const mouse = { x: 0, y: 0, down: false, justPressed: false, button: 0 };
    const touchControls = document.getElementById('touchControls');

    function detectTouchMode() {
      return window.matchMedia('(pointer: coarse)').matches || window.innerWidth <= 900;
    }

    function isTouchMode() {
      return detectTouchMode();
    }

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

    function ensureUiState() {
      if (!state.ui) state.ui = {};
      state.ui.controlMode = isTouchMode() ? 'touch' : 'desktop';
      state.ui.helpCollapsed = true;
    }

    function updateModeUi() {
      ensureUiState();
      document.body.classList.toggle('touch-mode', isTouchMode());
      document.body.classList.remove('help-collapsed');
      if (touchControls) touchControls.setAttribute('aria-hidden', String(!isTouchMode()));
    }

    function clearTouchState() {
      keys.delete('KeyA');
      keys.delete('KeyD');
      keys.delete('KeyW');
      keys.delete('KeyS');
      mouse.down = false;
      mouse.justPressed = false;
    }

    function updateFullscreenLabel() {
      const active = !!document.fullscreenElement;
      if (state.pause) state.pause.fullscreenLabel = active ? 'Выйти из полного экрана' : 'Полный экран';
    }

    async function toggleFullscreen() {
      if (!document.fullscreenEnabled) return;
      try {
        if (document.fullscreenElement) await document.exitFullscreen();
        else await document.documentElement.requestFullscreen();
      } catch (error) {
        // ignore unsupported fullscreen failures
      }
      updateFullscreenLabel();
    }

    function updateMousePosition(clientX, clientY) {
      const rect = canvas.getBoundingClientRect();
      mouse.x = clientX - rect.left;
      mouse.y = clientY - rect.top;
    }

    function handleSlotNumber(slotNumber) {
      if (slotNumber >= 1 && slotNumber <= 9) state.player.selectedSlot = slotNumber - 1;
    }

    function trySelectHotbarSlot() {
      if ((state.pause && state.pause.open) || (state.crafting && state.crafting.open)) return false;
      const layoutApi = Game.uiRenderer;
      if (!layoutApi || typeof layoutApi.getHotbarLayout !== 'function') return false;
      const layout = layoutApi.getHotbarLayout(canvas, state);
      for (let i = 0; i < layout.slots.length; i += 1) {
        const slot = layout.slots[i];
        if (mouse.x >= slot.x && mouse.x <= slot.x + slot.w && mouse.y >= slot.y && mouse.y <= slot.y + slot.h) {
          state.player.selectedSlot = i;
          return true;
        }
      }
      return false;
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
      handleSlotNumber(slotNumber);
    }

    function onKeyUp(event) {
      if (isGameControl(event.code)) event.preventDefault();
      keys.delete(event.code);
    }

    function onMouseMove(event) {
      updateMousePosition(event.clientX, event.clientY);
    }

    function onMouseDown(event) {
      if (isTouchMode()) return;
      event.preventDefault();
      actions.unlockAudio();
      mouse.down = true;
      mouse.justPressed = true;
      mouse.button = event.button;
    }

    function onMouseUp() {
      if (isTouchMode()) return;
      mouse.down = false;
    }

    function onContextMenu(event) {
      event.preventDefault();
    }

    function onTouchStart(event) {
      if (!isTouchMode()) return;
      event.preventDefault();
      actions.unlockAudio();
      const touch = event.changedTouches[0];
      if (!touch) return;
      updateMousePosition(touch.clientX, touch.clientY);
      if (trySelectHotbarSlot()) {
        mouse.down = false;
        mouse.justPressed = false;
        return;
      }
      mouse.down = true;
      mouse.justPressed = true;
      mouse.button = event.touches.length > 1 ? 2 : 0;
    }

    function onTouchMove(event) {
      if (!isTouchMode()) return;
      event.preventDefault();
      const touch = event.changedTouches[0];
      if (!touch) return;
      updateMousePosition(touch.clientX, touch.clientY);
    }

    function onTouchEnd(event) {
      if (!isTouchMode()) return;
      event.preventDefault();
      if (event.touches.length === 0) mouse.down = false;
    }

    function bindHoldButton(button, code) {
      function press(event) {
        event.preventDefault();
        actions.unlockAudio();
        keys.add(code);
        button.classList.add('is-active');
      }
      function release(event) {
        event.preventDefault();
        keys.delete(code);
        button.classList.remove('is-active');
      }
      button.addEventListener('pointerdown', press);
      button.addEventListener('pointerup', release);
      button.addEventListener('pointercancel', release);
      button.addEventListener('pointerleave', release);
    }

    function bindActionButton(button, action) {
      button.addEventListener('click', (event) => {
        event.preventDefault();
        actions.unlockAudio();
        if (action === 'eat') actions.eatFood();
        if (action === 'craft') actions.toggleCrafting();
        if (action === 'pause') actions.togglePause();
      });
    }

    document.addEventListener('fullscreenchange', updateFullscreenLabel);
    window.addEventListener('resize', () => {
      clearTouchState();
      updateModeUi();
    });

    if (touchControls) {
      for (const button of touchControls.querySelectorAll('[data-key]')) bindHoldButton(button, button.dataset.key);
      for (const button of touchControls.querySelectorAll('[data-action]')) bindActionButton(button, button.dataset.action);
    }

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('contextmenu', onContextMenu);
    window.addEventListener('mouseup', onMouseUp);
    canvas.addEventListener('touchstart', onTouchStart, { passive: false });
    canvas.addEventListener('touchmove', onTouchMove, { passive: false });
    canvas.addEventListener('touchend', onTouchEnd, { passive: false });
    canvas.addEventListener('touchcancel', onTouchEnd, { passive: false });

    updateModeUi();
    updateFullscreenLabel();

    return {
      keys,
      mouse,
      syncUiState() {
        ensureUiState();
        updateModeUi();
        updateFullscreenLabel();
      },
      toggleFullscreen,
    };
  }

  Game.input = { setupInput };
})();
