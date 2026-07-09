import { describe, expect, it } from 'vitest';
import { brand } from './brand';
import { SUBSCRIPTION_STEP_ICONS } from './subscription-icons';

describe('SUBSCRIPTION_STEP_ICONS', () => {
  it('has an icon for every step named in brand.subscription.steps', () => {
    for (const step of brand.subscription.steps) {
      expect(SUBSCRIPTION_STEP_ICONS[step]).toBeDefined();
    }
  });

  it('maps exactly the three known steps, no stray/orphaned entries', () => {
    expect(Object.keys(SUBSCRIPTION_STEP_ICONS).sort()).toEqual(
      ['Cancel anytime', 'Choose frequency', 'Pick your style'].sort(),
    );
  });
});
