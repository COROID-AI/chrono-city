import { describe, expect, it } from 'vitest';
import { randomFrom } from '../cities/block-study/geometry.js';

describe('randomFrom', () => {
  it('replays the sequence used for scene movement', () => {
    const random = randomFrom(1876);

    expect([random(), random(), random()]).toEqual([
      0.9631163261365145,
      0.4388303547166288,
      0.33225266938097775,
    ]);
  });

  it('keeps each generator at its own position in the sequence', () => {
    const first = randomFrom(1876);
    const second = randomFrom(1876);

    const firstSample = first();
    const nextSample = first();

    expect(second()).toBe(firstSample);
    expect(second()).toBe(nextSample);
  });

  it('produces a different starting value for a different seed', () => {
    expect(randomFrom(558)()).not.toBe(randomFrom(1876)());
  });
});
