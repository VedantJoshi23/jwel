import { Controller, Get, Header } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { Public } from '../../common/decorators/public.decorator';
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
  constructor(private readonly metrics: MetricsService) {}

  @Public()
  @Get()
  @Header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
  async scrape(): Promise<string> {
    return this.metrics.registry.metrics();
  }
}
