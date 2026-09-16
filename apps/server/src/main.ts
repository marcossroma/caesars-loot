import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module.js';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { allowedOrigins } from './common/production-config.js';
import { productionMiddleware } from './common/production-middleware.js';

try {
  process.loadEnvFile();
} catch (error) {
  if (!error || typeof error !== 'object' || !('code' in error) || error.code !== 'ENOENT') {
    throw error;
  }
}

async function bootstrap(): Promise<void> {
  allowedOrigins();
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger:
      process.env.NODE_ENV === 'production'
        ? ['error', 'warn', 'log']
        : ['error', 'warn', 'log', 'debug', 'verbose'],
  });
  app.getHttpAdapter().getInstance().disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(productionMiddleware());
  app.useBodyParser('json', { limit: '16kb' });
  app.enableShutdownHooks();
  app.enableCors({
    origin: allowedOrigins(),
    methods: ['GET', 'POST'],
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      exceptionFactory: (errors) =>
        new BadRequestException({
          code: 'VALIDATION_ERROR',
          message: errors.flatMap((error) => Object.values(error.constraints ?? {})).join(' '),
        }),
    }),
  );
  const swaggerConfig = new DocumentBuilder()
    .setTitle("Caesar's Loot API")
    .setDescription('Demo-only portfolio game API. Not a certified gambling system.')
    .setVersion('0.1')
    .build();
  if (process.env.NODE_ENV !== 'production') {
    SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, swaggerConfig));
  }
  await app.listen(process.env['PORT'] ?? 3000, '0.0.0.0');
}

void bootstrap();
