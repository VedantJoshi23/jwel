import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

// `isDemoMode` is a module-level const, evaluated once when the module is
// first imported — so stubbing the env var after a normal top-level import
// would have no effect. Each case therefore resets the module registry and
// re-imports, which re-runs that const against the stubbed value.
async function renderWithDemoMode(value: string | undefined) {
  vi.resetModules();
  if (value === undefined) {
    vi.stubEnv('NEXT_PUBLIC_DEMO_MODE', '');
  } else {
    vi.stubEnv('NEXT_PUBLIC_DEMO_MODE', value);
  }
  const { DemoModeBanner } = await import('./demo-mode-banner');
  return render(<DemoModeBanner />);
}

const BANNER_TEXT = /Demo store — orders are for preview only/;

describe('DemoModeBanner', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('renders the banner when NEXT_PUBLIC_DEMO_MODE is exactly "true"', async () => {
    await renderWithDemoMode('true');
    expect(screen.getByText(BANNER_TEXT)).toBeInTheDocument();
  });

  it('tells the visitor no payment is taken and nothing ships', async () => {
    await renderWithDemoMode('true');
    // The specific promise matters: this banner is the only thing standing
    // between a shopper and a checkout that confirms orders without charging.
    expect(
      screen.getByText(/No payment is taken and nothing will be shipped/),
    ).toBeInTheDocument();
  });

  it('exposes the banner as a status region rather than an alert', async () => {
    await renderWithDemoMode('true');
    // role="status" is polite; an alert would interrupt a screen reader on
    // every page load, since this renders on all pages.
    expect(screen.getByRole('status')).toHaveTextContent(BANNER_TEXT);
  });

  it('renders nothing when the flag is unset — the live-shop default', async () => {
    const { container } = await renderWithDemoMode(undefined);
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('renders nothing for a truthy-looking value that is not "true"', async () => {
    // Guards the exact-string comparison. A banner that appeared for
    // NEXT_PUBLIC_DEMO_MODE=1 would be harmless; one that stayed hidden for a
    // value someone believed enabled demo mode would not be, so the pairing
    // with the API's PAYMENTS_MODE must be all-or-nothing.
    const { container } = await renderWithDemoMode('1');
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing for "false"', async () => {
    const { container } = await renderWithDemoMode('false');
    expect(container).toBeEmptyDOMElement();
  });
});
