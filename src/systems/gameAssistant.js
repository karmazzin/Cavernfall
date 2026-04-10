(() => {
  const Game = window.MC2D;

  const FALLBACK_TEXT = 'Извините, я не знаю информацию.';
  const QUICK_QUESTIONS = [
    'Как начать играть?',
    'Как попасть в огненный мир?',
    'Как получить амулет дружбы?',
    'Как попасть в водные пещеры?',
    'Что нужно для Кристалла воды?',
    'Как работает водный колодец?',
  ];

  const KNOWLEDGE_BASE = [
    {
      title: 'Как начать играть',
      keywords: ['как начать играть', 'как начать', 'что делать в начале', 'начало игры'],
      answer: 'Начни с дерева и камня. Сделай доски, палки, верстак и каменную кирку, потом ищи железо.',
    },
    {
      title: 'Как сделать каменную кирку',
      keywords: ['каменная кирка', 'как сделать каменную кирку', 'кирка из камня'],
      answer: 'Сначала добудь камень, потом скрафти палки и сделай каменную кирку на верстаке.',
    },
    {
      title: 'Как добыть железо',
      keywords: ['железо', 'как добыть железо', 'железная руда'],
      answer: 'Ищи железную руду под землёй. Добудь её киркой и переплавь в железные слитки.',
    },
    {
      title: 'Как сделать железную кирку',
      keywords: ['железная кирка', 'как сделать железную кирку'],
      answer: 'Нужны железные слитки и палки. Скрафти её на верстаке после переплавки железа.',
    },
    {
      title: 'Как попасть в огненный мир',
      keywords: ['как попасть в огненный мир', 'огненный мир', 'портал в огненный мир'],
      answer: 'Найди Пирамиду огня, брось Огненный кристалл в центральную лаву, победи босса и войди в появившийся портал.',
    },
    {
      title: 'Как найти пирамиду огня',
      keywords: ['пирамида огня', 'как найти пирамиду огня'],
      answer: 'Пирамида огня генерируется один раз на мир в тёплом климате. В творческом режиме её можно найти через компас.',
    },
    {
      title: 'Как вызвать босса у пирамиды огня',
      keywords: ['как вызвать босса у пирамиды огня', 'ритуал огня', 'огненный кристалл'],
      answer: 'Брось Огненный кристалл в центральную лаву Пирамиды огня. После луча появится босс.',
    },
    {
      title: 'Как найти замок огненного короля',
      keywords: ['замок огненного короля', 'как найти замок огненного короля'],
      answer: 'Замок находится в огненном мире. В творческом режиме его можно отслеживать через компас.',
    },
    {
      title: 'Как получить ключ от огненной темницы',
      keywords: ['ключ от огненной темницы', 'как получить ключ'],
      answer: 'Ключ выпадает после победы над Огненным королём.',
    },
    {
      title: 'Как найти огненную темницу',
      keywords: ['огненная темница', 'как найти огненную темницу'],
      answer: 'Для поиска нужен Ключ от огненной темницы. Когда ключ у тебя есть, он показывает направление к темнице.',
    },
    {
      title: 'Как получить амулет дружбы',
      keywords: ['амулет дружбы', 'как получить амулет дружбы'],
      answer: 'Освободи Доброго огненного короля в Огненной темнице. После освобождения амулет передаётся игроку.',
    },
    {
      title: 'Что делает амулет дружбы',
      keywords: ['что делает амулет дружбы', 'эффект амулета дружбы'],
      answer: 'Амулет дружбы защищает рядом с лавой и участвует в механике дружбы. Если он потеряется, игра возвращает его в инвентарь.',
    },
    {
      title: 'Как сделать броню дружбы',
      keywords: ['броня дружбы', 'как сделать броню дружбы'],
      answer: 'Броня дружбы крафтится из Дружных слитков так же, как железная. Полный сет защищает от горения и удушья под водой.',
    },
    {
      title: 'Как сделать инструменты дружбы',
      keywords: ['инструменты дружбы', 'как сделать инструменты дружбы'],
      answer: 'Инструменты дружбы крафтятся из Дружных слитков. Они сильнее алмазных и нужны для поздней игры.',
    },
    {
      title: 'Как попасть в водные пещеры',
      keywords: ['как попасть в водные пещеры', 'водные пещеры'],
      answer: 'Водные пещеры появляются один раз на мир. Для прохождения нужен полный сет Брони дружбы.',
    },
    {
      title: 'Что нужно для Кристалла воды',
      keywords: ['что нужно для кристалла воды', 'кристалл воды', 'как взять кристалл воды'],
      answer: 'Чтобы взять Кристалл воды, у тебя в инвентаре должны быть все инструменты дружбы: кирка, топор, лопата и меч.',
    },
    {
      title: 'Кто такой Кракен',
      keywords: ['кракен', 'кто такой кракен'],
      answer: 'Это босс Водных пещер с 200 HP. Он появляется после взятия Кристалла воды.',
    },
    {
      title: 'Как работает водный колодец',
      keywords: ['водный колодец', 'как работает водный колодец'],
      answer: 'Водный колодец появляется один раз на мир в снежной равнине. Если положить Кристалл воды в воду в центре, появится водный луч и портал в водное измерение.',
    },
    {
      title: 'Что делает компас',
      keywords: ['компас', 'что делает компас'],
      answer: 'Компас в паузе доступен в творческом режиме. Он помогает находить уникальные структуры и пещеры.',
    },
    {
      title: 'Что значит кнопка В путь',
      keywords: ['в путь', 'кнопка в путь', 'компас в путь'],
      answer: 'Она переносит выбранную цель на HUD рядом с хотбаром. Когда ты достигаешь цели, отслеживание снимается автоматически.',
    },
    {
      title: 'Что такое бесконечный инвентарь',
      keywords: ['бесконечный инвентарь', 'режим бесконечный инвентарь'],
      answer: 'Это режим выживания с творческим каталогом предметов. При смерти игрок возрождается на месте смерти.',
    },
    {
      title: 'Как работает подушка',
      keywords: ['подушка', 'как работает подушка', 'сон'],
      answer: 'На подушке можно спать. Ночью она пропускает ночь, днём пропускает день.',
    },
    {
      title: 'Что такое снежная равнина',
      keywords: ['снежная равнина', 'зимний биом', 'снег'],
      answer: 'Это холодный биом со снегом на поверхности, елями и зимними деревнями.',
    },
    {
      title: 'Что такое огненные пещеры',
      keywords: ['огненные пещеры', 'огненный биом'],
      answer: 'Это особый пещерный биом, связанный с огненной progression-веткой. Их можно искать через компас в творческом режиме.',
    },
    {
      title: 'Какие есть типы мира',
      keywords: ['типы мира', 'какие миры есть', 'режимы генерации'],
      answer: 'Сейчас есть обычный мир, плоский мир, один биом, летающие острова и пещерный режим.',
    },
    {
      title: 'Что такое пещерный режим',
      keywords: ['пещерный режим', 'пещерный мир'],
      answer: 'Это тип мира, в котором весь мир состоит из пещер. Можно выбрать один пещерный биом или микс всех пещерных биомов.',
    },
    {
      title: 'Что такое летающие острова',
      keywords: ['летающие острова', 'острова в воздухе'],
      answer: 'Это тип мира, где поверхность разбита на острова в воздухе. Между ними находится пустота.',
    },
  ];

  function normalize(text) {
    return String(text || '')
      .toLowerCase()
      .replace(/ё/g, 'е')
      .replace(/[^a-zа-я0-9\s]/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function scoreEntry(entry, question) {
    let score = 0;
    const normalizedTitle = normalize(entry.title);
    if (question === normalizedTitle) score += 20;
    if (question.includes(normalizedTitle)) score += 10;
    for (const keyword of entry.keywords) {
      const normalizedKeyword = normalize(keyword);
      if (!normalizedKeyword) continue;
      if (question === normalizedKeyword) score += 18;
      else if (question.includes(normalizedKeyword)) score += 8;
      const parts = normalizedKeyword.split(' ').filter((part) => part.length >= 4);
      for (const part of parts) {
        if (question.includes(part)) score += 2;
      }
    }
    return score;
  }

  function answerQuestion(question) {
    const normalizedQuestion = normalize(question);
    if (!normalizedQuestion) return FALLBACK_TEXT;
    let bestEntry = null;
    let bestScore = 0;
    for (const entry of KNOWLEDGE_BASE) {
      const score = scoreEntry(entry, normalizedQuestion);
      if (score > bestScore) {
        bestScore = score;
        bestEntry = entry;
      }
    }
    if (!bestEntry || bestScore < 8) return FALLBACK_TEXT;
    return bestEntry.answer;
  }

  function createNode(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function createAssistantUi(root, options = {}) {
    const onClose = typeof options.onClose === 'function' ? options.onClose : () => {};
    root.innerHTML = `
      <div class="assistant-panel">
        <div class="assistant-header">
          <div>
            <div class="assistant-title">Помощник</div>
            <div class="assistant-subtitle">Отвечает только по этой игре</div>
          </div>
          <button type="button" class="assistant-close">Назад</button>
        </div>
        <div class="assistant-quick"></div>
        <div class="assistant-messages"></div>
        <form class="assistant-form">
          <input type="text" class="assistant-input" maxlength="180" placeholder="Спроси про игру" />
          <button type="submit" class="assistant-send">Спросить</button>
        </form>
      </div>
    `;

    const messagesEl = root.querySelector('.assistant-messages');
    const quickEl = root.querySelector('.assistant-quick');
    const formEl = root.querySelector('.assistant-form');
    const inputEl = root.querySelector('.assistant-input');
    const closeEl = root.querySelector('.assistant-close');
    const messages = [
      {
        role: 'assistant',
        text: 'Спроси про механики этой игры. Если вопрос не про игру, я отвечу: «Извините, я не знаю информацию.»',
      },
    ];

    function renderMessages() {
      messagesEl.innerHTML = '';
      for (const message of messages.slice(-10)) {
        const item = createNode('div', `assistant-message assistant-message-${message.role}`);
        const bubble = createNode('div', 'assistant-bubble', message.text);
        item.appendChild(bubble);
        messagesEl.appendChild(item);
      }
      messagesEl.scrollTop = messagesEl.scrollHeight;
    }

    function ask(question) {
      const trimmed = String(question || '').trim();
      if (!trimmed) return;
      messages.push({ role: 'user', text: trimmed });
      messages.push({ role: 'assistant', text: answerQuestion(trimmed) });
      renderMessages();
      inputEl.value = '';
      inputEl.focus();
    }

    for (const question of QUICK_QUESTIONS) {
      const button = createNode('button', 'assistant-quick-btn', question);
      button.type = 'button';
      button.addEventListener('click', () => ask(question));
      quickEl.appendChild(button);
    }

    formEl.addEventListener('submit', (event) => {
      event.preventDefault();
      ask(inputEl.value);
    });

    closeEl.addEventListener('click', () => onClose());

    renderMessages();

    return {
      setVisible(visible) {
        root.classList.toggle('is-hidden', !visible);
        root.setAttribute('aria-hidden', visible ? 'false' : 'true');
        if (visible) inputEl.focus();
      },
      reset() {
        messages.length = 0;
        messages.push({
          role: 'assistant',
          text: 'Спроси про механики этой игры. Если вопрос не про игру, я отвечу: «Извините, я не знаю информацию.»',
        });
        renderMessages();
      },
      answerQuestion,
    };
  }

  Game.gameAssistant = { createAssistantUi, answerQuestion, FALLBACK_TEXT };
})();
