import { PaymentService } from './payment.service';
import { IdempotencyService } from './idempotency.service';
import { PaymentRepository } from './payment.repository';
import { MercadoPagoProvider } from '../infra/mercadopago/mercadopago.provider';
import { EventPublisher } from '../infra/rabbitmq/event.publisher';
import { MetricsService } from '../shared/metrics.service';
import { AlertService } from '../shared/alert.service';
import { Payment } from './payment.dto';
import { NotFoundException, ConflictException } from '@nestjs/common';

/**
 * Testes unitários para PaymentService
 */
describe('PaymentService', () => {
    let service: PaymentService;
    let idempotencyService: jest.Mocked<IdempotencyService>;
    let paymentRepository: jest.Mocked<PaymentRepository>;
    let mercadoPago: jest.Mocked<MercadoPagoProvider>;
    let eventPublisher: jest.Mocked<EventPublisher>;
    let metricsService: jest.Mocked<MetricsService>;
    let alertService: jest.Mocked<AlertService>;

    const mockPayment: Payment = {
        id: 'test-uuid',
        external_id: 'SANDBOX-123',
        idempotency_key: 'test-key',
        amount: 100.00,
        currency: 'BRL',
        status: 'PENDING',
        payment_method: 'pix',
        pix_qr_code: 'qr-code',
        pix_qr_code_base64: 'base64',
        pix_expiration: new Date(),
        customer_email: 'test@test.com',
        customer_name: 'Test User',
        description: 'Test Payment',
        metadata: {},
        created_at: new Date(),
        updated_at: new Date(),
        paid_at: null,
    };

    beforeEach(() => {
        // Cria mocks
        idempotencyService = {
            get: jest.fn(),
            set: jest.fn(),
            exists: jest.fn(),
        } as unknown as jest.Mocked<IdempotencyService>;

        paymentRepository = {
            create: jest.fn(),
            update: jest.fn(),
            findById: jest.fn(),
            findByExternalId: jest.fn(),
            findByIdempotencyKey: jest.fn(),
        } as unknown as jest.Mocked<PaymentRepository>;

        mercadoPago = {
            createPixPayment: jest.fn(),
            validateWebhookSignature: jest.fn(),
        } as unknown as jest.Mocked<MercadoPagoProvider>;

        eventPublisher = {
            publish: jest.fn(),
            isHealthy: jest.fn(),
        } as unknown as jest.Mocked<EventPublisher>;

        metricsService = {
            incrementPaymentsCreated: jest.fn(),
            incrementPaymentsCompleted: jest.fn(),
            incrementPaymentsFailed: jest.fn(),
            observePaymentProcessing: jest.fn(),
            incrementRequests: jest.fn(),
            observeRequestDuration: jest.fn(),
            setActiveConnections: jest.fn(),
            setQueueLength: jest.fn(),
            setCircuitBreakerState: jest.fn(),
            getMetrics: jest.fn(),
        } as unknown as jest.Mocked<MetricsService>;

        alertService = {
            sendAlert: jest.fn(),
            sendCriticalAlert: jest.fn(),
            sendErrorAlert: jest.fn(),
            sendWarningAlert: jest.fn(),
            sendInfoAlert: jest.fn(),
        } as unknown as jest.Mocked<AlertService>;

        service = new PaymentService(
            idempotencyService,
            paymentRepository,
            mercadoPago,
            eventPublisher,
            metricsService,
            alertService,
        );
    });

    describe('createPixPayment', () => {
        it('deve retornar pagamento do cache se idempotency key existir', async () => {
            // Arrange
            idempotencyService.get.mockResolvedValue(mockPayment);

            // Act
            const result = await service.createPixPayment(
                { amount: 100 },
                'existing-key',
            );

            // Assert
            expect(result).toEqual(mockPayment);
            expect(idempotencyService.get).toHaveBeenCalledWith('existing-key');
            expect(paymentRepository.create).not.toHaveBeenCalled();
        });

        it('deve criar novo pagamento se não existir no cache', async () => {
            // Arrange
            const createdPayment = { ...mockPayment, status: 'CREATED' as const };
            idempotencyService.get.mockResolvedValue(null);
            paymentRepository.create.mockResolvedValue(createdPayment);
            paymentRepository.update.mockResolvedValue(mockPayment);
            mercadoPago.createPixPayment.mockResolvedValue({
                id: 'SANDBOX-123',
                qr_code: 'qr-code',
                qr_code_base64: 'base64',
                expiration: new Date(),
            });

            // Act
            const result = await service.createPixPayment(
                { amount: 100, description: 'Test' },
                'new-key',
            );

            // Assert
            expect(result).toEqual(mockPayment);
            expect(paymentRepository.create).toHaveBeenCalled();
            expect(mercadoPago.createPixPayment).toHaveBeenCalled();
            expect(paymentRepository.update).toHaveBeenCalled();
            expect(idempotencyService.set).toHaveBeenCalled();
            expect(eventPublisher.publish).toHaveBeenCalled();
        });

        it('deve marcar pagamento como FAILED se Mercado Pago falhar', async () => {
            // Arrange
            const createdPayment = { ...mockPayment, status: 'CREATED' as const, metadata: {} };
            idempotencyService.get.mockResolvedValue(null);
            paymentRepository.create.mockResolvedValue(createdPayment);
            paymentRepository.update.mockResolvedValue({ ...createdPayment, status: 'FAILED' });
            mercadoPago.createPixPayment.mockRejectedValue(new Error('MP Error'));

            // Act & Assert
            await expect(
                service.createPixPayment({ amount: 100 }, 'fail-key'),
            ).rejects.toThrow('MP Error');

            expect(paymentRepository.update).toHaveBeenCalledWith(
                createdPayment.id,
                expect.objectContaining({ status: 'FAILED' }),
            );
        });
    });

    describe('getPayment', () => {
        it('deve retornar pagamento quando encontrado', async () => {
            // Arrange
            paymentRepository.findById.mockResolvedValue(mockPayment);

            // Act
            const result = await service.getPayment('test-uuid');

            // Assert
            expect(result).toEqual(mockPayment);
        });

        it('deve lançar NotFoundException quando pagamento não encontrado', async () => {
            // Arrange
            paymentRepository.findById.mockResolvedValue(null);

            // Act & Assert
            await expect(
                service.getPayment('non-existent'),
            ).rejects.toThrow(NotFoundException);
        });
    });

    describe('updatePaymentStatus', () => {
        it('deve atualizar status para PAID', async () => {
            // Arrange
            const paidPayment = { ...mockPayment, status: 'PAID' as const, paid_at: new Date() };
            paymentRepository.findByExternalId.mockResolvedValue(mockPayment);
            paymentRepository.update.mockResolvedValue(paidPayment);

            // Act
            const result = await service.updatePaymentStatus('SANDBOX-123', 'PAID');

            // Assert
            expect(result.status).toBe('PAID');
            expect(paymentRepository.update).toHaveBeenCalledWith(
                mockPayment.id,
                expect.objectContaining({ status: 'PAID' }),
            );
            expect(eventPublisher.publish).toHaveBeenCalledWith(
                'payment.events',
                expect.objectContaining({ type: 'PAYMENT_COMPLETED' }),
            );
        });

        it('deve rejeitar transição inválida de status', async () => {
            const paidPayment = { ...mockPayment, status: 'PAID' as const };
            paymentRepository.findByExternalId.mockResolvedValue(paidPayment);

            await expect(
                service.updatePaymentStatus('SANDBOX-123', 'FAILED'),
            ).rejects.toThrow(ConflictException);
        });

        it('deve lançar NotFoundException quando external_id não encontrado', async () => {
            // Arrange
            paymentRepository.findByExternalId.mockResolvedValue(null);

            // Act & Assert
            await expect(
                service.updatePaymentStatus('invalid-id', 'PAID'),
            ).rejects.toThrow(NotFoundException);
        });
    });
});
