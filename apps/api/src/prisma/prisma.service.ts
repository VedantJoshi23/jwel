import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * Builds the datasource URL, applying pool settings when they are configured.
 *
 * **The default is deliberately Prisma's own default, not a number we picked.**
 * Prisma sizes the pool at `num_physical_cpus * 2 + 1` unless told otherwise.
 * Choosing a different value today would mean asserting a tuning decision that
 * nothing has measured — the pool-saturation gauges enabled alongside this
 * exist precisely so the value can be set on evidence later. What this function
 * adds now is the *knob*, so a load run can vary it without a code change.
 *
 * Exported for testing: the URL rewriting is the part with edge cases (an
 * existing query string, a malformed URL), and it is worth covering directly.
 */
export function buildDatasourceUrl(
  base: string | undefined,
  env: NodeJS.ProcessEnv = process.env,
): string | undefined {
  if (!base) return base;

  const limit = env.DATABASE_CONNECTION_LIMIT;
  const timeout = env.DATABASE_POOL_TIMEOUT;
  if (!limit && !timeout) return base;

  let url: URL;
  try {
    url = new URL(base);
  } catch {
    // A DATABASE_URL we cannot parse is the connection's problem to report,
    // not ours to mask — hand it back untouched so the error names the real
    // cause rather than surfacing here as a pool-configuration failure.
    return base;
  }

  // An explicit value already in the URL wins: it is the more specific
  // statement of intent, and silently overriding it would make the connection
  // string a lie.
  if (limit && !url.searchParams.has('connection_limit')) {
    url.searchParams.set('connection_limit', limit);
  }
  if (timeout && !url.searchParams.has('pool_timeout')) {
    url.searchParams.set('pool_timeout', timeout);
  }
  return url.toString();
}

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    const url = buildDatasourceUrl(process.env.DATABASE_URL);
    super(url ? { datasources: { db: { url } } } : undefined);
  }

  async onModuleInit() {
    await this.$connect();
    const limit = process.env.DATABASE_CONNECTION_LIMIT ?? 'Prisma default (cpus * 2 + 1)';
    this.logger.log(`Connected to PostgreSQL via Prisma (connection_limit: ${limit})`);
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
