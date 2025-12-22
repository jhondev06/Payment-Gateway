import { Injectable } from '@nestjs/common';
import { RedisService } from '../infra/redis/redis.service';
import { Payment } from './payment.dto';
import { Logger } from '../shared/logger';

/**
 * Serviço de Idempotência
 * 
 * Garante que pagamentos com a mesma Idempotency-Key não sejam processados duas vezes.
 * Cache expira em 24h por padrão.
 */
@Injectable()
export class IdempotencyService {
    private readonly logger = new Logger('IdempotencyService');
    private readonly prefix = 'idempotency:';
    private readonly ttl: number;

    constructor(private readonly redis: RedisService) {
        this.ttl = parseInt(process.env.REDIS_TTL_IDEMPOTENCY || '86400', 10); // 24h
    }

    /**
     * Busca pagamento em cache pela idempotency key
     */
    async get(key: string): Promise<Payment | null> {
        try {
            const cached = await this.redis.get(`${this.prefix}${key}`);
            if (cached) {
                this.logger.debug('Idempotency cache hit', { key });
                return JSON.parse(cached);
            }
            return null;
        } catch (error) {
            this.logger.error('Failed to get from idempotency cache', error, { key });
            return null; // Graceful degradation
        }
    }

    /**
     * Salva pagamento no cache
     */
    async set(key: string, payment: Payment): Promise<void> {
        try {
            await this.redis.set(
                `${this.prefix}${key}`,
                JSON.stringify(payment),
                this.ttl,
            );
            this.logger.debug('Idempotency cache set', { key, paymentId: payment.id });
        } catch (error) {
            this.logger.error('Failed to set idempotency cache', error, { key });
            // Don't throw - graceful degradation
        }
    }

    /**
     * Verifica se key existe (para lock)
     */
    async exists(key: string): Promise<boolean> {
        try {
            return await this.redis.exists(`${this.prefix}${key}`);
        } catch (error) {
            this.logger.error('Failed to check idempotency existence', error, { key });
            return false;
        }
    }
}
