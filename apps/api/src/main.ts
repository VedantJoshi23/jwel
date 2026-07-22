import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';

// Versioning is encoded directly in each controller's route prefix
// (`api/v1/...`, per ARCHITECTURE.md §9) rather than via Nest's built-in
// URI-versioning feature — using both at once would double-prefix routes.
async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { rawBody: true });
  const logger = new Logger('Bootstrap');

  // Only mounted for the filesystem Storage adapter (see StorageModule) — S3
  // serves media directly, so this route simply doesn't exist in a
  // deployment configured with STORAGE_PROVIDER=s3.
  const appConfig = app.get(ConfigService);
  if (appConfig.get<string>('STORAGE_PROVIDER', 'filesystem') !== 's3') {
    const uploadsDir = appConfig.get<string>('UPLOADS_DIR', `${process.cwd()}/uploads`);
    app.useStaticAssets(uploadsDir, { prefix: '/uploads/' });
  }

  app.use(helmet());
  app.enableCors({
    origin: (appConfig.get<string>('CORS_ALLOWED_ORIGINS') ?? '')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
    credentials: true,
  });

  // Close DB connections cleanly on SIGTERM/SIGINT instead of dropping
  // in-flight requests during a rolling deploy or restart. Without this Nest
  // never registers the signal listeners, which left PrismaService's
  // onModuleDestroy (prisma.service.ts) as dead code.
  app.enableShutdownHooks();

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // Swagger publishes the entire API surface — every route, DTO shape and the
  // auth scheme — and is unauthenticated. Useful everywhere except the one
  // place it doubles as reconnaissance for an attacker.
  const isProduction = appConfig.get<string>('NODE_ENV') === 'production';
  if (!isProduction) {
    const config = new DocumentBuilder()
      .setTitle('Jwel API')
      .setDescription(
        'Jwel — luxury jewellery e-commerce backend. Implements Authentication, Users, ' +
          'Products, Orders, Payments, Inventory, Reviews and Coupons per ARCHITECTURE.md.',
      )
      .setVersion('1.0')
      .addBearerAuth()
      .addTag('auth')
      .addTag('users')
      .addTag('products')
      .addTag('inventory')
      .addTag('coupons')
      .addTag('reviews')
      .addTag('orders')
      .addTag('payments')
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('docs', app, document);
  }

  const port = appConfig.get<string>('PORT') ?? 4000;
  await app.listen(port);
  logger.log(
    `Jwel API listening on :${port}${isProduction ? '' : ' — Swagger UI at /docs'}`,
  );
}

bootstrap();
