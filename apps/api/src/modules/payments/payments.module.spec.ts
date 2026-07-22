import { ConfigService } from '@nestjs/config';
import { PAYMENT_PROVIDER_STRIPE } from './ports/payment-provider.port';
import { MockPaymentProvider } from './providers/mock-payment.provider';
import { StripePaymentProvider } from './providers/stripe-payment.provider';

jest.mock('stripe', () =>
  jest.fn().mockImplementation(() => ({
    paymentIntents: { create: jest.fn() },
    webhooks: { constructEvent: jest.fn() },
  })),
);

// The factory closes over NODE_ENV at module-evaluation time, so each case has
// to re-import the module with the env already set.
function loadStripeFactory(nodeEnv: string) {
  process.env.NODE_ENV = nodeEnv;
  let factory!: (config: ConfigService, mock: MockPaymentProvider) => unknown;

  jest.isolateModules(() => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { PaymentsModule } = require('./payments.module');
    const providers = Reflect.getMetadata('providers', PaymentsModule) as Array<{
      provide?: unknown;
      useFactory?: (config: ConfigService, mock: MockPaymentProvider) => unknown;
    }>;
    factory = providers.find((p) => p.provide === PAYMENT_PROVIDER_STRIPE)!.useFactory!;
  });

  return factory;
}

function configWith(values: Record<string, string | undefined>): ConfigService {
  return {
    get: (key: string) => values[key],
    // StripePaymentProvider's constructor uses getOrThrow, so the stub has to
    // honour both accessors.
    getOrThrow: (key: string) => {
      const value = values[key];
      if (value === undefined) throw new Error(`Missing ${key}`);
      return value;
    },
  } as unknown as ConfigService;
}

describe('PaymentsModule — Stripe provider selection', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const mock = new MockPaymentProvider();

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  describe('outside production', () => {
    // Regression guard: CI and local .env both carry placeholder Stripe keys.
    // Selecting on credential presence rather than NODE_ENV would route dev and
    // e2e checkouts at the real Stripe adapter and break the demo flow.
    it('uses the mock even when (placeholder) credentials are present', () => {
      const factory = loadStripeFactory('development');

      const provider = factory(
        configWith({ STRIPE_SECRET_KEY: 'sk_test_ci_placeholder', STRIPE_WEBHOOK_SECRET: 'whsec_x' }),
        mock,
      );

      expect(provider).toBe(mock);
    });

    it('uses the mock when no credentials are present', () => {
      const factory = loadStripeFactory('test');

      expect(factory(configWith({}), mock)).toBe(mock);
    });
  });

  describe('in production', () => {
    it('constructs the real Stripe adapter when both credentials are set', () => {
      const factory = loadStripeFactory('production');

      const provider = factory(
        configWith({ STRIPE_SECRET_KEY: 'sk_live_x', STRIPE_WEBHOOK_SECRET: 'whsec_x' }),
        mock,
      );

      // Compared by constructor name, not toBeInstanceOf: jest.isolateModules
      // re-evaluates the module graph, so the class the factory closes over is
      // a different object identity than the one imported at the top of this
      // file even though it is the same source.
      expect(provider).not.toBe(mock);
      expect((provider as object).constructor.name).toBe(StripePaymentProvider.name);
    });

    // Silently mocking payments in production would mark real orders paid
    // without money moving.
    it('refuses to start rather than falling back to the mock', () => {
      const factory = loadStripeFactory('production');

      expect(() => factory(configWith({}), mock)).toThrow(/required when NODE_ENV=production/);
    });

    it('refuses to start when only one of the two credentials is set', () => {
      const factory = loadStripeFactory('production');

      expect(() => factory(configWith({ STRIPE_SECRET_KEY: 'sk_live_x' }), mock)).toThrow(
        /required when NODE_ENV=production/,
      );
    });
  });
});
