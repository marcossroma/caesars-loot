// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AppErrorBoundary } from './AppErrorBoundary';

function BrokenView(): never {
  throw new Error('synthetic render failure');
}

describe('AppErrorBoundary', () => {
  it('contains render failures and exposes a recovery action', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    render(
      <AppErrorBoundary>
        <BrokenView />
      </AppErrorBoundary>,
    );
    expect(screen.getByRole('alert').textContent).toContain('THE HEIST HIT A SNAG');
    expect(screen.getByRole('button', { name: 'RESTART GAME' })).toBeTruthy();
    consoleError.mockRestore();
  });
});
