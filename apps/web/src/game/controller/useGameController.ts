import { useCallback, useRef, useSyncExternalStore } from 'react';
import type { GameController, GameSessionState } from './GameController';

export function useGameController(controller: GameController) {
  return useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
}

export function shallowEqual<T extends object>(left: T, right: T): boolean {
  const keys = Object.keys(left) as Array<keyof T>;
  if (keys.length !== Object.keys(right).length) return false;
  return keys.every((key) => Object.is(left[key], right[key]));
}

export function useGameControllerSelector<T>(
  controller: GameController,
  selector: (state: GameSessionState) => T,
  isEqual: (left: T, right: T) => boolean = Object.is,
): T {
  const cache = useRef<{ source: GameSessionState; selected: T } | null>(null);
  const getSelectedSnapshot = useCallback(() => {
    const source = controller.getSnapshot();
    if (cache.current?.source === source) return cache.current.selected;
    const selected = selector(source);
    if (cache.current && isEqual(cache.current.selected, selected)) {
      cache.current = { source, selected: cache.current.selected };
      return cache.current.selected;
    }
    cache.current = { source, selected };
    return selected;
  }, [controller, isEqual, selector]);

  return useSyncExternalStore(controller.subscribe, getSelectedSnapshot, getSelectedSnapshot);
}
