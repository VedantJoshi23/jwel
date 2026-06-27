import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';

// Versioning is encoded directly in each controller's route prefix
// (`api/v1/...`, per ARCHITECTURE.md §9) rather than via Nest's built-in
// URI-versioning feature — using both at once would double-prefix routes.
async function bootstrap() {
  const app = await NestFactory.create(AppModule, { rawBody: true });
  const logger = new Logger('Bootstrap');

  app.use(helmet());
  app.enableCors({
    origin: (process.env.CORS_ALLOWED_ORIGINS ?? '').split(',').filter(Boolean),
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

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

  const port = process.env.PORT ?? 4000;
  await app.listen(port);
  logger.log(`Jwel API listening on :${port} — Swagger UI at /docs`);
}

bootstrap();
