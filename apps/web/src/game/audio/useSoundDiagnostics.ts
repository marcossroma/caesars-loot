import { useSyncExternalStore } from 'react';
import { soundManager, type SoundManager } from './SoundManager';

export function useSoundDiagnostics(manager: SoundManager = soundManager) {
  return useSyncExternalStore(manager.subscribe, manager.getSnapshot, manager.getSnapshot);
}
