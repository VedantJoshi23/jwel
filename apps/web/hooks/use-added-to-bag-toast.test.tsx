import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { toast } from 'sonner';
import { useAddedToBagToast } from './use-added-to-bag-toast';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));
vi.mock('sonner', () => ({ toast: { success: vi.fn() } }));

function fire(description?: string) {
  const { result } = renderHook(() => useAddedToBagToast());
  result.current(description);
  return vi.mocked(toast.success).mock.calls.at(-1)!;
}

describe('useAddedToBagToast', () => {
  beforeEach(() => vi.clearAllMocks());

  it('offers a way through to the bag, rather than only confirming', () => {
    // The gap this closes: the bag used to be reachable only by hunting for
    // the header's cart button after the add.
    const [, options] = fire('Halo Ring — silver');
    const action = (options as { action: { label: string; onClick: () => void } }).action;

    expect(action.label).toBe('View bag');
    action.onClick();
    expect(push).toHaveBeenCalledWith('/cart');
  });

  it('passes the piece through as the description', () => {
    const [title, options] = fire('Halo Ring — silver');
    expect(title).toBe('Added to bag');
    expect(options).toMatchObject({ description: 'Halo Ring — silver' });
  });

  it('outlives a plain confirmation, since it expects to be acted on', () => {
    const [, options] = fire();
    // sonner's own default is 4s, which is not long enough to notice a
    // button, decide, and reach it.
    expect((options as { duration: number }).duration).toBeGreaterThan(4000);
  });

  it('does not navigate on its own — dismissing is the "keep shopping" answer', () => {
    fire('Halo Ring');
    expect(push).not.toHaveBeenCalled();
  });
});
