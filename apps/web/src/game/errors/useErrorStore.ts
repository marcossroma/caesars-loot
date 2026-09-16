import { useSyncExternalStore } from 'react';
import { errorStore, type ErrorStore } from './ErrorStore';

export function useErrorStore(store: ErrorStore = errorStore) {
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
}
