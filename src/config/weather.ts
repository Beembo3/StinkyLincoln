export type WeatherId = 'sunny' | 'rainy' | 'muddy';

export interface WeatherInfo {
  id: WeatherId;
  name: string;
  icon: string;
  blurb: string;
  /** Multiplier on cleanliness decay — bad weather makes him filthier faster. */
  cleanlinessDecay: number;
  /** Multiplier on mess added by actions (muddy paws everywhere). */
  messGain: number;
}

export const WEATHER: Record<WeatherId, WeatherInfo> = {
  sunny: {
    id: 'sunny',
    name: 'Sunny',
    icon: '☀️',
    blurb: 'A lovely day for a walk… and a roll in the grass.',
    cleanlinessDecay: 1,
    messGain: 1,
  },
  rainy: {
    id: 'rainy',
    name: 'Rainy',
    icon: '🌧️',
    blurb: 'Wet paws, wet dog, wet everything.',
    cleanlinessDecay: 1.7,
    messGain: 1.6,
  },
  muddy: {
    id: 'muddy',
    name: 'Muddy',
    icon: '🟤',
    blurb: 'The garden is a swamp. Lincoln is delighted.',
    cleanlinessDecay: 2.3,
    messGain: 2.3,
  },
};

// Sunny is most likely; weather re-rolls each new day.
const WEATHER_TABLE: WeatherId[] = ['sunny', 'sunny', 'sunny', 'rainy', 'muddy'];

export function rollWeather(): WeatherId {
  return WEATHER_TABLE[Math.floor(Math.random() * WEATHER_TABLE.length)] ?? 'sunny';
}

export function weatherInfo(id: string): WeatherInfo {
  return WEATHER[id as WeatherId] ?? WEATHER.sunny;
}
