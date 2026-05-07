import { Controller, Get } from '@nestjs/common';
import { MetricsService } from '../shared/metrics.service';
import { DatabaseService } from '../infra/database/database.service';
import { RedisService } from '../infra/redis/redis.service';
import { EventPublisher } from '../infra/rabbitmq/event.publisher';

@Controller('health')
export class HealthController {
    constructor(
        private readonly metricsService: MetricsService,
        private readonly db: DatabaseService,
        private readonly redis: RedisService,
        private readonly eventPublisher: EventPublisher,
    ) {}

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
    async ready() {
        const dbHealthy = await this.db.isHealthy();
        const redisHealthy = await this.redis.isHealthy();
        const rabbitHealthy = await this.eventPublisher.isHealthy();

        const allHealthy = dbHealthy && redisHealthy && rabbitHealthy;

        return {
            status: allHealthy ? 'ready' : 'degraded',
            checks: {
                database: dbHealthy ? 'ok' : 'fail',
                redis: redisHealthy ? 'ok' : 'fail',
                rabbitmq: rabbitHealthy ? 'ok' : 'fail',
            },
            timestamp: new Date().toISOString(),
        };
    }

    @Get('metrics')
    async metrics() {
        return await this.metricsService.getMetrics();
    }
}
