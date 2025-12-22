import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { Logger } from './shared/logger';

async function bootstrap() {
    const logger = new Logger('Main');

    const app = await NestFactory.create(AppModule, {
        logger: ['error', 'warn', 'log', 'debug'],
    });

    // Global validation pipe
    app.useGlobalPipes(
        new ValidationPipe({
            whitelist: true,
            forbidNonWhitelisted: true,
            transform: true,
        }),
    );

    // CORS for development
    app.enableCors();

    const port = process.env.PORT || 3001;
    await app.listen(port);

    logger.info(`Payment Service running on port ${port}`);
    logger.info(`Environment: ${process.env.APP_ENV || 'development'}`);
}

bootstrap().catch((err) => {
    console.error('Failed to start Payment Service:', err);
    process.exit(1);
});
