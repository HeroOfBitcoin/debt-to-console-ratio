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

export interface Country {
  code: CountryCode;
  name: string;
  flag: string;
}

export interface ConsoleReference {
  id: string;
  name: string;
  ratioLabel: string;
  referencePriceUsd: number;
  imagePath: string;
  imageWidth: number;
  imageHeight: number;
}

export const COUNTRIES: readonly Country[] = [
  { code: 'USA', name: 'United States', flag: '🇺🇸' },
  { code: 'CHN', name: 'China', flag: '🇨🇳' },
  { code: 'JPN', name: 'Japan', flag: '🇯🇵' },
  { code: 'DEU', name: 'Germany', flag: '🇩🇪' },
  { code: 'RUS', name: 'Russia', flag: '🇷🇺' },
  { code: 'AUS', name: 'Australia', flag: '🇦🇺' },
  { code: 'IND', name: 'India', flag: '🇮🇳' },
  { code: 'CAN', name: 'Canada', flag: '🇨🇦' },
  { code: 'BRA', name: 'Brazil', flag: '🇧🇷' },
  { code: 'ITA', name: 'Italy', flag: '🇮🇹' },
  { code: 'SLV', name: 'El Salvador', flag: '🇸🇻' },
];

export const CONSOLES: readonly ConsoleReference[] = [
  {
    id: 'game-boy',
    name: 'Game Boy',
    ratioLabel: 'Game Boys',
    referencePriceUsd: 100,
    imagePath: 'images/gameboy.png',
    imageWidth: 184,
    imageHeight: 224,
  },
  {
    id: 'atari-2600',
    name: 'Atari 2600',
    ratioLabel: 'Atari 2600s',
    referencePriceUsd: 100,
    imagePath: 'images/atari2600.png',
    imageWidth: 224,
    imageHeight: 130,
  },
  {
    id: 'nes',
    name: 'NES',
    ratioLabel: 'NES consoles',
    referencePriceUsd: 150,
    imagePath: 'images/nes.png',
    imageWidth: 224,
    imageHeight: 156,
  },
  {
    id: 'snes',
    name: 'SNES',
    ratioLabel: 'SNES consoles',
    referencePriceUsd: 200,
    imagePath: 'images/snes.png',
    imageWidth: 224,
    imageHeight: 116,
  },
  {
    id: 'playstation',
    name: 'PlayStation',
    ratioLabel: 'PlayStations',
    referencePriceUsd: 80,
    imagePath: 'images/playstation.png',
    imageWidth: 224,
    imageHeight: 97,
  },
  {
    id: 'nintendo-64',
    name: 'Nintendo 64',
    ratioLabel: 'Nintendo 64s',
    referencePriceUsd: 300,
    imagePath: 'images/n64.png',
    imageWidth: 224,
    imageHeight: 120,
  },
  {
    id: 'xbox',
    name: 'Xbox',
    ratioLabel: 'Xbox consoles',
    referencePriceUsd: 150,
    imagePath: 'images/xbox.png',
    imageWidth: 224,
    imageHeight: 103,
  },
  {
    id: 'gamecube',
    name: 'GameCube',
    ratioLabel: 'GameCubes',
    referencePriceUsd: 180,
    imagePath: 'images/gamecube.png',
    imageWidth: 224,
    imageHeight: 125,
  },
];

export const MAXIMUM_BITCOIN_SUPPLY = 21_000_000;
