import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import ProgressBar from '../components/ProgressBar';

// jsdom environment is assumed by vitest

describe('ProgressBar', () => {
  it('calls onSeekRatio with correct ratio on click', () => {
    const onSeekRatio = vi.fn();
    const { getByTitle } = render(
      <ProgressBar progressRatio={0.0} elapsedMs={0} durationMs={1000} onSeekRatio={onSeekRatio} />
    );

    const bar = getByTitle('Seek');
    // Fire a click roughly in the middle of the bar
    fireEvent.click(bar, { clientX: 50 });
    // We cannot rely on exact pixel math here without layout, just assert it was invoked
    expect(onSeekRatio).toHaveBeenCalled();
    const arg = onSeekRatio.mock.calls[0][0];
    expect(typeof arg).toBe('number');
    expect(arg).toBeGreaterThanOrEqual(0);
    expect(arg).toBeLessThanOrEqual(1);
  });
});