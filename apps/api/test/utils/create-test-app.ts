import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../../src/app.module';

/**
 * Boots a real Nest application — every module, every guard, the real
 * global ValidationPipe — against the real `jwel_test` Postgres database.
 * No module is mocked; this is deliberately the same app `main.ts` boots,
 * minus `app.listen()`, so an integration test exercises the actual
 * request pipeline (guards, pipes, filters) a unit test mocking
 * PrismaService never touches.
 */
export async function createTestApp(): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication();
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  await app.init();
  return app;
}
