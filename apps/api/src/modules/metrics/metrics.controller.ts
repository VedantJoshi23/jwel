import { Controller, Get, Header } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { Public } from '../../common/decorators/public.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { MetricsService } from './metrics.service';

/**
 * Unversioned and outside `api/v1`, same reasoning as `/health` — this is an
 * infrastructure endpoint, not part of the public API contract.
 *
 * Deliberately NOT exposed through nginx (deploy/nginx/jwel.conf.template has
 * no `/metrics` location). Prometheus reaches it over the internal `jwel-net`
 * Docker network as `api:4000/metrics`; the public internet gets nothing.
 * Unlike `/health`, this endpoint has real content to leak — request-rate and
 * latency data an outsider could use to infer traffic patterns — so publishing
 * it is a deliberate omission, not an oversight.
 */
@ApiExcludeController()
@SkipThrottle()
@Controller('metrics')
export class MetricsController {
  constructor(
    private readonly metrics: MetricsService,
    private readonly prisma: PrismaService,
  ) {}

  @Public()
  @Get()
  @Header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
  async scrape(): Promise<string> {
    const [own, pool] = await Promise.all([
      this.metrics.registry.metrics(),
      // Prisma keeps its pool gauges in its own registry, not prom-client's,
      // so they are appended in Prometheus text format rather than mirrored
      // into a Counter — mirroring would add a sampling delay between the two
      // halves of the same scrape.
      this.prismaPoolMetrics(),
    ]);
    return pool ? `${own}\n${pool}` : own;
  }

  /**
   * A scrape must not fail because one gauge source is unavailable — losing
   * every metric at the moment something is wrong is the opposite of what
   * monitoring is for. Prisma's metrics are a preview feature and throw if the
   * client was generated without them.
   */
  private async prismaPoolMetrics(): Promise<string> {
    try {
      return await this.prisma.$metrics.prometheus();
    } catch {
      return '';
    }
  }
}
