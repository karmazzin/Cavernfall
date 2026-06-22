(() => {
  const Game = window.MC2D;
  const { biomeLabel, getSelectableSingleBiomes } = Game.world;

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function modeLabel(mode) {
    if (mode === 'mobile') return 'Мобильный режим';
    if (mode === 'creative') return 'Творческий';
    if (mode === 'infinite_inventory') return 'Бесконечный инвентарь';
    if (mode === 'spectator') return 'Спектатор';
    if (mode === 'hardcore') return 'Хардкор';
    if (mode === 'hardcore_spectator') return 'Хардкорный спектатор';
    return 'Выживание';
  }

  function worldTypeLabel(type) {
    if (type === 'flat') return 'Плоский';
    if (type === 'single_biome') return 'Один биом';
    if (type === 'floating_islands') return 'Летающие острова';
    if (type === 'cavern') return 'Пещерный режим';
    return 'Обычный';
  }

  function renderBiomeButtons(model) {
    return getSelectableSingleBiomes().map((biome) => `
      <button class="menu-mode-btn ${model.singleBiome === biome ? 'is-active' : ''}" data-menu-single-biome="${biome}">${biomeLabel(biome)}</button>
    `).join('');
  }

  function renderMain() {
    const mobileClient = matchMedia('(pointer: coarse)').matches || Math.max(navigator.maxTouchPoints || 0, navigator.msMaxTouchPoints || 0) > 0 || window.innerWidth <= 1024;
    return `
      <div class="menu-card menu-hero">
        <h1 class="menu-logo" aria-label="Cavern Fall">
          <span>Cavern</span>
          <span>Fall</span>
        </h1>
        <div class="menu-subtitle">Подземное выживание, шахты, озёра, вулканы</div>
        <div class="menu-actions">
          <button class="menu-btn menu-btn-primary" data-menu-action="open-new">Создать Новый Мир</button>
          <button class="menu-btn" data-menu-action="open-new-3d">3D игра</button>
          <button class="menu-btn" data-menu-action="open-load">Загрузить Сохраненные Миры</button>
          ${mobileClient ? '' : '<button class="menu-btn" data-menu-action="open-assistant">Спросить у чат-бота</button>'}
        </div>
      </div>
    `;
  }

  function renderNewWorld(app, is3d = false) {
    const model = app.newWorld;
    const mobileClient = matchMedia('(pointer: coarse)').matches || Math.max(navigator.maxTouchPoints || 0, navigator.msMaxTouchPoints || 0) > 0 || window.innerWidth <= 1024;
    return `
      <div class="menu-card menu-form-card">
        <div class="menu-panel-title">${is3d ? 'Создание 3D Мира' : 'Создание Мира'}</div>
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
            ${mobileClient
              ? `
                <button class="menu-mode-btn ${model.mode === 'mobile' ? 'is-active' : ''}" data-menu-mode="mobile">Мобильный режим</button>
                <button class="menu-mode-btn ${model.mode === 'spectator' ? 'is-active' : ''}" data-menu-mode="spectator">Спектатор</button>
              `
              : `
                <button class="menu-mode-btn ${model.mode === 'survival' ? 'is-active' : ''}" data-menu-mode="survival">Выживание</button>
                <button class="menu-mode-btn ${model.mode === 'creative' ? 'is-active' : ''}" data-menu-mode="creative">Творческий</button>
                <button class="menu-mode-btn ${model.mode === 'infinite_inventory' ? 'is-active' : ''}" data-menu-mode="infinite_inventory">Бесконечный инвентарь</button>
                <button class="menu-mode-btn ${model.mode === 'spectator' ? 'is-active' : ''}" data-menu-mode="spectator">Спектатор</button>
                <button class="menu-mode-btn ${model.mode === 'hardcore' ? 'is-active' : ''}" data-menu-mode="hardcore">Хардкор</button>
              `}
          </div>
        </div>
        <div class="menu-field">
          <span>Тип мира</span>
          <div class="menu-mode-row">
            <button class="menu-mode-btn ${model.worldType === 'normal' ? 'is-active' : ''}" data-menu-world-type="normal">Обычный</button>
            <button class="menu-mode-btn ${model.worldType === 'flat' ? 'is-active' : ''}" data-menu-world-type="flat">Плоский</button>
            <button class="menu-mode-btn ${model.worldType === 'single_biome' ? 'is-active' : ''}" data-menu-world-type="single_biome">Один биом</button>
          </div>
        </div>
        ${model.worldType === 'single_biome' ? `
          <div class="menu-field">
            <span>Биом</span>
            <div class="menu-mode-row">
              ${renderBiomeButtons(model)}
            </div>
          </div>
        ` : ''}
        <div class="menu-hint">${model.mode === 'spectator'
              ? 'В режиме спектатора игрок проходит сквозь блоки, не получает урон, не видит HUD и не может ни с чем взаимодействовать.'
          : model.mode === 'mobile'
            ? 'Мобильный режим доступен только на touch-устройствах. В нём нет инвентаря, нельзя добывать и строить, а hostile-мобы игнорируют игрока как в творческом.'
          : model.mode === 'infinite_inventory'
            ? 'Это выживание с бесконечным творческим каталогом предметов. При смерти игрок возрождается на месте без экрана поражения.'
            : model.mode === 'creative'
              ? 'В творческом режиме игрок летает, не получает урон, не тратит сытость и дыхание, а hostile-мобы игнорируют игрока.'
              : is3d
                ? 'Первый 3D-прототип создаёт небольшой мир с холмами. Типы мира и биомы будут подключены позже.'
              : model.worldType === 'flat'
                ? 'Плоский мир без пещер и ландшафта. Подходит для строительства и тестов.'
                : model.worldType === 'single_biome'
                  ? `Весь мир будет состоять из одного биома: ${biomeLabel(model.singleBiome)}. Список пополняется всеми основными биомами игры.`
              : model.mode === 'hardcore'
                ? 'Хардкор: после смерти нельзя продолжить игру. Можно только удалить мир или стать безвыходным спектатором.'
                : 'В режиме выживания действуют урон, сытость, дыхание и обычные взаимодействия с миром.'}</div>
        <div class="menu-actions menu-actions-inline">
          <button class="menu-btn menu-btn-primary" data-menu-action="${is3d ? 'create-world-3d' : 'create-world'}">Создать</button>
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
          <div class="world-line">Тип мира: ${worldTypeLabel(world.worldType || 'normal')}${world.worldType === 'single_biome' ? ` • ${biomeLabel(world.singleBiome || 'forest')}` : ''}</div>
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
      const playing = app.screen === 'playing' || app.screen === 'playing3d';
      root.classList.toggle('is-hidden', playing);
      if (playing) {
        root.innerHTML = '';
        return;
      }

      let content = renderMain();
      if (app.screen === 'new-world') content = renderNewWorld(app);
      if (app.screen === 'new-world-3d') content = renderNewWorld(app, true);
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

      const worldTypeButton = event.target.closest('[data-menu-world-type]');
      if (worldTypeButton) handlers.onWorldTypeChange(worldTypeButton.dataset.menuWorldType);

      const biomeButton = event.target.closest('[data-menu-single-biome]');
      if (biomeButton) handlers.onSingleBiomeChange(biomeButton.dataset.menuSingleBiome);
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
