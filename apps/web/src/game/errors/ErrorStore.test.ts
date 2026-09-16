import { describe, expect, it } from 'vitest';
import { createAppError } from './AppError';
import { ErrorStore } from './ErrorStore';

describe('ErrorStore', () => {
  it('deduplicates visible notices and bounds its diagnostic log', () => {
    const store = new ErrorStore();
    for (let index = 0; index < 24; index += 1) {
      store.push(createAppError(`E${index}`, 'Failure', 'UNKNOWN', 'restart', 'test'));
    }
    expect(store.getSnapshot().toasts).toHaveLength(3);
    expect(store.getSnapshot().log).toHaveLength(20);
    const duplicate = createAppError('E23', 'Updated', 'UNKNOWN', 'restart', 'test');
    store.push(duplicate);
    expect(store.getSnapshot().toasts).toHaveLength(3);
    expect(store.getSnapshot().toasts.at(-1)?.message).toBe('Updated');
  });
});
