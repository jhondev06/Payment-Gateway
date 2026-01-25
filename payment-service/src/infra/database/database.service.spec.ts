import { Test, TestingModule } from '@nestjs/testing';
import { DatabaseService } from './database.service';
import { Pool } from 'pg';

jest.mock('pg');

describe('DatabaseService', () => {
    let service: DatabaseService;
    let poolMock: any;

    beforeEach(async () => {
        poolMock = {
            query: jest.fn(),
            connect: jest.fn(),
            on: jest.fn(),
            end: jest.fn(),
        };

        (Pool as any).mockImplementation(() => poolMock);

        const module: TestingModule = await Test.createTestingModule({
            providers: [DatabaseService],
        }).compile();

        service = module.get<DatabaseService>(DatabaseService);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('constructor', () => {
        it('deve inicializar o pool de conexões', () => {
            expect(Pool).toHaveBeenCalledWith({
                connectionString: process.env.DATABASE_URL,
                max: 10,
                idleTimeoutMillis: 30000,
                connectionTimeoutMillis: 2000,
            });
        });

        it('deve usar DATABASE_POOL_SIZE da env se definida', () => {
            process.env.DATABASE_POOL_SIZE = '20';
            const newService = new DatabaseService();
            expect(Pool).toHaveBeenCalledWith(
                expect.objectContaining({ max: 20 }),
            );
            delete process.env.DATABASE_POOL_SIZE;
        });
    });

    describe('query', () => {
        it('deve executar query com sucesso', async () => {
            const mockResult = { rows: [{ id: 1 }], rowCount: 1 };
            poolMock.query.mockResolvedValue(mockResult);

            const result = await service.query('SELECT * FROM test');

            expect(poolMock.query).toHaveBeenCalledWith('SELECT * FROM test', undefined);
            expect(result).toEqual(mockResult);
        });

        it('deve executar query com parâmetros', async () => {
            const mockResult = { rows: [{ id: 1 }], rowCount: 1 };
            poolMock.query.mockResolvedValue(mockResult);

            const params = [1, 'test'];
            await service.query('SELECT * FROM test WHERE id = $1', params);

            expect(poolMock.query).toHaveBeenCalledWith(
                'SELECT * FROM test WHERE id = $1',
                params,
            );
        });

        it('deve lançar erro na falha da query', async () => {
            const error = new Error('Query failed');
            poolMock.query.mockRejectedValue(error);

            await expect(service.query('SELECT * FROM test')).rejects.toThrow(error);
        });
    });

    describe('transaction', () => {
        it('deve executar transação com sucesso', async () => {
            const mockClient = {
                query: jest.fn(),
                release: jest.fn(),
            };
            poolMock.connect.mockResolvedValue(mockClient);

            const callback = jest.fn().mockResolvedValue('result');
            const result = await service.transaction(callback);

            expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
            expect(callback).toHaveBeenCalledWith(mockClient);
            expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
            expect(mockClient.release).toHaveBeenCalled();
            expect(result).toBe('result');
        });

        it('deve fazer rollback em caso de erro', async () => {
            const mockClient = {
                query: jest.fn(),
                release: jest.fn(),
            };
            poolMock.connect.mockResolvedValue(mockClient);

            const error = new Error('Transaction failed');
            const callback = jest.fn().mockRejectedValue(error);

            await expect(service.transaction(callback)).rejects.toThrow(error);

            expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
            expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
            expect(mockClient.release).toHaveBeenCalled();
        });

        it('deve liberar cliente mesmo em caso de erro no release', async () => {
            const mockClient = {
                query: jest.fn(),
                release: jest.fn().mockImplementation(() => {
                    throw new Error('Release failed');
                }),
            };
            poolMock.connect.mockResolvedValue(mockClient);

            const callback = jest.fn().mockResolvedValue('result');

            await expect(service.transaction(callback)).rejects.toThrow('Release failed');
            expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
        });
    });

    describe('isHealthy', () => {
        it('deve retornar true quando ping bem-sucedido', async () => {
            poolMock.query.mockResolvedValue({ rows: [] });

            const healthy = await service.isHealthy();

            expect(healthy).toBe(true);
            expect(poolMock.query).toHaveBeenCalledWith('SELECT 1');
        });

        it('deve retornar false quando ping falha', async () => {
            poolMock.query.mockRejectedValue(new Error('Connection failed'));

            const healthy = await service.isHealthy();

            expect(healthy).toBe(false);
        });
    });

    describe('onModuleDestroy', () => {
        it('deve fechar o pool de conexões', async () => {
            poolMock.end.mockResolvedValue(undefined);

            await service.onModuleDestroy();

            expect(poolMock.end).toHaveBeenCalled();
        });
    });
});
