import { useEffect, useRef, useState } from 'react';

/**
 * Drives the client-requested "collapsible header" behaviour: hidden while
 * scrolling down to read, back the instant the visitor scrolls up, and —
 * since hover has no equivalent on a touchscreen and most of this storefront's
 * traffic is phones — also back whenever the pointer nears the top of the
 * viewport or a focus lands inside the header (so keyboard/assistive-tech
 * users are never the one group who can't recall it).
 *
 * Deliberately not a raw "any downward scroll hides it" rule: a couple of
 * pixels of rubber-band bounce at the top of the page, or a sub-pixel
 * jitter some trackpads report, would otherwise flicker the header on every
 * page load. A directional delta with a small deadzone (`THRESHOLD`) is what
 * makes the collapse read as intentional.
 *
 * Always visible within `REVEAL_ZONE_PX` of the top — collapsing a header
 * that is already at rest at the top of the page (nothing to scroll away
 * from yet) would be pure motion for no reason.
 */
const THRESHOLD_PX = 8;
const REVEAL_ZONE_PX = 96;
const POINTER_REVEAL_ZONE_PX = 72;

export function useAutoHideHeader() {
  const [hidden, setHidden] = useState(false);
  const lastY = useRef(0);
  const pointerNearTop = useRef(false);

  useEffect(() => {
    lastY.current = window.scrollY;

    function evaluate(currentY: number) {
      // Recorded on every call, not only when it crosses the threshold — a
      // reference point that only moves on a real direction change lets
      // several sub-threshold jitters stack into a phantom large delta
      // against a now-stale `lastY`. The threshold below filters a single
      // event's jitter; it must not let jitter accumulate across events.
      const previousY = lastY.current;
      lastY.current = currentY;

      if (currentY <= REVEAL_ZONE_PX || pointerNearTop.current) {
        setHidden(false);
        return;
      }
      const delta = currentY - previousY;
      if (delta > THRESHOLD_PX) {
        setHidden(true);
      } else if (delta < -THRESHOLD_PX) {
        setHidden(false);
      }
    }

    function onScroll() {
      evaluate(window.scrollY);
    }

    // Desktop-only proxy for the hover the client asked for — `pointermove`
    // fires for touch too, but a touch move without a scroll is rare enough,
    // and harmless (it only ever reveals, never hides), to skip filtering by
    // pointer type.
    function onPointerMove(event: PointerEvent) {
      const near = event.clientY <= POINTER_REVEAL_ZONE_PX;
      if (near !== pointerNearTop.current) {
        pointerNearTop.current = near;
        if (near) setHidden(false);
      }
    }

    // A hidden header must still reappear for keyboard focus — Tab must never
    // land on a control the visitor cannot see land on.
    function onFocusIn() {
      setHidden(false);
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('focusin', onFocusIn);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('focusin', onFocusIn);
    };
  }, []);

  return hidden;
}
