import { ConfigService } from '@nestjs/config';
import { SHIPPING_PROVIDER } from './ports/shipping-provider.port';
import { StaticZoneShippingProvider } from './providers/static-zone-shipping.provider';
import { ShiprocketShippingProvider } from './providers/shiprocket-shipping.provider';

// The factory closes over NODE_ENV at module-evaluation time, so each case
// has to re-import the module with the env already set — same pattern as
// `payments.module.spec.ts`.
function loadProviderFactory(nodeEnv: string) {
  process.env.NODE_ENV = nodeEnv;
  let factory!: (config: ConfigService, staticProvider: StaticZoneShippingProvider) => unknown;

  jest.isolateModules(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { ShippingModule } = require('./shipping.module');
    const providers = Reflect.getMetadata('providers', ShippingModule) as Array<{
      provide?: unknown;
      useFactory?: (config: ConfigService, staticProvider: StaticZoneShippingProvider) => unknown;
    }>;
    factory = providers.find((p) => p.provide === SHIPPING_PROVIDER)!.useFactory!;
  });

  return factory;
}

function configWith(values: Record<string, string | undefined>): ConfigService {
  return {
    get: (key: string) => values[key],
    getOrThrow: (key: string) => {
      const value = values[key];
      if (value === undefined) throw new Error(`Missing ${key}`);
      return value;
    },
  } as unknown as ConfigService;
}

const liveCredentials = {
  SHIPROCKET_EMAIL: 'api-user@example.com',
  SHIPROCKET_PASSWORD: 'test-password',
  SHIPROCKET_PICKUP_PINCODE: '400001',
};

describe('ShippingModule — provider selection', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const staticProvider = new StaticZoneShippingProvider(
    {} as never,
    {} as never,
  );

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  describe('outside production', () => {
    it('uses the static estimator even when Shiprocket credentials happen to be present', () => {
      const factory = loadProviderFactory('development');

      const provider = factory(configWith(liveCredentials), staticProvider);

      expect(provider).toBe(staticProvider);
    });

    it('uses the static estimator when no credentials are present', () => {
      const factory = loadProviderFactory('test');

      expect(factory(configWith({}), staticProvider)).toBe(staticProvider);
    });
  });

  describe('in production', () => {
    it('constructs the real Shiprocket adapter when all three credentials are set', () => {
      const factory = loadProviderFactory('production');

      const provider = factory(configWith(liveCredentials), staticProvider);

      // Compared by constructor name, not toBeInstanceOf: jest.isolateModules
      // re-evaluates the module graph, so the class the factory closes over is
      // a different object identity than the one imported at the top of this
      // file even though it is the same source (same reasoning as
      // payments.module.spec.ts).
      expect(provider).not.toBe(staticProvider);
      expect((provider as object).constructor.name).toBe(ShiprocketShippingProvider.name);
    });

    // Unlike PaymentsModule, missing credentials must NOT crash the boot —
    // a degraded estimate is an acceptable, self-declaring fallback here
    // (FEAT-SHIPPING Edge Case 1); confirming unpaid orders never is, which
    // is why PaymentsModule's equivalent test asserts the opposite.
    it('falls back to the static estimator, rather than refusing to boot, when credentials are missing', () => {
      const factory = loadProviderFactory('production');

      expect(factory(configWith({}), staticProvider)).toBe(staticProvider);
    });

    it.each([['SHIPROCKET_EMAIL'], ['SHIPROCKET_PASSWORD'], ['SHIPROCKET_PICKUP_PINCODE']])(
      'falls back to the static estimator when %s alone is missing',
      (missing) => {
        const factory = loadProviderFactory('production');
        const partial = { ...liveCredentials, [missing]: undefined };

        expect(factory(configWith(partial), staticProvider)).toBe(staticProvider);
      },
    );
  });
});
