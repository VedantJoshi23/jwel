import { create } from 'zustand';

/**
 * Whether the bag drawer is showing.
 *
 * A store rather than props or context because the things that open it are
 * scattered — a product card's quick-add, the PDP, the wishlist — and the
 * drawer itself is mounted once in `SiteChrome`, nowhere near any of them.
 * Threading a callback down every one of those paths would be the same
 * coupling with more steps.
 *
 * Deliberately *not* persisted, unlike `auth-store`: a drawer that reopened
 * itself on the next page load would be re-announcing a decision the
 * shopper already moved on from.
 */
interface CartDrawerState {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  setOpen: (open: boolean) => void;
}

export const useCartDrawer = create<CartDrawerState>((set) => ({
  isOpen: false,
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
  setOpen: (isOpen) => set({ isOpen }),
}));
