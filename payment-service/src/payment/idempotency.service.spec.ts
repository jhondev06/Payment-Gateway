import { IdempotencyService } from './idempotency.service';
import { RedisService } from '../infra/redis/redis.service';
import { Payment } from './payment.dto';

/**
 * Testes unitários para IdempotencyService
 */
describe('IdempotencyService', () => {
    let service: IdempotencyService;
    let redisService: jest.Mocked<RedisService>;

    const mockPayment: Payment = {
        id: 'test-uuid',
        external_id: null,
        idempotency_key: 'test-key',
        amount: 100.00,
        currency: 'BRL',
        status: 'PENDING',
        payment_method: 'pix',
        pix_qr_code: null,
        pix_qr_code_base64: null,
        pix_expiration: null,
        customer_email: null,
        customer_name: null,
        description: null,
        metadata: {},
        created_at: new Date(),
        updated_at: new Date(),
        paid_at: null,
    };

    beforeEach(() => {
        redisService = {
            get: jest.fn(),
            set: jest.fn(),
            exists: jest.fn(),
            del: jest.fn(),
            incr: jest.fn(),
            isHealthy: jest.fn(),
        } as unknown as jest.Mocked<RedisService>;

        service = new IdempotencyService(redisService);
    });

    describe('get', () => {
        it('deve retornar null se chave não existir', async () => {
            // Arrange
            redisService.get.mockResolvedValue(null);

            // Act
            const result = await service.get('non-existent');

            // Assert
            expect(result).toBeNull();
            expect(redisService.get).toHaveBeenCalledWith('idempotency:non-existent');
        });

        it('deve retornar pagamento parseado se existir no cache', async () => {
            // Arrange
            redisService.get.mockResolvedValue(JSON.stringify(mockPayment));

            // Act
            const result = await service.get('test-key');

            // Assert
            expect(result).toBeDefined();
            expect(result?.id).toBe('test-uuid');
        });

        it('deve retornar null em caso de erro (graceful degradation)', async () => {
            // Arrange
            redisService.get.mockRejectedValue(new Error('Redis error'));

            // Act
            const result = await service.get('error-key');

            // Assert
            expect(result).toBeNull();
        });
    });

    describe('set', () => {
        it('deve salvar pagamento serializado no Redis', async () => {
            // Arrange
            redisService.set.mockResolvedValue();

            // Act
            await service.set('test-key', mockPayment);

            // Assert
            expect(redisService.set).toHaveBeenCalledWith(
                'idempotency:test-key',
                expect.any(String),
                86400,
            );
        });

        it('não deve lançar erro se Redis falhar (graceful degradation)', async () => {
            // Arrange
            redisService.set.mockRejectedValue(new Error('Redis error'));

            // Act & Assert
            await expect(
                service.set('error-key', mockPayment),
            ).resolves.not.toThrow();
        });
    });

    describe('exists', () => {
        it('deve retornar true se chave existir', async () => {
            // Arrange
            redisService.exists.mockResolvedValue(true);

            // Act
            const result = await service.exists('existing-key');

            // Assert
            expect(result).toBe(true);
        });

        it('deve retornar false se chave não existir', async () => {
            // Arrange
            redisService.exists.mockResolvedValue(false);

            // Act
            const result = await service.exists('non-existent');

            // Assert
            expect(result).toBe(false);
        });
    });
});
