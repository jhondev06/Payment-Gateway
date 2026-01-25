import { Controller, Get } from '@nestjs/common';
import { MetricsService } from '../shared/metrics.service';

@Controller('health')
export class HealthController {
    constructor(private readonly metricsService: MetricsService) {}

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

    @Get('metrics')
    async metrics() {
        return await this.metricsService.getMetrics();
    }
}

