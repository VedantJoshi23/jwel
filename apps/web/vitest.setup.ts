import '@testing-library/jest-dom/vitest';

// jsdom has no ResizeObserver. Radix's Checkbox always renders a hidden
// bubble `<input>` for native form association, and sizing it calls
// ResizeObserver during the initial layout effect — every Checkbox render
// crashed outright in tests until now, not just ones that resize anything.
// A no-op stub is the standard fix for testing Radix in jsdom.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
}
