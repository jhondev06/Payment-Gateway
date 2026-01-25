import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { Logger } from './shared/logger';
import { validateSecrets } from './shared/secrets.validator';

async function bootstrap() {
    const logger = new Logger('Main');

    validateSecrets([
        {
            name: 'Database URL',
            envKey: 'DATABASE_URL',
            required: true,
            description: 'String de conexão do PostgreSQL',
        },
        {
            name: 'Redis URL',
            envKey: 'REDIS_URL',
            required: true,
            description: 'String de conexão do Redis',
        },
        {
            name: 'RabbitMQ URL',
            envKey: 'RABBITMQ_URL',
            required: true,
            description: 'String de conexão do RabbitMQ',
        },
        {
            name: 'Mercado Pago Access Token',
            envKey: 'MP_ACCESS_TOKEN',
            required: false,
            description: 'Access token para integração com Mercado Pago',
        },
        {
            name: 'Mercado Pago Webhook Secret',
            envKey: 'MP_WEBHOOK_SECRET',
            required: false,
            description: 'Webhook secret para validação HMAC',
        },
    ]);

    const app = await NestFactory.create(AppModule, {
        logger: ['error', 'warn', 'log', 'debug'],
    });

    app.useGlobalPipes(
        new ValidationPipe({
            whitelist: true,
            forbidNonWhitelisted: true,
            transform: true,
        }),
    );

    app.enableCors();

    const bodyParser = require('body-parser');
    app.use(bodyParser.json({ verify: (req: any, res: any, buf: any) => {
        req.rawBody = buf;
    } }));

    const port = process.env.PORT || 3001;
    await app.listen(port);

    logger.info(`Payment Service running on port ${port}`);
    logger.info(`Environment: ${process.env.APP_ENV || 'development'}`);
}

bootstrap().catch((err) => {
    console.error('Failed to start Payment Service:', err);
    process.exit(1);
});

