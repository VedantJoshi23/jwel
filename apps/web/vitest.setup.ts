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

// jsdom has no IntersectionObserver either, and `components/motion/reveal.tsx`
// (`Reveal`/`RevealSection`, now used across most of the storefront) drives
// framer-motion's `whileInView` off it — any test that renders one of those
// components crashes at mount, not just tests that scroll. A no-op observer
// that never fires is the right shape for tests that are about what renders,
// not about the reveal animation itself running (that lives in
// reveal.test.tsx). Global, not per-file, because leaving each new page or
// component test to remember this is exactly how it went missing once
// already — a collection-view test broke the first time a RevealSection
// landed inside it.
class IntersectionObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
}
if (typeof globalThis.IntersectionObserver === 'undefined') {
  globalThis.IntersectionObserver = IntersectionObserverStub as unknown as typeof IntersectionObserver;
}
