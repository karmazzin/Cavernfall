(() => {
  const Game = window.MC2D;

  function setupInput(canvas, state, actions) {
    const keys = new Set();
    const mouse = { x: 0, y: 0, down: false, justPressed: false, button: 0 };
    const touchControls = document.getElementById('touchControls');
    const touchStick = document.getElementById('touchStick');
    const touchStickKnob = document.getElementById('touchStickKnob');
    const touchState = { active: false, pointerId: null };

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
        code === 'KeyF' ||
        code === 'KeyR' ||
        code === 'KeyY' ||
        code === 'Escape' ||
        code.startsWith('Digit') ||
        code.startsWith('Numpad')
      );
    }

    function isTypingTarget(target) {
      if (!target) return false;
      const tag = target.tagName;
      return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
    }

    function ensureUiState() {
      if (!state.ui) state.ui = {};
      state.ui.controlMode = isTouchMode() ? 'touch' : 'desktop';
    }

    function updateModeUi() {
      ensureUiState();
      document.body.classList.toggle('touch-mode', isTouchMode());
      if (touchControls) touchControls.setAttribute('aria-hidden', String(!isTouchMode()));
    }

    function clearTouchState() {
      keys.delete('KeyA');
      keys.delete('KeyD');
      keys.delete('KeyW');
      keys.delete('KeyS');
      mouse.down = false;
      mouse.justPressed = false;
      touchState.active = false;
      touchState.pointerId = null;
      if (touchStickKnob) {
        touchStickKnob.style.transform = 'translate(0px, 0px)';
      }
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
      if (isTypingTarget(event.target)) return;
      if (isGameControl(event.code)) event.preventDefault();
      keys.add(event.code);
      actions.unlockAudio();

      if (event.code === 'KeyE' && !state.gameOver && !event.repeat) actions.use();
      if (event.code === 'KeyF' && !event.repeat) actions.toggleCreativeFlight();
      if (event.code === 'KeyY' && !event.repeat) actions.toggleCrafting();
      if (event.code === 'Escape' && !event.repeat) actions.togglePause();
      if (state.gameOver && event.code === 'KeyR') actions.restart();

      let slotNumber = null;
      if (event.code.startsWith('Digit')) slotNumber = Number(event.code.slice(5));
      if (event.code.startsWith('Numpad')) slotNumber = Number(event.code.slice(6));
      handleSlotNumber(slotNumber);
    }

    function onKeyUp(event) {
      if (isTypingTarget(event.target)) return;
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

    function applyStickVector(dx, dy) {
      const deadZone = 0.25;
      keys.delete('KeyA');
      keys.delete('KeyD');
      keys.delete('KeyW');
      keys.delete('KeyS');

      if (dx <= -deadZone) keys.add('KeyA');
      if (dx >= deadZone) keys.add('KeyD');
      if (dy <= -deadZone) keys.add('KeyW');
      if (dy >= deadZone) keys.add('KeyS');
    }

    function bindTouchStick() {
      if (!touchStick || !touchStickKnob) return;

      function updateStick(clientX, clientY) {
        const rect = touchStick.getBoundingClientRect();
        const radius = rect.width / 2;
        const knobRadius = touchStickKnob.offsetWidth / 2;
        const centerX = rect.left + radius;
        const centerY = rect.top + radius;
        let dx = clientX - centerX;
        let dy = clientY - centerY;
        const maxDistance = Math.max(8, radius - knobRadius - 6);
        const distance = Math.hypot(dx, dy);
        if (distance > maxDistance) {
          const ratio = maxDistance / distance;
          dx *= ratio;
          dy *= ratio;
        }
        touchStickKnob.style.transform = `translate(${dx}px, ${dy}px)`;
        applyStickVector(dx / maxDistance, dy / maxDistance);
      }

      function releaseStick() {
        clearTouchState();
      }

      touchStick.addEventListener('pointerdown', (event) => {
        if (!isTouchMode()) return;
        event.preventDefault();
        actions.unlockAudio();
        touchState.active = true;
        touchState.pointerId = event.pointerId;
        touchStick.setPointerCapture(event.pointerId);
        updateStick(event.clientX, event.clientY);
      });

      touchStick.addEventListener('pointermove', (event) => {
        if (!touchState.active || event.pointerId !== touchState.pointerId) return;
        event.preventDefault();
        updateStick(event.clientX, event.clientY);
      });

      touchStick.addEventListener('pointerup', (event) => {
        if (event.pointerId !== touchState.pointerId) return;
        event.preventDefault();
        releaseStick();
      });

      touchStick.addEventListener('pointercancel', (event) => {
        if (event.pointerId !== touchState.pointerId) return;
        event.preventDefault();
        releaseStick();
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
    bindTouchStick();

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
