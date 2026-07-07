import { Ban, CalendarClock, Sparkles, type LucideIcon } from 'lucide-react';

/** Maps the fixed `brand.subscription.steps` copy to an icon — keyed by the
 * step text itself since there are only ever these three steps site-wide. */
export const SUBSCRIPTION_STEP_ICONS: Record<string, LucideIcon> = {
  'Pick your style': Sparkles,
  'Choose frequency': CalendarClock,
  'Cancel anytime': Ban,
};
