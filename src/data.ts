export type CountryCode =
  | 'USA'
  | 'CHN'
  | 'JPN'
  | 'DEU'
  | 'RUS'
  | 'AUS'
  | 'IND'
  | 'CAN'
  | 'BRA'
  | 'ITA'
  | 'SLV';

export interface CachedEstimate {
  debtToGdpPercent: number;
  gdpUsd: number;
}

export interface Country {
  code: CountryCode;
  name: string;
  flag: string;
  cachedEstimate?: CachedEstimate;
}

export interface ConsoleReference {
  id: string;
  name: string;
  referencePriceUsd: number;
  imagePath: string;
}

export const COUNTRIES: readonly Country[] = [
  { code: 'USA', name: 'United States', flag: '🇺🇸' },
  {
    code: 'CHN',
    name: 'China',
    flag: '🇨🇳',
    cachedEstimate: { debtToGdpPercent: 65.5, gdpUsd: 15_000_000_000_000 },
  },
  { code: 'JPN', name: 'Japan', flag: '🇯🇵' },
  {
    code: 'DEU',
    name: 'Germany',
    flag: '🇩🇪',
    cachedEstimate: { debtToGdpPercent: 59.8, gdpUsd: 4_000_000_000_000 },
  },
  {
    code: 'RUS',
    name: 'Russia',
    flag: '🇷🇺',
    cachedEstimate: { debtToGdpPercent: 17.8, gdpUsd: 1_700_000_000_000 },
  },
  {
    code: 'AUS',
    name: 'Australia',
    flag: '🇦🇺',
    cachedEstimate: { debtToGdpPercent: 55.1, gdpUsd: 1_400_000_000_000 },
  },
  {
    code: 'IND',
    name: 'India',
    flag: '🇮🇳',
    cachedEstimate: { debtToGdpPercent: 89.6, gdpUsd: 3_050_000_000_000 },
  },
  {
    code: 'CAN',
    name: 'Canada',
    flag: '🇨🇦',
    cachedEstimate: { debtToGdpPercent: 112.1, gdpUsd: 1_800_000_000_000 },
  },
  {
    code: 'BRA',
    name: 'Brazil',
    flag: '🇧🇷',
    cachedEstimate: { debtToGdpPercent: 98.9, gdpUsd: 2_100_000_000_000 },
  },
  {
    code: 'ITA',
    name: 'Italy',
    flag: '🇮🇹',
    cachedEstimate: { debtToGdpPercent: 154.2, gdpUsd: 2_000_000_000_000 },
  },
  {
    code: 'SLV',
    name: 'El Salvador',
    flag: '🇸🇻',
    cachedEstimate: { debtToGdpPercent: 82.8, gdpUsd: 27_000_000_000 },
  },
];

export const CONSOLES: readonly ConsoleReference[] = [
  {
    id: 'game-boy',
    name: 'Game Boy',
    referencePriceUsd: 100,
    imagePath: 'images/gameboy.png',
  },
  {
    id: 'atari-2600',
    name: 'Atari 2600',
    referencePriceUsd: 100,
    imagePath: 'images/atari2600.png',
  },
  {
    id: 'nes',
    name: 'NES',
    referencePriceUsd: 150,
    imagePath: 'images/nes.png',
  },
  {
    id: 'snes',
    name: 'SNES',
    referencePriceUsd: 200,
    imagePath: 'images/snes.png',
  },
  {
    id: 'playstation',
    name: 'PlayStation',
    referencePriceUsd: 80,
    imagePath: 'images/playstation.png',
  },
  {
    id: 'nintendo-64',
    name: 'Nintendo 64',
    referencePriceUsd: 300,
    imagePath: 'images/n64.png',
  },
  {
    id: 'xbox',
    name: 'Xbox',
    referencePriceUsd: 150,
    imagePath: 'images/xbox.png',
  },
  {
    id: 'gamecube',
    name: 'GameCube',
    referencePriceUsd: 180,
    imagePath: 'images/gamecube.png',
  },
];

export const MAXIMUM_BITCOIN_SUPPLY = 21_000_000;
