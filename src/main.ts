import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  console.log('[bootstrap] starting Nest application');
  const app = await NestFactory.create(AppModule, {
    bufferLogs: false,
  });
  console.log('[bootstrap] Nest application created');

  app.use(helmet());
  app.enableCors();
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Turmeric Dashboard API')
    .setDescription('APIs for supplier, buyer, exporter, and match analytics')
    .setVersion('1.0.0')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document);

  const configService = app.get(ConfigService);
  const port = configService.get<number>('app.port', 3000);
  await app.listen(port);
  console.log(`[bootstrap] listening on port ${port}`);
}

bootstrap().catch((error) => {
  console.error('[bootstrap] failed to start application');
  console.error(error);
  process.exit(1);
});
