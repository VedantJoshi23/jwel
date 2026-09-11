import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAutoHideHeader } from './use-auto-hide-header';

function setScrollY(y: number) {
  Object.defineProperty(window, 'scrollY', { value: y, writable: true, configurable: true });
}

function scrollTo(y: number) {
  act(() => {
    setScrollY(y);
    window.dispatchEvent(new Event('scroll'));
  });
}

function pointerAt(clientY: number) {
  // jsdom has no PointerEvent constructor; MouseEvent carries the same
  // `clientY` the hook reads, and nothing checks the constructor's name.
  act(() => {
    window.dispatchEvent(new MouseEvent('pointermove', { clientY }));
  });
}

describe('useAutoHideHeader', () => {
  beforeEach(() => {
    setScrollY(0);
  });
  afterEach(() => {
    setScrollY(0);
  });

  it('starts revealed', () => {
    const { result } = renderHook(() => useAutoHideHeader());
    expect(result.current).toBe(false);
  });

  it('hides once scrolled down past the reveal zone', () => {
    const { result } = renderHook(() => useAutoHideHeader());
    scrollTo(200);
    scrollTo(260);
    expect(result.current).toBe(true);
  });

  it('reveals again on any upward scroll', () => {
    const { result } = renderHook(() => useAutoHideHeader());
    scrollTo(200);
    scrollTo(260);
    expect(result.current).toBe(true);

    scrollTo(240);
    expect(result.current).toBe(false);
  });

  it('ignores a sub-threshold jitter, so it does not flicker', () => {
    const { result } = renderHook(() => useAutoHideHeader());
    // Enter just past the reveal zone gradually (each step itself under the
    // hide threshold), so the baseline is set without a jump large enough to
    // hide on its own — then the real jitter is the one under test.
    scrollTo(90);
    scrollTo(97);
    expect(result.current).toBe(false);
    scrollTo(100);
    expect(result.current).toBe(false);
  });

  it('stays revealed near the top of the page even while scrolling down', () => {
    const { result } = renderHook(() => useAutoHideHeader());
    scrollTo(40);
    scrollTo(60);
    expect(result.current).toBe(false);
  });

  it('reveals when the pointer nears the top of the viewport — the desktop hover proxy', () => {
    const { result } = renderHook(() => useAutoHideHeader());
    scrollTo(200);
    scrollTo(260);
    expect(result.current).toBe(true);

    pointerAt(10);
    expect(result.current).toBe(false);
  });

  it('hides again once the pointer leaves the top zone and scrolling continues', () => {
    const { result } = renderHook(() => useAutoHideHeader());
    scrollTo(200);
    scrollTo(260);
    pointerAt(10);
    expect(result.current).toBe(false);

    pointerAt(500);
    scrollTo(320);
    scrollTo(380);
    expect(result.current).toBe(true);
  });

  it('reveals on focusin, so a keyboard user is never the one visitor who cannot recall it', () => {
    const { result } = renderHook(() => useAutoHideHeader());
    scrollTo(200);
    scrollTo(260);
    expect(result.current).toBe(true);

    act(() => {
      window.dispatchEvent(new FocusEvent('focusin'));
    });
    expect(result.current).toBe(false);
  });
});
