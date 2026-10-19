/**
 * Era definitions for Chrono City.
 *
 * Everything that changes when the timeline slider moves lives here: palette,
 * architecture, storefront copy, advertising, traffic, crowds and the audio
 * bed. The scene modules read this data and build geometry procedurally, so no
 * external asset is ever fetched at runtime.
 */

export const ERA_YEARS = [1945, 1965, 1985, 2005, 2025] as const;

export type EraYear = (typeof ERA_YEARS)[number];

export type ArchitectureStyle = 'brick' | 'stucco' | 'concrete' | 'glass' | 'green';
export type RoofDetail = 'watertower' | 'neon-crown' | 'dishes' | 'hvac' | 'solar';
export type VehicleKind = 'round-sedan' | 'tailfin' | 'boxy' | 'suv' | 'ev';
export type LampStyle = 'cast-iron' | 'gooseneck' | 'sodium' | 'halide' | 'led';
export type SignalStyle = 'manual' | 'sixties' | 'neon' | 'digital' | 'smart';
export type BillboardStyle = 'paper' | 'painted' | 'neon' | 'digital';

export interface EraPalette {
  /** Sky gradient, top to horizon. */
  skyTop: string;
  skyHorizon: string;
  skyBottom: string;
  /** Fog colour and exponential density. */
  fog: string;
  fogDensity: number;
  sun: string;
  sunIntensity: number;
  sunPosition: [number, number, number];
  ambient: string;
  ambientIntensity: number;
  /** Ground bounce colour for the hemisphere light. */
  bounce: string;
  /** Neon / sodium accent light colour and strength (0 disables the point light). */
  accent: string;
  accentIntensity: number;
  /** 0 = broad daylight, 1 = full night. Drives lit windows and lamp glow. */
  night: number;
  exposure: number;
  /** Whether the era reads as "lit" enough to draw lamp/headlight glows. */
  glow: number;
}

export interface ArchitectureSpec {
  style: ArchitectureStyle;
  /** Facade tints, picked per building. */
  walls: string[];
  trim: string;
  /** Ground-floor shopfront frames. */
  storefront: string;
  /** Awning stripe colours (two per set). */
  awnings: [string, string][];
  floors: [number, number];
  /** Number of buildings in the block. */
  blockCount: number;
  roof: RoofDetail;
  /** Era-specific rooftop accent (neon trim, dishes, panels...). */
  roofTint: string;
  /** Font stack for hand-painted / printed shop signs. */
  signFont: string;
  signColors: [string, string][];
  /** Window glow tint for lit interiors. */
  windowGlow: string;
  /** Glass reflections / curtain-wall era. */
  curtainWall: boolean;
  fireEscapes: boolean;
}

export interface StorefrontSpec {
  name: string;
  kind: 'shop' | 'cafe' | 'service' | 'entertainment' | 'office';
}

export interface BillboardSpec {
  lines: string[];
  footer: string;
  style: BillboardStyle;
  background: string;
  foreground: string;
  accent: string;
}

export interface VehicleSpec {
  kind: VehicleKind;
  count: number;
  parked: number;
  speed: number;
  colors: string[];
  accent: string;
  headlights: 'round' | 'square' | 'strip';
  /** Body height modifier so silhouettes differ between eras. */
  stance: number;
}

export interface OutfitPalette {
  top: string[];
  bottom: string[];
  skin: string[];
  hair: string[];
  hat?: string;
  accent: string[];
}

export interface PedestrianSpec {
  count: number;
  speed: number;
  outfits: OutfitPalette;
  hats: 'fedora' | 'brimmed' | 'none' | 'cap' | 'beanie';
  accessories: ('bag' | 'briefcase' | 'phone' | 'backpack' | 'umbrella' | 'coffee')[];
}

export interface StreetSpec {
  lamp: LampStyle;
  signal: SignalStyle;
  overheadWires: boolean;
  road: string;
  sidewalk: string;
  curb: string;
  lane: string;
  props: ('newsstand' | 'hydrant' | 'bench' | 'trash' | 'phone-booth' | 'bus-shelter' | 'bike-rack' | 'charger' | 'scooter' | 'atm')[];
  /** Lamp head colour. */
  lampColor: string;
}

export interface AudioSpec {
  /** Low traffic rumble cutoff. */
  rumble: number;
  /** Ambient hum frequency. */
  hum: number;
  /** Pad chord for the era bed (Hz). */
  pad: number[];
  /** Noise level of the crowd layer. */
  crowd: number;
}

export interface EraDefinition {
  year: EraYear;
  /** Short nickname, e.g. "Postwar Austerity". */
  name: string;
  /** One-line mood used in the HUD. */
  mood: string;
  /** Paragraph in the info panel — intentionally narrative, era-specific. */
  description: string;
  palette: EraPalette;
  architecture: ArchitectureSpec;
  storefronts: StorefrontSpec[];
  billboard: BillboardSpec;
  vehicles: VehicleSpec;
  pedestrians: PedestrianSpec;
  street: StreetSpec;
  audio: AudioSpec;
}

const SHARED_SKIN = ['#e8c39e', '#d9a97c', '#b9805a', '#8d5a3b', '#f0d3b4'];
const SHARED_HAIR = ['#2b2119', '#4a3326', '#7a5a3a', '#a8a29a', '#1c1a19'];

export const ERAS: Record<EraYear, EraDefinition> = {
  1945: {
    year: 1945,
    name: 'Postwar Austerity',
    mood: 'Smoky dusk · victory banners · ration books',
    description:
      'Postwar Austerity — brick walk-ups and hand-painted shop signs line a street still dressed in victory banners. Olive-drab sedans roll past wool coats and fedoras while coal smoke curls into a sepia dusk.',
    palette: {
      skyTop: '#4a5f72',
      skyHorizon: '#d9a86b',
      skyBottom: '#2b241e',
      fog: '#b08a63',
      fogDensity: 0.0125,
      sun: '#ffd2a1',
      sunIntensity: 1.65,
      sunPosition: [-48, 34, 22],
      ambient: '#7c6a58',
      ambientIntensity: 0.78,
      bounce: '#5a4030',
      accent: '#ffb46b',
      accentIntensity: 0.55,
      night: 0.32,
      exposure: 1.02,
      glow: 0.55,
    },
    architecture: {
      style: 'brick',
      walls: ['#8d5b45', '#7a4a3a', '#9c6b50', '#6f5142', '#a8826a'],
      trim: '#e6dcc8',
      storefront: '#3a2b22',
      awnings: [
        ['#7a2f2a', '#e6dcc8'],
        ['#2f4a3b', '#e6dcc8'],
        ['#c8b28a', '#7a2f2a'],
      ],
      floors: [3, 6],
      blockCount: 10,
      roof: 'watertower',
      roofTint: '#5c4636',
      signFont: 'Georgia, "Times New Roman", serif',
      signColors: [
        ['#e8dcc0', '#3b2a1e'],
        ['#3b2a1e', '#e8dcc0'],
        ['#8f2f24', '#f5e7c8'],
      ],
      windowGlow: '#ffd49a',
      curtainWall: false,
      fireEscapes: true,
    },
    storefronts: [
      { name: 'VICTORY CAFE', kind: 'cafe' },
      { name: 'M. KOWALSKI · TAILOR', kind: 'shop' },
      { name: 'RADIO REPAIR', kind: 'service' },
      { name: 'CORNER MARKET', kind: 'shop' },
      { name: 'PARAMOUNT', kind: 'entertainment' },
      { name: 'BUY WAR BONDS', kind: 'service' },
      { name: 'FIVE & DIME', kind: 'shop' },
      { name: 'SHOE REPAIR', kind: 'service' },
      { name: 'CITY SAVINGS BANK', kind: 'office' },
      { name: 'LUNCH COUNTER', kind: 'cafe' },
      { name: 'COAL & ICE', kind: 'service' },
      { name: 'BARBER SHOP', kind: 'service' },
    ],
    billboard: {
      lines: ['BUY', 'WAR BONDS'],
      footer: 'INVEST IN VICTORY · 1945',
      style: 'paper',
      background: '#e8dcc0',
      foreground: '#3b2a1e',
      accent: '#9d2b21',
    },
    vehicles: {
      kind: 'round-sedan',
      count: 5,
      parked: 2,
      speed: 5.4,
      colors: ['#3f4a3a', '#5b4a3a', '#2e3230', '#6b6255', '#1f2622'],
      accent: '#c8b48a',
      headlights: 'round',
      stance: 1,
    },
    pedestrians: {
      count: 10,
      speed: 1.05,
      outfits: {
        top: ['#4a4136', '#5a4a3a', '#3a3f3a', '#6d5a44', '#2f3338'],
        bottom: ['#35312b', '#42403a', '#2b2e30'],
        skin: SHARED_SKIN,
        hair: SHARED_HAIR,
        hat: '#3a3129',
        accent: ['#7a2f2a', '#c8b28a'],
      },
      hats: 'fedora',
      accessories: ['bag', 'briefcase', 'umbrella'],
    },
    street: {
      lamp: 'cast-iron',
      signal: 'manual',
      overheadWires: true,
      road: '#3b3a37',
      sidewalk: '#8c857a',
      curb: '#b4ac9d',
      lane: '#d9cfae',
      props: ['newsstand', 'hydrant', 'bench', 'trash'],
      lampColor: '#ffcf8a',
    },
    audio: { rumble: 240, hum: 52, pad: [110, 164.81, 196], crowd: 0.055 },
  },

  1965: {
    year: 1965,
    name: 'Jet-Age Boom',
    mood: 'Bright noon · chrome tailfins · googie neon',
    description:
      'Jet-Age Boom — pastel stucco and chrome tailfins, googie diners and a bowling alley under a hard blue sky. Tailored suits, shift dresses and bouffants cross the street while a new TV & hi-fi shop blares from the corner.',
    palette: {
      skyTop: '#3f80c4',
      skyHorizon: '#d3eaf3',
      skyBottom: '#9fc3cf',
      fog: '#cfe0e8',
      fogDensity: 0.0062,
      sun: '#fff4d6',
      sunIntensity: 2.05,
      sunPosition: [40, 62, 28],
      ambient: '#bcd6e8',
      ambientIntensity: 0.82,
      bounce: '#b8a98d',
      accent: '#ff8a5c',
      accentIntensity: 0.25,
      night: 0.06,
      exposure: 1.05,
      glow: 0.15,
    },
    architecture: {
      style: 'stucco',
      walls: ['#e6d2b5', '#b9d5cf', '#d9c6d8', '#f0e2c2', '#c9dfe6'],
      trim: '#f7f3e8',
      storefront: '#1f5f7a',
      awnings: [
        ['#c0392b', '#f5f1e6'],
        ['#2f6f8f', '#f5f1e6'],
        ['#e0a13a', '#f5f1e6'],
      ],
      floors: [3, 9],
      blockCount: 11,
      roof: 'neon-crown',
      roofTint: '#ef7f3a',
      signFont: '"Trebuchet MS", "Gill Sans", sans-serif',
      signColors: [
        ['#f5f1e6', '#1f5f7a'],
        ['#1f5f7a', '#f5f1e6'],
        ['#c0392b', '#fdf3dd'],
      ],
      windowGlow: '#ffe1a8',
      curtainWall: false,
      fireEscapes: true,
    },
    storefronts: [
      { name: 'STARLITE DINER', kind: 'cafe' },
      { name: 'ATOMIC MOTORS', kind: 'shop' },
      { name: 'TV & HI-FI', kind: 'entertainment' },
      { name: 'STAR BOWLING LANES', kind: 'entertainment' },
      { name: 'JET CLEANERS', kind: 'service' },
      { name: 'GALAXY DRUGS', kind: 'shop' },
      { name: 'MOTOR INN', kind: 'service' },
      { name: 'BEAUTY SALON', kind: 'service' },
      { name: 'TRAVEL BUREAU', kind: 'office' },
      { name: 'ROCKET RECORDS', kind: 'entertainment' },
      { name: 'SUPERMARKET', kind: 'shop' },
      { name: 'DENTIST', kind: 'office' },
    ],
    billboard: {
      lines: ['FLY THE', 'JET AGE'],
      footer: 'PAN AM TO THE FUTURE',
      style: 'painted',
      background: '#f2e3c8',
      foreground: '#1f4f78',
      accent: '#c0392b',
    },
    vehicles: {
      kind: 'tailfin',
      count: 6,
      parked: 2,
      speed: 6.6,
      colors: ['#e8e2d2', '#8fb8c9', '#c94b3c', '#3f6f5a', '#e0a13a'],
      accent: '#f2efe6',
      headlights: 'round',
      stance: 0.92,
    },
    pedestrians: {
      count: 12,
      speed: 1.15,
      outfits: {
        top: ['#efe6d2', '#8fb8c9', '#d9a0a8', '#5a7f6a', '#e0b04a'],
        bottom: ['#2f3a44', '#5a4a3a', '#4b5a6a'],
        skin: SHARED_SKIN,
        hair: SHARED_HAIR,
        accent: ['#c0392b', '#f0e6d2'],
      },
      hats: 'brimmed',
      accessories: ['bag', 'briefcase'],
    },
    street: {
      lamp: 'gooseneck',
      signal: 'sixties',
      overheadWires: false,
      road: '#41403c',
      sidewalk: '#b9b0a0',
      curb: '#d6cebd',
      lane: '#f0e6c8',
      props: ['phone-booth', 'bench', 'trash', 'bus-shelter'],
      lampColor: '#fff0bd',
    },
    audio: { rumble: 320, hum: 65.41, pad: [130.81, 196, 246.94], crowd: 0.07 },
  },

  1985: {
    year: 1985,
    name: 'Neon Dusk',
    mood: 'Rain-slick night · video arcade glow · chrome pylons',
    description:
      'Neon Dusk — concrete towers crowd a street of arcade neon, video rentals and boxy hatchbacks. Leather jackets and big hair catch magenta and cyan light while sodium lamps smear across wet asphalt.',
    palette: {
      skyTop: '#070b1c',
      skyHorizon: '#2b2a5e',
      skyBottom: '#05060f',
      fog: '#191a3a',
      fogDensity: 0.0135,
      sun: '#8a7bff',
      sunIntensity: 0.65,
      sunPosition: [-28, 48, -36],
      ambient: '#2a2f55',
      ambientIntensity: 1.15,
      bounce: '#241a33',
      accent: '#ff2fa0',
      accentIntensity: 2.4,
      night: 1,
      exposure: 1.12,
      glow: 1,
    },
    architecture: {
      style: 'concrete',
      walls: ['#3a3f4a', '#4b4a56', '#2e3440', '#565064'],
      trim: '#8a8f9c',
      storefront: '#16161f',
      awnings: [
        ['#ff2fa0', '#141420'],
        ['#39e6ff', '#141420'],
        ['#ffd23f', '#141420'],
      ],
      floors: [5, 14],
      blockCount: 12,
      roof: 'dishes',
      roofTint: '#39e6ff',
      signFont: '"Arial Black", Impact, sans-serif',
      signColors: [
        ['#120a24', '#ff5ec4'],
        ['#0b1620', '#39e6ff'],
        ['#1a1206', '#ffd23f'],
      ],
      windowGlow: '#9fdcff',
      curtainWall: false,
      fireEscapes: true,
    },
    storefronts: [
      { name: 'VIDEO WORLD 24HR', kind: 'entertainment' },
      { name: 'GALAXY ARCADE', kind: 'entertainment' },
      { name: 'PIZZA EXPRESS', kind: 'cafe' },
      { name: 'HI-FI STEREO', kind: 'shop' },
      { name: 'TANNING CLUB', kind: 'service' },
      { name: 'NEON NIGHTS', kind: 'entertainment' },
      { name: 'ROBOT REPAIR', kind: 'service' },
      { name: 'CASSETTE CITY', kind: 'shop' },
      { name: 'CHROME GYM', kind: 'service' },
      { name: 'BURGER PALACE', kind: 'cafe' },
      { name: 'PHONE MART', kind: 'shop' },
      { name: 'SUNSET MOTEL', kind: 'service' },
    ],
    billboard: {
      lines: ['NEON', 'NIGHTS'],
      footer: 'MIDNIGHT MATINEE · CHANNEL 5',
      style: 'neon',
      background: '#120a24',
      foreground: '#ff5ec4',
      accent: '#39e6ff',
    },
    vehicles: {
      kind: 'boxy',
      count: 7,
      parked: 2,
      speed: 7.2,
      colors: ['#1b1c22', '#b4b8c0', '#8a1f2e', '#283a4a', '#d8d2c0'],
      accent: '#39e6ff',
      headlights: 'square',
      stance: 0.9,
    },
    pedestrians: {
      count: 13,
      speed: 1.25,
      outfits: {
        top: ['#1b1c22', '#8a1f4a', '#2f5a8a', '#c94b8a', '#e0d8c8'],
        bottom: ['#2a2f45', '#1b1c22', '#4a4a5a'],
        skin: SHARED_SKIN,
        hair: ['#1c1a19', '#5a3a2a', '#b07ac9', '#2a2f45'],
        accent: ['#39e6ff', '#ff2fa0'],
      },
      hats: 'none',
      accessories: ['bag', 'phone'],
    },
    street: {
      lamp: 'sodium',
      signal: 'neon',
      overheadWires: true,
      road: '#232326',
      sidewalk: '#6a6a72',
      curb: '#86868f',
      lane: '#e8d26a',
      props: ['phone-booth', 'trash', 'bus-shelter', 'atm'],
      lampColor: '#ffb347',
    },
    audio: { rumble: 420, hum: 49, pad: [98, 146.83, 220], crowd: 0.085 },
  },

  2005: {
    year: 2005,
    name: 'Internet Age',
    mood: 'Blue-hour overcast · dot-com billboards · flip phones',
    description:
      'Internet Age — glass and steel infill rises behind internet cafés, phone shops and DVD rentals. Crossovers idle at the lights, hoodies and flip phones are everywhere, and a giant dot-com billboard flickers over the block.',
    palette: {
      skyTop: '#33495f',
      skyHorizon: '#a9bfd0',
      skyBottom: '#1a2028',
      fog: '#8a9aab',
      fogDensity: 0.0085,
      sun: '#d9e6f2',
      sunIntensity: 0.95,
      sunPosition: [26, 52, 34],
      ambient: '#7f93a8',
      ambientIntensity: 0.9,
      bounce: '#5a5f66',
      accent: '#38a1ff',
      accentIntensity: 0.8,
      night: 0.28,
      exposure: 1,
      glow: 0.5,
    },
    architecture: {
      style: 'glass',
      walls: ['#7f8f9e', '#9aa7b0', '#5f6c78', '#b7c0c6', '#8d9aa4'],
      trim: '#d7dee3',
      storefront: '#2b343c',
      awnings: [
        ['#1f6fd8', '#e8eef3'],
        ['#3a3f45', '#e8eef3'],
        ['#d8d2c6', '#1f6fd8'],
      ],
      floors: [6, 16],
      blockCount: 12,
      roof: 'hvac',
      roofTint: '#9aa7b0',
      signFont: '"Helvetica Neue", Arial, sans-serif',
      signColors: [
        ['#f4f7fa', '#1f6fd8'],
        ['#1f6fd8', '#f4f7fa'],
        ['#22262b', '#f4f7fa'],
      ],
      windowGlow: '#cfe6ff',
      curtainWall: true,
      fireEscapes: false,
    },
    storefronts: [
      { name: 'INTERNET CAFE', kind: 'cafe' },
      { name: 'MOBILE PHONES', kind: 'shop' },
      { name: 'DVD RENTAL', kind: 'entertainment' },
      { name: 'COFFEE CO.', kind: 'cafe' },
      { name: 'SOLUTIONS INC.', kind: 'office' },
      { name: 'WEB DESIGN', kind: 'office' },
      { name: 'SUSHI BAR', kind: 'cafe' },
      { name: 'PRINT & COPY', kind: 'service' },
      { name: 'FITNESS CLUB', kind: 'service' },
      { name: 'REALTY GROUP', kind: 'office' },
      { name: 'GAME STORE', kind: 'entertainment' },
      { name: 'DRY CLEANERS', kind: 'service' },
    ],
    billboard: {
      lines: ['EVERYTHING', '.COM'],
      footer: 'BROADBAND · 8 MBPS',
      style: 'digital',
      background: '#f4f7fa',
      foreground: '#1f6fd8',
      accent: '#ff5a3c',
    },
    vehicles: {
      kind: 'suv',
      count: 7,
      parked: 3,
      speed: 7.5,
      colors: ['#b9c0c6', '#2b3440', '#6b7783', '#8f2f2f', '#e2e6e8'],
      accent: '#dfe6ea',
      headlights: 'square',
      stance: 1.06,
    },
    pedestrians: {
      count: 14,
      speed: 1.3,
      outfits: {
        top: ['#2b3440', '#6b7783', '#b9c0c6', '#8f2f2f', '#3f6f5a'],
        bottom: ['#3a4a6a', '#2a2f35', '#6b6a63'],
        skin: SHARED_SKIN,
        hair: SHARED_HAIR,
        accent: ['#1f6fd8', '#e2e6e8'],
      },
      hats: 'cap',
      accessories: ['bag', 'phone', 'coffee'],
    },
    street: {
      lamp: 'halide',
      signal: 'digital',
      overheadWires: true,
      road: '#34383c',
      sidewalk: '#9a9a98',
      curb: '#b8b8b4',
      lane: '#f2f2ee',
      props: ['bike-rack', 'trash', 'bus-shelter', 'atm', 'hydrant'],
      lampColor: '#e8f2ff',
    },
    audio: { rumble: 520, hum: 61.74, pad: [146.83, 220, 293.66], crowd: 0.095 },
  },

  2025: {
    year: 2025,
    name: 'The Living City',
    mood: 'Golden sunset · timber-and-glass towers · silent EVs',
    description:
      'The Living City — timber-and-glass towers with green roofs, plant shops and e-bike hubs replace the old signscape. Silent EVs glide past athleisure crowds, solar canopies catch the last gold light and every lamp is an LED.',
    palette: {
      skyTop: '#2f6396',
      skyHorizon: '#ffb36b',
      skyBottom: '#243444',
      fog: '#e0a878',
      fogDensity: 0.0055,
      sun: '#ffd0a0',
      sunIntensity: 2.2,
      sunPosition: [46, 30, -18],
      ambient: '#9ab4c8',
      ambientIntensity: 1.1,
      bounce: '#6b7a5f',
      accent: '#4ff0c8',
      accentIntensity: 0.9,
      night: 0.22,
      exposure: 1.06,
      glow: 0.45,
    },
    architecture: {
      style: 'green',
      walls: ['#c9c2b4', '#a8b8a4', '#8fb4a0', '#d9d2c4', '#b4c8c0'],
      trim: '#f2efe6',
      storefront: '#2f3a34',
      awnings: [
        ['#2f6f5a', '#f2efe6'],
        ['#d98a3a', '#f2efe6'],
        ['#4ff0c8', '#1e2a26'],
      ],
      floors: [7, 18],
      blockCount: 13,
      roof: 'solar',
      roofTint: '#3f6f8a',
      signFont: '"Segoe UI", "Helvetica Neue", sans-serif',
      signColors: [
        ['#0e1b24', '#6ef7df'],
        ['#f2efe6', '#1e2a26'],
        ['#1e2a26', '#ffd166'],
      ],
      windowGlow: '#bfe9ff',
      curtainWall: true,
      fireEscapes: false,
    },
    storefronts: [
      { name: 'PLANT & POUR', kind: 'cafe' },
      { name: 'ZERO WASTE', kind: 'shop' },
      { name: 'E-BIKE HUB', kind: 'service' },
      { name: 'CLOUD KITCHEN', kind: 'cafe' },
      { name: 'STUDIO 25', kind: 'office' },
      { name: 'SOLAR WORKS', kind: 'service' },
      { name: 'OAT BAR', kind: 'cafe' },
      { name: 'REPAIR CAFÉ', kind: 'service' },
      { name: 'GREEN ROOF CO.', kind: 'office' },
      { name: 'DELIVERY HUB', kind: 'service' },
      { name: 'PILATES LAB', kind: 'service' },
      { name: 'BOOKS & PLANTS', kind: 'shop' },
      { name: 'NIGHT MARKET', kind: 'shop' },
    ],
    billboard: {
      lines: ['STREAM', 'EVERYWHERE'],
      footer: '12K · ZERO LATENCY · SOLAR',
      style: 'digital',
      background: '#0e1b24',
      foreground: '#6ef7df',
      accent: '#ffd166',
    },
    vehicles: {
      kind: 'ev',
      count: 8,
      parked: 3,
      speed: 7,
      colors: ['#e8e6e0', '#2f3a44', '#6b8f86', '#c9c2b4', '#1e2a26'],
      accent: '#6ef7df',
      headlights: 'strip',
      stance: 1.02,
    },
    pedestrians: {
      count: 16,
      speed: 1.35,
      outfits: {
        top: ['#2f3a34', '#c9c2b4', '#6b8f86', '#d98a3a', '#e8e6e0'],
        bottom: ['#1e2a26', '#3a4a44', '#8a8f88'],
        skin: SHARED_SKIN,
        hair: SHARED_HAIR,
        accent: ['#4ff0c8', '#ffd166'],
      },
      hats: 'beanie',
      accessories: ['bag', 'phone', 'coffee', 'backpack'],
    },
    street: {
      lamp: 'led',
      signal: 'smart',
      overheadWires: false,
      road: '#2c3033',
      sidewalk: '#b4b2a8',
      curb: '#d2d0c4',
      lane: '#f4f2e8',
      props: ['bike-rack', 'charger', 'trash', 'bus-shelter', 'scooter', 'bench'],
      lampColor: '#dff6ff',
    },
    audio: { rumble: 480, hum: 73.42, pad: [164.81, 246.94, 329.63], crowd: 0.075 },
  },
};

/** Era order used by the timeline. */
export const ERA_LIST: EraDefinition[] = ERA_YEARS.map((year) => ERAS[year]);

/** Resolve an era index (0-4) to a year. */
export function yearAt(index: number): EraYear {
  const clamped = Math.min(ERA_YEARS.length - 1, Math.max(0, Math.round(index)));
  return ERA_YEARS[clamped];
}

/** Resolve a year to its timeline index. */
export function indexOfYear(year: EraYear): number {
  return ERA_YEARS.indexOf(year);
}

/** Neighbouring era, clamped at both ends. */
export function stepEra(year: EraYear, delta: number): EraYear {
  return yearAt(indexOfYear(year) + delta);
}
