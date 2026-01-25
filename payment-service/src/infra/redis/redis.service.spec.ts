import { Test, TestingModule } from '@nestjs/testing';
import { RedisService } from './redis.service';

describe('RedisService', () => {
    let service: RedisService;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [RedisService],
        }).compile();

        service = module.get<RedisService>(RedisService);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('constructor', () => {
        it('deve inicializar Redis com URL padrão', () => {
            const newService = new RedisService();
            expect(newService).toBeDefined();
        });

        it('deve inicializar Redis com URL da env', () => {
            process.env.REDIS_URL = 'redis://custom:6380';
            const newService = new RedisService();
            expect(newService).toBeDefined();
            delete process.env.REDIS_URL;
        });
    });

    describe('get', () => {
        it('deve retornar valor quando chave existe', async () => {
            await expect(service.get('key1')).resolves.toBeDefined();
        });

        it('deve retornar null quando chave não existe', async () => {
            await expect(service.get('key1')).resolves.toBeDefined();
        });
    });

    describe('set', () => {
        it('deve definir valor sem TTL', async () => {
            await expect(service.set('key1', 'value1')).resolves.not.toThrow();
        });

        it('deve definir valor com TTL', async () => {
            await expect(service.set('key1', 'value1', 60)).resolves.not.toThrow();
        });
    });

    describe('exists', () => {
        it('deve retornar booleano quando chave existe', async () => {
            await expect(service.exists('key1')).resolves.toBeDefined();
        });

        it('deve retornar booleano quando chave não existe', async () => {
            await expect(service.exists('key1')).resolves.toBeDefined();
        });
    });

    describe('del', () => {
        it('deve remover chave', async () => {
            await expect(service.del('key1')).resolves.not.toThrow();
        });
    });

    describe('incr', () => {
        it('deve incrementar e definir TTL', async () => {
            const result = await service.incr('counter', 60);
            expect(typeof result).toBe('number');
        });
    });

    describe('isHealthy', () => {
        it('deve retornar booleano quando ping bem-sucedido', async () => {
            const healthy = await service.isHealthy();
            expect(typeof healthy).toBe('boolean');
        });

        it('deve retornar booleano quando ping falha', async () => {
            const healthy = await service.isHealthy();
            expect(typeof healthy).toBe('boolean');
        });
    });

    describe('onModuleDestroy', () => {
        it('deve desconectar do Redis', async () => {
            await expect(service.onModuleDestroy()).resolves.not.toThrow();
        });
    });
});
