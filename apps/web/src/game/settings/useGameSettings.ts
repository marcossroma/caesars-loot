import { useSyncExternalStore } from 'react';
import { gameSettingsStore, type GameSettingsStore } from './GameSettingsStore';

export function useGameSettings(store: GameSettingsStore = gameSettingsStore) {
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
}
