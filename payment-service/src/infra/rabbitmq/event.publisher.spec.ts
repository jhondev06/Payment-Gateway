import { Test, TestingModule } from '@nestjs/testing';
import { EventPublisher } from './event.publisher';
import * as amqp from 'amqplib';

jest.mock('amqplib', () => ({
    connect: jest.fn(),
}));

describe('EventPublisher', () => {
    let service: EventPublisher;
    let mockChannel: any;
    let mockConnection: any;

    beforeEach(async () => {
        mockChannel = {
            assertExchange: jest.fn(),
            assertQueue: jest.fn(),
            bindQueue: jest.fn(),
            publish: jest.fn(),
            close: jest.fn(),
        };

        mockConnection = {
            createChannel: jest.fn().mockResolvedValue(mockChannel),
            close: jest.fn(),
            on: jest.fn(),
        };

        (amqp.connect as jest.Mock).mockResolvedValue(mockConnection);

        const module: TestingModule = await Test.createTestingModule({
            providers: [EventPublisher],
        }).compile();

        service = module.get<EventPublisher>(EventPublisher);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('publish', () => {
        it('deve conectar e publicar evento com sucesso', async () => {
            const event = {
                type: 'PAID',
                payment_id: '123',
                amount: 100,
            };

            await service.publish('payment.events', event);

            expect(amqp.connect).toHaveBeenCalled();
            expect(mockConnection.createChannel).toHaveBeenCalled();
            expect(mockChannel.publish).toHaveBeenCalledWith(
                'payment.events',
                'payment.paid',
                expect.any(Buffer),
                expect.objectContaining({
                    persistent: true,
                    contentType: 'application/json',
                }),
            );
        });

        it('deve usar routing key correto baseado no tipo de evento', async () => {
            const event1 = { type: 'FAILED', payment_id: '123' };
            await service.publish('payment.events', event1);

            expect(mockChannel.publish).toHaveBeenCalledWith(
                'payment.events',
                'payment.failed',
                expect.any(Buffer),
                expect.any(Object),
            );

            const event2 = { type: 'CREATED', payment_id: '456' };
            await service.publish('payment.events', event2);

            expect(mockChannel.publish).toHaveBeenCalledWith(
                'payment.events',
                'payment.created',
                expect.any(Buffer),
                expect.any(Object),
            );
        });

        it('deve logar evento quando RabbitMQ indisponível (graceful degradation)', async () => {
            (amqp.connect as jest.Mock).mockRejectedValue(new Error('Connection failed'));

            const event = { type: 'PAID', payment_id: '123' };

            await service.publish('payment.events', event);

            expect(mockChannel.publish).not.toHaveBeenCalled();
        });

        it('deve lidar com erro na publicação', async () => {
            mockChannel.publish.mockImplementation(() => {
                throw new Error('Publish failed');
            });

            const event = { type: 'PAID', payment_id: '123' };

            await expect(service.publish('payment.events', event)).resolves.not.toThrow();
        });

        it('não deve reconectar se já conectado', async () => {
            const event = { type: 'PAID', payment_id: '123' };

            await service.publish('payment.events', event);
            await service.publish('payment.events', event);

            expect(amqp.connect).toHaveBeenCalledTimes(1);
        });
    });

    describe('setupTopology', () => {
        it('deve configurar exchanges e filas com DLQ', async () => {
            await service.publish('payment.events', { type: 'PAID' });

            expect(mockChannel.assertExchange).toHaveBeenCalledWith('payment.events', 'topic', { durable: true });
            expect(mockChannel.assertExchange).toHaveBeenCalledWith('payment.dlx', 'topic', { durable: true });
            expect(mockChannel.assertQueue).toHaveBeenCalledWith('payment.dlq', { durable: true });
            expect(mockChannel.assertQueue).toHaveBeenCalledWith(
                'notification.events',
                expect.objectContaining({ durable: true }),
            );
            expect(mockChannel.assertQueue).toHaveBeenCalledWith(
                'email.events',
                expect.objectContaining({ durable: true }),
            );
        });
    });

    describe('isHealthy', () => {
        it('deve retornar true quando conectado', async () => {
            await service.publish('payment.events', { type: 'PAID' });

            const healthy = await service.isHealthy();

            expect(healthy).toBe(true);
        });

        it('deve retornar false quando não conectado', async () => {
            const healthy = await service.isHealthy();

            expect(healthy).toBe(false);
        });
    });

    describe('onModuleDestroy', () => {
        it('deve fechar conexão e canal', async () => {
            await service.publish('payment.events', { type: 'PAID' });

            await service.onModuleDestroy();

            expect(mockChannel.close).toHaveBeenCalled();
            expect(mockConnection.close).toHaveBeenCalled();
        });

        it('não deve falhar se não houver conexão', async () => {
            await expect(service.onModuleDestroy()).resolves.not.toThrow();
        });
    });
});
