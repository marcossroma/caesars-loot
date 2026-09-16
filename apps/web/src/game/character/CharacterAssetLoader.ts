import { Assets, type Texture } from 'pixi.js';
import { CHARACTER_ASSETS, type CharacterAssetKey } from '../assets';
import { devLogger } from '../logging/devLogger';

export type CharacterTextures = Partial<Record<CharacterAssetKey, Texture>>;

export interface LoadedCharacterAssets {
  textures: CharacterTextures;
  loadedSources: string[];
  fallbackActive: boolean;
}

export async function loadCharacterAssets(): Promise<LoadedCharacterAssets> {
  const textures: CharacterTextures = {};
  const loadedSources: string[] = [];

  for (const asset of CHARACTER_ASSETS) {
    if (!asset.src) continue;
    try {
      textures[asset.state] = await Assets.load<Texture>(asset.src);
      loadedSources.push(asset.src);
    } catch (error) {
      if (import.meta.env.DEV) {
        devLogger.warn(`Character asset "${asset.state}" is unavailable; using fallback.`, error);
      }
    }
  }

  const fallbackActive = Object.keys(textures).length === 0;
  if (fallbackActive && import.meta.env.DEV) {
    devLogger.warn(
      'No isolated Caesar monkey sprites were found. The reusable PixiJS fallback is active.',
    );
  }

  return { textures, loadedSources, fallbackActive };
}
