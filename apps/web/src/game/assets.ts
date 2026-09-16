export const BACKGROUND_ASSET = {
  alias: 'roman-treasury-background',
  src: '/assets/backgrounds/roman-treasury.webp',
} as const;

export type CharacterAssetKey = 'idle' | 'happy' | 'scared' | 'celebrate';

// Sources intentionally remain null until isolated production art is delivered. Keeping the
// manifest explicit lets the loader preload critical states without issuing known-bad requests.
export const CHARACTER_ASSETS: ReadonlyArray<{
  state: CharacterAssetKey;
  src: string | null;
  preload: true;
}> = [
  { state: 'idle', src: null, preload: true },
  { state: 'happy', src: null, preload: true },
  { state: 'scared', src: null, preload: true },
  { state: 'celebrate', src: null, preload: true },
];

export const ESSENTIAL_ASSETS = [BACKGROUND_ASSET, ...CHARACTER_ASSETS] as const;
