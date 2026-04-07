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
    if (mode === 'creative') return 'Творческий';
    if (mode === 'infinite_inventory') return 'Бесконечный инвентарь';
    if (mode === 'spectator') return 'Спектатор';
    return 'Выживание';
  }

  function worldTypeLabel(type) {
    if (type === 'flat') return 'Плоский';
    if (type === 'single_biome') return 'Один биом';
    if (type === 'floating_islands') return 'Летающие острова';
    if (type === 'cavern') return 'Пещерный режим';
    return 'Обычный';
  }

  function biomeLabel(biome) {
    if (biome === 'plains') return 'Равнина';
    if (biome === 'forest') return 'Лес';
    if (biome === 'mountains') return 'Горы';
    if (biome === 'snow_plains') return 'Снежная равнина';
    if (biome === 'desert') return 'Пустыня';
    if (biome === 'volcano') return 'Вулкан';
    return 'Лес';
  }

  function cavernBiomeLabel(biome) {
    if (biome === 'cave') return 'Пещера';
    if (biome === 'dwarf_caves') return 'Пещеры гномов';
    if (biome === 'deep') return 'Глубины';
    if (biome === 'fire_caves') return 'Огненные пещеры';
    return 'Микс';
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
            <button class="menu-mode-btn ${model.mode === 'infinite_inventory' ? 'is-active' : ''}" data-menu-mode="infinite_inventory">Бесконечный инвентарь</button>
            <button class="menu-mode-btn ${model.mode === 'spectator' ? 'is-active' : ''}" data-menu-mode="spectator">Спектатор</button>
          </div>
        </div>
        <div class="menu-field">
          <span>Тип мира</span>
          <div class="menu-mode-row">
            <button class="menu-mode-btn ${model.worldType === 'normal' ? 'is-active' : ''}" data-menu-world-type="normal">Обычный</button>
            <button class="menu-mode-btn ${model.worldType === 'flat' ? 'is-active' : ''}" data-menu-world-type="flat">Плоский</button>
            <button class="menu-mode-btn ${model.worldType === 'single_biome' ? 'is-active' : ''}" data-menu-world-type="single_biome">Один биом</button>
            <button class="menu-mode-btn ${model.worldType === 'floating_islands' ? 'is-active' : ''}" data-menu-world-type="floating_islands">Летающие острова</button>
            <button class="menu-mode-btn ${model.worldType === 'cavern' ? 'is-active' : ''}" data-menu-world-type="cavern">Пещерный режим</button>
          </div>
        </div>
        ${model.worldType === 'single_biome' ? `
          <div class="menu-field">
            <span>Биом</span>
            <div class="menu-mode-row">
              <button class="menu-mode-btn ${model.singleBiome === 'forest' ? 'is-active' : ''}" data-menu-single-biome="forest">Лес</button>
              <button class="menu-mode-btn ${model.singleBiome === 'plains' ? 'is-active' : ''}" data-menu-single-biome="plains">Равнина</button>
              <button class="menu-mode-btn ${model.singleBiome === 'mountains' ? 'is-active' : ''}" data-menu-single-biome="mountains">Горы</button>
              <button class="menu-mode-btn ${model.singleBiome === 'snow_plains' ? 'is-active' : ''}" data-menu-single-biome="snow_plains">Снежная равнина</button>
              <button class="menu-mode-btn ${model.singleBiome === 'desert' ? 'is-active' : ''}" data-menu-single-biome="desert">Пустыня</button>
              <button class="menu-mode-btn ${model.singleBiome === 'volcano' ? 'is-active' : ''}" data-menu-single-biome="volcano">Вулкан</button>
            </div>
          </div>
        ` : ''}
        ${model.worldType === 'cavern' ? `
          <div class="menu-field">
            <span>Пещерный биом</span>
            <div class="menu-mode-row">
              <button class="menu-mode-btn ${model.cavernBiome === 'mix' ? 'is-active' : ''}" data-menu-cavern-biome="mix">Микс</button>
              <button class="menu-mode-btn ${model.cavernBiome === 'cave' ? 'is-active' : ''}" data-menu-cavern-biome="cave">Пещера</button>
              <button class="menu-mode-btn ${model.cavernBiome === 'dwarf_caves' ? 'is-active' : ''}" data-menu-cavern-biome="dwarf_caves">Пещеры гномов</button>
              <button class="menu-mode-btn ${model.cavernBiome === 'deep' ? 'is-active' : ''}" data-menu-cavern-biome="deep">Глубины</button>
              <button class="menu-mode-btn ${model.cavernBiome === 'fire_caves' ? 'is-active' : ''}" data-menu-cavern-biome="fire_caves">Огненные пещеры</button>
            </div>
          </div>
        ` : ''}
        <div class="menu-hint">${model.mode === 'spectator'
          ? 'В режиме спектатора игрок проходит сквозь блоки, не получает урон, не видит HUD и не может ни с чем взаимодействовать.'
          : model.mode === 'infinite_inventory'
            ? 'Это выживание с бесконечным творческим каталогом предметов. При смерти игрок возрождается на месте без экрана поражения.'
          : model.mode === 'creative'
            ? 'В творческом режиме игрок летает, не получает урон, не тратит сытость и дыхание, а hostile-мобы игнорируют игрока.'
            : model.worldType === 'flat'
              ? 'Плоский мир без пещер и ландшафта. Подходит для строительства и тестов.'
              : model.worldType === 'single_biome'
                ? `Весь мир будет состоять из одного биома: ${biomeLabel(model.singleBiome)}.`
                : model.worldType === 'floating_islands'
                  ? 'Мир из разрозненных островов в воздухе. Основное пространство между ними — пустота.'
                  : model.worldType === 'cavern'
                    ? model.cavernBiome === 'mix'
                      ? 'Сплошной пещерный мир со всеми пещерными биомами: пещеры, пещеры гномов, глубины и огненные пещеры.'
                      : `Сплошной пещерный мир в биоме: ${cavernBiomeLabel(model.cavernBiome)}.`
                : 'В режиме выживания действуют урон, сытость, дыхание и обычные взаимодействия с миром.'}</div>
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
          <div class="world-line">Тип мира: ${worldTypeLabel(world.worldType || 'normal')}${world.worldType === 'single_biome' ? ` • ${biomeLabel(world.singleBiome || 'forest')}` : world.worldType === 'cavern' ? ` • ${cavernBiomeLabel(world.cavernBiome || 'mix')}` : ''}</div>
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

      const worldTypeButton = event.target.closest('[data-menu-world-type]');
      if (worldTypeButton) handlers.onWorldTypeChange(worldTypeButton.dataset.menuWorldType);

      const biomeButton = event.target.closest('[data-menu-single-biome]');
      if (biomeButton) handlers.onSingleBiomeChange(biomeButton.dataset.menuSingleBiome);

      const cavernBiomeButton = event.target.closest('[data-menu-cavern-biome]');
      if (cavernBiomeButton) handlers.onCavernBiomeChange(cavernBiomeButton.dataset.menuCavernBiome);
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
