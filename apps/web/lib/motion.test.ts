import { describe, expect, it } from 'vitest';
import { crossFade, project, rubberband, springs } from './motion';

describe('springs', () => {
  it('defaults to critically damped — no overshoot', () => {
    // design-update.md §4: overshoot on something the interface initiated
    // feels wrong; bounce is earned by a gesture, not granted by default.
    expect(springs.ui.bounce).toBe(0);
  });

  it('reserves bounce for momentum-driven motion', () => {
    expect(springs.momentum.bounce).toBeGreaterThan(0);
    expect(springs.sheet.bounce).toBeGreaterThan(0);
  });

  it('gives the sheet a snappier response than the general UI spring', () => {
    expect(springs.sheet.duration).toBeLessThan(springs.ui.duration);
  });
});

describe('project', () => {
  it('returns zero for a release with no velocity', () => {
    expect(project(0)).toBe(0);
  });

  it('projects further the faster the flick', () => {
    expect(project(2000)).toBeGreaterThan(project(500));
  });

  it('mirrors direction for a negative velocity', () => {
    expect(project(-800)).toBeCloseTo(-project(800), 10);
  });

  it('projects less far with a snappier deceleration rate', () => {
    // 0.99 is the snappier setting; it should come to rest sooner than 0.998.
    expect(project(1000, 0.99)).toBeLessThan(project(1000, 0.998));
  });

  it('uses exponential decay, not the v²/(2·decel) textbook form', () => {
    // (v/1000)·d/(1−d) with v=1000, d=0.998  →  1 · 0.998/0.002 = 499
    // The textbook form would give a wildly different number here, and it is
    // not what Apple ships — it feels wrong. Pinning the exact value is the
    // only way that substitution gets caught.
    expect(project(1000, 0.998)).toBeCloseTo(499, 6);
  });
});

describe('rubberband', () => {
  it('does not resist at the boundary itself', () => {
    expect(rubberband(0, 800)).toBe(0);
  });

  it('follows the pointer less and less the further past the bound it goes', () => {
    // The point of §9: resistance is progressive, so each extra pixel of drag
    // buys strictly less movement than the one before it.
    const first = rubberband(50, 800) - rubberband(0, 800);
    const later = rubberband(300, 800) - rubberband(250, 800);
    expect(later).toBeLessThan(first);
  });

  it('always moves less than the raw overshoot — it resists, it does not amplify', () => {
    for (const overshoot of [10, 100, 500, 2000]) {
      expect(rubberband(overshoot, 800)).toBeLessThan(overshoot);
    }
  });

  it('resists symmetrically in the negative direction', () => {
    expect(rubberband(-120, 800)).toBeCloseTo(-rubberband(120, 800), 10);
  });
});

describe('crossFade', () => {
  it('is short and non-vestibular — the reduced-motion substitute', () => {
    expect(crossFade.duration).toBeLessThanOrEqual(0.25);
  });
});
