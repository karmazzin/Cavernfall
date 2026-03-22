(() => {
  const Game = window.MC2D;

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function modeLabel(mode) {
    return mode === 'creative' ? 'Творческий' : 'Выживание';
  }

  function renderMain() {
    return `
      <div class="menu-card menu-hero">
        <h1 class="menu-logo" aria-label="Cavern Fall">
          <span>Cavern</span>
          <span>Fall</span>
        </h1>
        <div class="menu-subtitle">Подземное выживание, шахты, озёра, вулканы</div>
        <div class="menu-actions">
          <button class="menu-btn menu-btn-primary" data-menu-action="open-new">Создать Новый Мир</button>
          <button class="menu-btn" data-menu-action="open-load">Загрузить Сохраненные Миры</button>
        </div>
      </div>
    `;
  }

  function renderNewWorld(app) {
    const model = app.newWorld;
    return `
      <div class="menu-card menu-form-card">
        <div class="menu-panel-title">Создание Мира</div>
        <label class="menu-field">
          <span>Название мира</span>
          <input type="text" data-menu-input="name" maxlength="40" value="${escapeHtml(model.name)}" placeholder="Новый мир" />
        </label>
        <label class="menu-field">
          <span>Сид</span>
          <input type="text" data-menu-input="seed" maxlength="60" value="${escapeHtml(model.seed)}" placeholder="Случайный сид" />
        </label>
        <div class="menu-field">
          <span>Режим</span>
          <div class="menu-mode-row">
            <button class="menu-mode-btn ${model.mode === 'survival' ? 'is-active' : ''}" data-menu-mode="survival">Выживание</button>
            <button class="menu-mode-btn ${model.mode === 'creative' ? 'is-active' : ''}" data-menu-mode="creative">Творческий</button>
          </div>
        </div>
        <div class="menu-hint">В творческом режиме игрок летает, не получает урон, не тратит сытость и дыхание, а hostile-мобы игнорируют игрока.</div>
        <div class="menu-actions menu-actions-inline">
          <button class="menu-btn menu-btn-primary" data-menu-action="create-world">Создать</button>
          <button class="menu-btn" data-menu-action="back-main">Назад</button>
        </div>
      </div>
    `;
  }

  function renderWorldCard(world) {
    const preview = world.preview
      ? `<img class="world-preview" src="${world.preview}" alt="Превью ${escapeHtml(world.name)}" />`
      : '<div class="world-preview world-preview-placeholder">Нет превью</div>';
    return `
      <div class="world-card">
        ${preview}
        <div class="world-meta">
          <div class="world-name">${escapeHtml(world.name || 'Безымянный мир')}</div>
          <div class="world-line">Режим: ${modeLabel(world.mode)}</div>
          <div class="world-line">Сид: ${escapeHtml(world.seed || 'случайный')}</div>
          <div class="world-line">Сохранён: ${new Date(world.updatedAt || world.createdAt || Date.now()).toLocaleString('ru-RU')}</div>
        </div>
        <div class="world-actions">
          <button class="menu-btn menu-btn-primary" data-menu-action="load-world" data-world-id="${escapeHtml(world.id)}">Играть</button>
          <button class="menu-btn menu-btn-danger" data-menu-action="delete-world" data-world-id="${escapeHtml(world.id)}">Удалить</button>
        </div>
      </div>
    `;
  }

  function renderLoad(app) {
    const worlds = app.worlds || [];
    return `
      <div class="menu-card menu-load-card">
        <div class="menu-panel-title">Сохранённые Миры</div>
        <div class="world-list">
          ${worlds.length ? worlds.map(renderWorldCard).join('') : '<div class="menu-empty">Пока нет сохранённых миров.</div>'}
        </div>
        <div class="menu-actions menu-actions-inline">
          <button class="menu-btn" data-menu-action="back-main">Назад</button>
        </div>
      </div>
    `;
  }

  function createMenuUi(root, handlers) {
    function render(app) {
      root.classList.toggle('is-hidden', app.screen === 'playing');
      if (app.screen === 'playing') {
        root.innerHTML = '';
        return;
      }

      let content = renderMain();
      if (app.screen === 'new-world') content = renderNewWorld(app);
      if (app.screen === 'load-worlds') content = renderLoad(app);
      root.innerHTML = `<div class="menu-shell">${content}</div>`;
    }

    root.addEventListener('click', (event) => {
      const actionButton = event.target.closest('[data-menu-action]');
      if (actionButton) {
        const action = actionButton.dataset.menuAction;
        const worldId = actionButton.dataset.worldId || null;
        handlers.onAction(action, worldId);
        return;
      }

      const modeButton = event.target.closest('[data-menu-mode]');
      if (modeButton) handlers.onModeChange(modeButton.dataset.menuMode);
    });

    root.addEventListener('input', (event) => {
      const input = event.target.closest('[data-menu-input]');
      if (!input) return;
      handlers.onInput(input.dataset.menuInput, input.value);
    });

    return { render };
  }

  Game.menuUi = { createMenuUi };
})();
