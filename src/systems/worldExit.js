(() => {
  const Game = window.MC2D;

  function confirmMenuExit(state, save) {
    if (!window.confirm('Сохранить мир и выйти в меню?')) return false;
    const finish = saved => {
      if (saved) return true;
      state.pause.statusText = state.saveError || 'Не удалось сохранить мир. Вы остались в игре.';
      window.alert(state.pause.statusText);
      return false;
    };
    const result = save();
    if (result && typeof result.then === 'function') {
      state.pause.statusText = 'Сохранение мира…';
      return result.then(finish);
    }
    return finish(result);
  }

  function beforeUnload(event, app, state) {
    if (app.screen !== 'playing') return;
    // Request the browser's own dialog; its wording is controlled by the browser.
    event.preventDefault();
    event.returnValue = true;
    // Persist synchronously even if the user later cancels leaving. Avoid preview
    // rendering and menu updates while the document is preparing to unload.
    Game.saveSystem.saveWorld(state);
  }

  Game.worldExit = { confirmMenuExit, beforeUnload };
})();
