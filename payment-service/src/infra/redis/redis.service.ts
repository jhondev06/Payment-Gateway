import { Injectable, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import { Logger } from '../../shared/logger';

/**
 * Serviço Redis
 * 
 * Responsável por cache, idempotência e rate limiting.
 */
@Injectable()
export class RedisService implements OnModuleDestroy {
    private readonly client: Redis;
    private readonly logger = new Logger('RedisService');

    constructor() {
        this.client = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
            retryStrategy: (times: number) => {
                if (times > 3) return null;
                return Math.min(times * 100, 3000);
            },
            maxRetriesPerRequest: 3,
            lazyConnect: true,
        });

        this.client.on('connect', () => {
            this.logger.info('Redis conectado');
        });

        this.client.on('error', (err: Error) => {
            this.logger.error('Erro Redis', err);
        });

        this.client.connect().catch((err: Error) => {
            this.logger.error('Falha ao conectar ao Redis', err);
        });
    }

    /**
     * Busca valor do Redis
     */
    async get(key: string): Promise<string | null> {
        try {
            return await this.client.get(key);
        } catch (error) {
            this.logger.error('Falha no GET Redis', error as Error, { key });
            return null;
        }
    }

    /**
     * Define valor com TTL
     */
    async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
        try {
            if (ttlSeconds) {
                await this.client.setex(key, ttlSeconds, value);
            } else {
                await this.client.set(key, value);
            }
        } catch (error) {
            this.logger.error('Falha no SET Redis', error as Error, { key });
        }
    }

    /**
     * Verifica se chave existe
     */
    async exists(key: string): Promise<boolean> {
        try {
            const result = await this.client.exists(key);
            return result === 1;
        } catch (error) {
            this.logger.error('Falha no EXISTS Redis', error as Error, { key });
            return false;
        }
    }

    /**
     * Remove chave
     */
    async del(key: string): Promise<void> {
        try {
            await this.client.del(key);
        } catch (error) {
            this.logger.error('Falha no DEL Redis', error as Error, { key });
        }
    }

    /**
     * Incrementa contador de rate limit
     */
    async incr(key: string, ttlSeconds: number): Promise<number> {
        try {
            const pipeline = this.client.pipeline();
            pipeline.incr(key);
            pipeline.expire(key, ttlSeconds);
            const results = await pipeline.exec();
            return (results?.[0]?.[1] as number) || 0;
        } catch (error) {
            this.logger.error('Falha no INCR Redis', error as Error, { key });
            return 0;
        }
    }

    /**
     * Health check
     */
    async isHealthy(): Promise<boolean> {
        try {
            await this.client.ping();
            return true;
        } catch {
            return false;
        }
    }

    async onModuleDestroy() {
        await this.client.quit();
        this.logger.info('Redis desconectado');
    }
}
