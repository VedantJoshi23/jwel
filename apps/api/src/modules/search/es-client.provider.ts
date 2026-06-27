import { Client } from '@elastic/elasticsearch';
import { ConfigService } from '@nestjs/config';

export const ES_CLIENT = 'ES_CLIENT';

export function createEsClient(config: ConfigService): Client {
  return new Client({
    node: config.get<string>('ELASTICSEARCH_NODE', 'http://localhost:9200'),
    requestTimeout: 5000,
    maxRetries: 2,
  });
}
