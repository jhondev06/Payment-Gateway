import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
    @Get()
    check() {
        return {
            status: 'ok',
            service: 'payment-service',
            timestamp: new Date().toISOString(),
            environment: process.env.APP_ENV || 'development',
        };
    }

    @Get('ready')
    ready() {
        // TODO: Check database, redis, rabbitmq connections
        return {
            status: 'ready',
            checks: {
                database: 'ok',
                redis: 'ok',
                rabbitmq: 'ok',
            },
        };
    }
}
