(() => {
  const Game = window.MC2D;
  const { DAY, SUNSET, NIGHT, SUNRISE, CYCLE } = Game.constants;

  function phaseInfo(state) {
    const t = state.cycleTime % CYCLE;
    if (t < DAY) return { phase: 'day', darkness: 0 };
    if (t < DAY + SUNSET) return { phase: 'sunset', darkness: ((t - DAY) / SUNSET) * 0.55 };
    if (t < DAY + SUNSET + NIGHT) return { phase: 'night', darkness: 0.55 };

    return {
      phase: 'sunrise',
      darkness: 0.55 - (((t - DAY - SUNSET - NIGHT) / SUNRISE) * 0.55),
    };
  }

  Game.dayCycle = { phaseInfo };
})();
