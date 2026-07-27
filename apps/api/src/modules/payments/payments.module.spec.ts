import { ConfigService } from '@nestjs/config';
import { PAYMENT_PROVIDER_RAZORPAY } from './ports/payment-provider.port';
import { MockPaymentProvider } from './providers/mock-payment.provider';
import { RazorpayPaymentProvider } from './providers/razorpay-payment.provider';

jest.mock('razorpay', () =>
  jest.fn().mockImplementation(() => ({
    orders: { create: jest.fn(), fetchPayments: jest.fn() },
    payments: { refund: jest.fn() },
  })),
);

// The factory closes over NODE_ENV and PAYMENTS_MODE at module-evaluation
// time, so each case has to re-import the module with the env already set.
function loadProviderFactory(nodeEnv: string, paymentsMode?: string) {
  process.env.NODE_ENV = nodeEnv;
  if (paymentsMode === undefined) {
    delete process.env.PAYMENTS_MODE;
  } else {
    process.env.PAYMENTS_MODE = paymentsMode;
  }
  let factory!: (config: ConfigService, mock: MockPaymentProvider) => unknown;

  jest.isolateModules(() => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { PaymentsModule } = require('./payments.module');
    const providers = Reflect.getMetadata('providers', PaymentsModule) as Array<{
      provide?: unknown;
      useFactory?: (config: ConfigService, mock: MockPaymentProvider) => unknown;
    }>;
    factory = providers.find((p) => p.provide === PAYMENT_PROVIDER_RAZORPAY)!.useFactory!;
  });

  return factory;
}

function configWith(values: Record<string, string | undefined>): ConfigService {
  return {
    get: (key: string) => values[key],
    // RazorpayPaymentProvider's constructor uses getOrThrow, so the stub has to
    // honour both accessors.
    getOrThrow: (key: string) => {
      const value = values[key];
      if (value === undefined) throw new Error(`Missing ${key}`);
      return value;
    },
  } as unknown as ConfigService;
}

const liveCredentials = {
  RAZORPAY_KEY_ID: 'rzp_live_x',
  RAZORPAY_KEY_SECRET: 'live_secret',
  RAZORPAY_WEBHOOK_SECRET: 'live_webhook_secret',
};

describe('PaymentsModule — Razorpay provider selection', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalPaymentsMode = process.env.PAYMENTS_MODE;
  const mock = new MockPaymentProvider();

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    if (originalPaymentsMode === undefined) {
      delete process.env.PAYMENTS_MODE;
    } else {
      process.env.PAYMENTS_MODE = originalPaymentsMode;
    }
  });

  describe('outside production', () => {
    // Regression guard: CI and local .env both carry placeholder Razorpay keys.
    // Selecting on credential presence rather than NODE_ENV would route dev and
    // e2e checkouts at the real Razorpay adapter and break the demo flow.
    it('uses the mock even when (placeholder) credentials are present', () => {
      const factory = loadProviderFactory('development');

      const provider = factory(
        configWith({
          RAZORPAY_KEY_ID: 'rzp_test_ci_placeholder',
          RAZORPAY_KEY_SECRET: 'ci_placeholder_secret',
          RAZORPAY_WEBHOOK_SECRET: 'ci_placeholder_webhook_secret',
        }),
        mock,
      );

      expect(provider).toBe(mock);
    });

    it('uses the mock when no credentials are present', () => {
      const factory = loadProviderFactory('test');

      expect(factory(configWith({}), mock)).toBe(mock);
    });
  });

  describe('in production', () => {
    it('constructs the real Razorpay adapter when all three credentials are set', () => {
      const factory = loadProviderFactory('production');

      const provider = factory(configWith(liveCredentials), mock);

      // Compared by constructor name, not toBeInstanceOf: jest.isolateModules
      // re-evaluates the module graph, so the class the factory closes over is
      // a different object identity than the one imported at the top of this
      // file even though it is the same source.
      expect(provider).not.toBe(mock);
      expect((provider as object).constructor.name).toBe(RazorpayPaymentProvider.name);
    });

    // Silently mocking payments in production would mark real orders paid
    // without money moving.
    it('refuses to start rather than falling back to the mock', () => {
      const factory = loadProviderFactory('production');

      expect(() => factory(configWith({}), mock)).toThrow(/required when NODE_ENV=production/);
    });

    // Each credential is checked independently — a partially-filled .env is
    // the realistic mistake, and any one missing must fail the same way.
    it.each([
      ['RAZORPAY_KEY_ID'],
      ['RAZORPAY_KEY_SECRET'],
      ['RAZORPAY_WEBHOOK_SECRET'],
    ])('refuses to start when %s is missing', (missing) => {
      const factory = loadProviderFactory('production');
      const partial = { ...liveCredentials, [missing]: undefined };

      expect(() => factory(configWith(partial), mock)).toThrow(
        /required when NODE_ENV=production/,
      );
    });
  });

  // The staging escape hatch (RUNBOOK §13). These tests are the guard on a
  // flag whose failure mode is a live shop confirming orders without taking
  // money — the value must be honoured only when spelled exactly.
  describe('PAYMENTS_MODE=simulated in production', () => {
    it('uses the mock without credentials, instead of refusing to start', () => {
      const factory = loadProviderFactory('production', 'simulated');

      expect(factory(configWith({}), mock)).toBe(mock);
    });

    it('takes precedence over credentials that happen to be present', () => {
      // A half-migrated .env — keys added but the flag not yet removed —
      // must not quietly start charging real cards.
      const factory = loadProviderFactory('production', 'simulated');

      expect(factory(configWith(liveCredentials), mock)).toBe(mock);
    });

    it.each(['Simulated', 'SIMULATED', 'true', '1', 'yes', 'simulate', ' simulated'])(
      'does NOT enable simulated payments for %p',
      (value) => {
        const factory = loadProviderFactory('production', value);

        // Falls through to the normal production path: no credentials, so it
        // must refuse to boot rather than silently mock.
        expect(() => factory(configWith({}), mock)).toThrow(/required when NODE_ENV=production/);
      },
    );

    it('is inert outside production, where the mock is already used', () => {
      const factory = loadProviderFactory('development', 'simulated');

      expect(factory(configWith({}), mock)).toBe(mock);
    });

    it('does not leak into a production deployment that never sets it', () => {
      const factory = loadProviderFactory('production');

      expect(() => factory(configWith({}), mock)).toThrow(/required when NODE_ENV=production/);
    });
  });
});
