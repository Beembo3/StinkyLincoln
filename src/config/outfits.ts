/**
 * Outfit definitions for the Closet.
 *
 * Each outfit is an overlay drawn on top of the base Lincoln sprite. Maps use the
 * same 16-wide grid as the base sprite (`LINCOLN_MAP`), with '.' meaning transparent
 * so the dog shows through. `yOffset` shifts the map up (negative = above the head),
 * which lets hats/tall items extend past the top of the sprite.
 */
export interface Outfit {
  id: string;
  name: string;
  palette: Record<string, number>;
  /** 16-wide rows. '.' is transparent. */
  map: string[];
  /** Rows to shift up (negative) relative to the base sprite top. */
  yOffset?: number;
}

const NONE: Outfit = { id: 'none', name: 'Natural', palette: {}, map: [] };

const TUXEDO: Outfit = {
  id: 'tuxedo',
  name: 'Tuxedo',
  palette: { T: 0x2b2b33, R: 0xc0392b, W: 0xffffff },
  map: [
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '......RRRR......',
    '..TTTT.WW.TTTT..',
    '..TTTT.WW.TTTT..',
    '..TTTT.WW.TTTT..',
    '..TTTT.WW.TTTT..',
    '................',
  ],
};

const HOODIE: Outfit = {
  id: 'hoodie',
  name: 'Hoodie',
  palette: { H: 0x6b8fbf, S: 0xfff3de, P: 0x4e6d94 },
  map: [
    '................',
    '...HHHHHHHHHH...',
    '..HH........HH..',
    '..HH........HH..',
    '..HH........HH..',
    '................',
    '................',
    '................',
    '................',
    '................',
    '...HHHHHHHHHH...',
    '..HHHHHSSHHHHH..',
    '..HHHHHHHHHHHH..',
    '..HHHHPPPPHHHH..',
    '..HHHHHHHHHHHH..',
    '................',
  ],
};

const RAINCOAT: Outfit = {
  id: 'raincoat',
  name: 'Raincoat',
  palette: { Y: 0xf4c542, B: 0x6b5a2b, D: 0x3f7fb0 },
  map: [
    '................',
    '...YYYYYYYYYY...',
    '..YY........YY..',
    '..YY........YY..',
    '..YY........YY..',
    '................',
    '................',
    '................',
    '................',
    '................',
    '...YYYYYYYYYY...',
    '..YYYYYYYYYYYY..',
    '..YYYYYYYYYYYY..',
    '..YYYYYBBYYYYY..',
    '..YYYYYYYYYYYY..',
    '................',
  ],
};

const COWBOY: Outfit = {
  id: 'cowboy',
  name: 'Cowboy',
  palette: { H: 0x8a5a2b, V: 0xb5482f, S: 0xf4d35e },
  map: [
    '.....HHHHHH.....',
    '..HHHHHHHHHHHH..',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '...VVVVVVVVVV...',
    '..VVVVVSSVVVVV..',
    '..VVVVVVVVVVVV..',
    '..VVVVVVVVVVVV..',
    '................',
  ],
};

const WIZARD: Outfit = {
  id: 'wizard',
  name: 'Wizard',
  palette: { P: 0x7d4fa6, S: 0xf4d35e },
  // 3 rows of hat above the head, then the base 16 rows.
  yOffset: -3,
  map: [
    '.......PP.......',
    '......PPPP......',
    '.....PPPPPP.....',
    '................',
    '....PPPPPPPP....',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '...PPPPPPPPPP...',
    '..PPPPPPPPPPPP..',
    '..PPPPSPPPSPPP..',
    '..PPPPPPPPPPPP..',
    '..PPPPPPPPPPPP..',
    '................',
  ],
};

const HAWAIIAN: Outfit = {
  id: 'hawaiian',
  name: 'Hawaiian',
  palette: { H: 0x2fa39a, F: 0xf26d5c },
  map: [
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '...HHHHHHHHHH...',
    '..HHHHHHHHHHHH..',
    '..HHFHHHHHHFHH..',
    '..HHHHHFHHHHHH..',
    '..HHHHHHHHHHHH..',
    '................',
  ],
};

const SWEATER: Outfit = {
  id: 'sweater',
  name: 'Sweater',
  palette: { R: 0xc0392b, G: 0x4e7d4e },
  map: [
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '....RRRRRRRR....',
    '...RRRRRRRRRR...',
    '..GGGGGGGGGGGG..',
    '..GGGGGGGGGGGG..',
    '..GGGGGGGGGGGG..',
    '..GGGGGGGGGGGG..',
    '..GGGGGGGGGGGG..',
  ],
};

const HERO: Outfit = {
  id: 'hero',
  name: 'Superhero',
  palette: { M: 0x1f3a5f, S: 0x2e6db4, C: 0xc0392b, E: 0xf4d35e },
  map: [
    '................',
    '................',
    '................',
    '................',
    '....M..MM..M....',
    '....M..MM..M....',
    '................',
    '................',
    '................',
    '................',
    '...SSSSSSSSSS...',
    '..CSSSSSSSSSSC..',
    '..CSSSSEESSSSC..',
    '..CSSSSSSSSSSC..',
    '..CSSSSSSSSSSC..',
    '................',
  ],
};

const PAJAMAS: Outfit = {
  id: 'pajamas',
  name: 'Pajamas',
  palette: { P: 0x5b7fb0, S: 0xf4d35e },
  map: [
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '...PPPPPPPPPP...',
    '..PPPPPPPPPPPP..',
    '..PPPSPPPPPSPP..',
    '..PPPPPPPPPPPP..',
    '..PPPPPPPPPPPP..',
    '..PPPPPPPPPPPP..',
  ],
};

const SANTA: Outfit = {
  id: 'santa',
  name: 'Santa',
  palette: { R: 0xc0392b, W: 0xffffff, B: 0x3a2416 },
  map: [
    '......RRRR......',
    '....WWWWWWWW....',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '...RRRRRRRRRR...',
    '..RRRRRRRRRRRR..',
    '..RRRRRRRRRRRR..',
    '..RRRRBBBBRRRR..',
    '..RRRRRRRRRRRR..',
    '................',
  ],
};

const BUNNY: Outfit = {
  id: 'bunny',
  name: 'Bunny',
  palette: { W: 0xffffff, K: 0xf5a3b8, P: 0xf5a3b8 },
  map: [
    '....WW....WW....',
    '....WK....KW....',
    '....WW....WW....',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '...PPPPPPPPPP...',
    '..PPPPPPPPPPPP..',
    '..PPPPPPPPPPPP..',
    '..PPPPPPPPPPPP..',
    '..PPPPPPPPPPPP..',
    '................',
  ],
};

export const OUTFITS: Outfit[] = [
  NONE,
  TUXEDO,
  HOODIE,
  RAINCOAT,
  COWBOY,
  WIZARD,
  HAWAIIAN,
  SWEATER,
  HERO,
  PAJAMAS,
  SANTA,
  BUNNY,
];

export function getOutfit(id: string): Outfit {
  return OUTFITS.find((o) => o.id === id) ?? NONE;
}
