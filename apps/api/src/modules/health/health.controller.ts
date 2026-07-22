import { Controller, Get, HttpCode, HttpStatus, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { PrismaService } from '../../prisma/prisma.service';
import { Public } from '../../common/decorators/public.decorator';

/**
 * Container/orchestrator probes. Deliberately split in two, because they
 * answer different questions and a caller that conflates them will either
 * restart a healthy process or keep routing traffic to a broken one:
 *
 *   /health       liveness  — "is the process up?"      never touches the DB
 *   /health/ready readiness — "can it serve traffic?"   pings Postgres
 *
 * A liveness check that queried the DB would make a transient database blip
 * look like a dead process and get the container killed, turning a recoverable
 * outage into a restart loop.
 *
 * Unversioned on purpose: these are infrastructure endpoints, not part of the
 * public `api/v1` contract, so they must not move when the API version does.
 */
@ApiExcludeController()
@SkipThrottle()
@Controller('health')
export class HealthController {
  private readonly logger = new Logger(HealthController.name);

  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get()
  liveness(): { status: string; uptimeSeconds: number } {
    return { status: 'ok', uptimeSeconds: Math.floor(process.uptime()) };
  }

  @Public()
  @Get('ready')
  @HttpCode(HttpStatus.OK)
  async readiness(): Promise<{ status: string; database: string }> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch (error) {
      // 503 rather than a thrown 500: this is a routine "not ready yet" during
      // startup, and orchestrators treat it as a signal to hold traffic back,
      // not as an application error worth paging on.
      this.logger.error(
        `Readiness check failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw new ServiceUnavailableException({ status: 'error', database: 'unreachable' });
    }

    return { status: 'ok', database: 'ok' };
  }
}
