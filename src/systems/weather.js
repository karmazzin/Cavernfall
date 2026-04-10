(() => {
  const Game = window.MC2D;
  const { TILE } = Game.constants;
  const { getLocationInfo } = Game.world;

  const WEATHER = {
    CLEAR: 'clear',
    RAIN: 'rain',
    SNOW: 'snow',
    SANDSTORM: 'sandstorm',
    FOG: 'fog',
    ASHFALL: 'ashfall',
    BLIZZARD: 'blizzard',
    HEAT_HAZE: 'heat_haze',
  };

  function randRange(min, max) {
    return min + Math.random() * (max - min);
  }

  function ensureWeatherState(state) {
    if (!state.weather || typeof state.weather !== 'object') {
      state.weather = {
        type: WEATHER.CLEAR,
        targetType: WEATHER.CLEAR,
        intensity: 0,
        targetIntensity: 0,
        timer: randRange(18, 34),
        contextKey: '',
      };
    }
    if (!Number.isFinite(state.weather.intensity)) state.weather.intensity = 0;
    if (!Number.isFinite(state.weather.targetIntensity)) state.weather.targetIntensity = 0;
    if (!Number.isFinite(state.weather.timer)) state.weather.timer = randRange(18, 34);
    if (!state.weather.type) state.weather.type = WEATHER.CLEAR;
    if (!state.weather.targetType) state.weather.targetType = state.weather.type;
    if (typeof state.weather.contextKey !== 'string') state.weather.contextKey = '';
    return state.weather;
  }

  function contextKey(state, location) {
    return `${state.activeDimension || 'overworld'}:${location.biome}:${location.climate}:${location.inCave ? 1 : 0}`;
  }

  function weatherPool(state, location) {
    if (state.activeDimension === 'fire' || location.biome === 'volcano' || location.biome === 'fire_caves' || location.biome === 'red_land' || location.biome === 'lava_lake') {
      return [
        { type: WEATHER.CLEAR, weight: 0.28, intensity: 0 },
        { type: WEATHER.ASHFALL, weight: 0.34, intensity: randRange(0.45, 0.9) },
        { type: WEATHER.HEAT_HAZE, weight: 0.24, intensity: randRange(0.35, 0.75) },
        { type: WEATHER.FOG, weight: 0.14, intensity: randRange(0.22, 0.55) },
      ];
    }

    if (location.biome === 'desert') {
      return [
        { type: WEATHER.CLEAR, weight: 0.34, intensity: 0 },
        { type: WEATHER.SANDSTORM, weight: 0.36, intensity: randRange(0.45, 0.85) },
        { type: WEATHER.HEAT_HAZE, weight: 0.22, intensity: randRange(0.28, 0.7) },
        { type: WEATHER.FOG, weight: 0.08, intensity: randRange(0.16, 0.4) },
      ];
    }

    if (location.climate === 'cold') {
      return [
        { type: WEATHER.CLEAR, weight: 0.34, intensity: 0 },
        { type: WEATHER.SNOW, weight: 0.34, intensity: randRange(0.35, 0.8) },
        { type: WEATHER.BLIZZARD, weight: 0.16, intensity: randRange(0.55, 0.95) },
        { type: WEATHER.FOG, weight: 0.16, intensity: randRange(0.2, 0.5) },
      ];
    }

    if (location.climate === 'temperate') {
      return [
        { type: WEATHER.CLEAR, weight: 0.42, intensity: 0 },
        { type: WEATHER.RAIN, weight: 0.34, intensity: randRange(0.3, 0.8) },
        { type: WEATHER.FOG, weight: 0.24, intensity: randRange(0.18, 0.48) },
      ];
    }

    if (location.inCave || location.climate === 'any') {
      return [
        { type: WEATHER.CLEAR, weight: 0.72, intensity: 0 },
        { type: WEATHER.FOG, weight: 0.28, intensity: randRange(0.14, 0.38) },
      ];
    }

    return [{ type: WEATHER.CLEAR, weight: 1, intensity: 0 }];
  }

  function isTypeAllowed(state, location, type) {
    return weatherPool(state, location).some((entry) => entry.type === type);
  }

  function pickWeighted(pool) {
    const total = pool.reduce((sum, entry) => sum + entry.weight, 0);
    let roll = Math.random() * total;
    for (const entry of pool) {
      roll -= entry.weight;
      if (roll <= 0) return entry;
    }
    return pool[pool.length - 1];
  }

  function setWeatherTarget(state, location, immediate = false) {
    const weather = ensureWeatherState(state);
    const next = pickWeighted(weatherPool(state, location));
    weather.targetType = next.type;
    weather.targetIntensity = next.intensity;
    weather.timer = randRange(20, 42);
    weather.contextKey = contextKey(state, location);
    if (immediate) {
      weather.type = weather.targetType;
      weather.intensity = weather.targetIntensity;
    }
  }

  function currentLocation(state) {
    const tx = Math.floor((state.player.x + state.player.w / 2) / TILE);
    const ty = Math.floor((state.player.y + state.player.h / 2) / TILE);
    return getLocationInfo(state, tx, ty);
  }

  function updateWeather(state, dt) {
    const weather = ensureWeatherState(state);
    const location = currentLocation(state);
    const key = contextKey(state, location);

    if (!weather.contextKey) setWeatherTarget(state, location, true);
    else if (weather.contextKey !== key && !isTypeAllowed(state, location, weather.targetType)) setWeatherTarget(state, location, true);

    weather.timer -= dt;
    if (weather.timer <= 0) setWeatherTarget(state, location, false);

    if (weather.type !== weather.targetType) {
      weather.intensity = Math.max(0, weather.intensity - dt * 0.85);
      if (weather.intensity <= 0.03) {
        weather.type = weather.targetType;
        weather.intensity = 0;
      }
    } else {
      const diff = weather.targetIntensity - weather.intensity;
      if (Math.abs(diff) < 0.01) weather.intensity = weather.targetIntensity;
      else weather.intensity += Math.sign(diff) * Math.min(Math.abs(diff), dt * 0.45);
    }
  }

  function getWeatherState(state) {
    return ensureWeatherState(state);
  }

  function weatherLabel(type) {
    if (type === WEATHER.RAIN) return 'Дождь';
    if (type === WEATHER.SNOW) return 'Снег';
    if (type === WEATHER.SANDSTORM) return 'Песчаная буря';
    if (type === WEATHER.FOG) return 'Туман';
    if (type === WEATHER.ASHFALL) return 'Пеплопад';
    if (type === WEATHER.BLIZZARD) return 'Метель';
    if (type === WEATHER.HEAT_HAZE) return 'Марево';
    return 'Ясно';
  }

  Game.weatherSystem = {
    WEATHER,
    ensureWeatherState,
    updateWeather,
    getWeatherState,
    weatherLabel,
  };
})();
