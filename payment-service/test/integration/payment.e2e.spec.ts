import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '../src/app.module';
import { PaymentService } from '../src/payment/payment.service';
import { Payment } from '../src/payment/payment.dto';

describe('Payment Integration Tests', () => {
    let app: INestApplication;
    let paymentService: PaymentService;

    beforeAll(async () => {
        const module: TestingModule = await Test.createTestingModule({
            imports: [AppModule],
        }).compile();

        app = module.createNestApplication();
        await app.init();

        paymentService = app.get<PaymentService>(PaymentService);
    });

    afterAll(async () => {
        await app.close();
    });

    describe('Fluxo Completo de Pagamento PIX', () => {
        let createdPayment: Payment;

        it('deve criar pagamento PIX com sucesso', async () => {
            const createPaymentDto = {
                amount: 99.90,
                description: 'Pedido #12345',
                customer_email: 'cliente@exemplo.com',
                customer_name: 'João Silva',
            };

            const idempotencyKey = 'test-integration-key-' + Date.now();

            createdPayment = await paymentService.createPixPayment(
                createPaymentDto,
                idempotencyKey,
                'test-correlation-id',
            );

            expect(createdPayment).toBeDefined();
            expect(createdPayment.id).toBeDefined();
            expect(createdPayment.status).toBe('PENDING');
            expect(createdPayment.amount).toBe(99.90);
            expect(createdPayment.currency).toBe('BRL');
            expect(createdPayment.pix_qr_code).toContain('REF-');
            expect(createdPayment.pix_qr_code_base64).toBeTruthy();
            expect(createdPayment.pix_expiration).toBeInstanceOf(Date);
        });

        it('deve recuperar pagamento criado', async () => {
            const retrieved = await paymentService.getPayment(createdPayment.id);

            expect(retrieved).toBeDefined();
            expect(retrieved.id).toBe(createdPayment.id);
            expect(retrieved.status).toBe(createdPayment.status);
            expect(retrieved.amount).toBe(createdPayment.amount);
        });

        it('deve ser idempotente - não criar pagamento duplicado', async () => {
            const createPaymentDto = {
                amount: 88.50,
                description: 'Pedido #99999',
                customer_email: 'cliente2@exemplo.com',
                customer_name: 'Maria Silva',
            };

            const idempotencyKey = 'test-integration-idempotency-' + Date.now();

            const firstPayment = await paymentService.createPixPayment(
                createPaymentDto,
                idempotencyKey,
                'test-correlation-id-1',
            );

            const secondPayment = await paymentService.createPixPayment(
                createPaymentDto,
                idempotencyKey,
                'test-correlation-id-2',
            );

            expect(secondPayment.id).toBe(firstPayment.id);
            expect(secondPayment.amount).toBe(firstPayment.amount);
        });

        it('deve atualizar status para PAID', async () => {
            const externalId = createdPayment.external_id;

            await paymentService.updatePaymentStatus(externalId, 'PAID');

            const updated = await paymentService.getPayment(createdPayment.id);

            expect(updated.status).toBe('PAID');
            expect(updated.paid_at).toBeInstanceOf(Date);
        });

        it('deve atualizar status para FAILED', async () => {
            const createPaymentDto = {
                amount: 55.00,
                description: 'Pedido #54321',
                customer_email: 'cliente3@exemplo.com',
                customer_name: 'Pedro Santos',
            };

            const idempotencyKey = 'test-integration-failed-' + Date.now();

            const payment = await paymentService.createPixPayment(
                createPaymentDto,
                idempotencyKey,
                'test-correlation-id',
            );

            await paymentService.updatePaymentStatus(payment.external_id, 'FAILED');

            const updated = await paymentService.getPayment(payment.id);

            expect(updated.status).toBe('FAILED');
            expect(updated.metadata).toHaveProperty('error');
        });
    });

    describe('Validações de Dados', () => {
        it('deve lançar erro quando amount menor que 0.01', async () => {
            const createPaymentDto = {
                amount: 0.001,
                description: 'Test',
                customer_email: 'test@example.com',
                customer_name: 'Test',
            };

            await expect(
                paymentService.createPixPayment(
                    createPaymentDto,
                    'test-key',
                    'test-correlation',
                ),
            ).rejects.toThrow();
        });

        it('deve lançar erro quando email inválido', async () => {
            const createPaymentDto = {
                amount: 50.00,
                description: 'Test',
                customer_email: 'invalid-email',
                customer_name: 'Test',
            };

            await expect(
                paymentService.createPixPayment(
                    createPaymentDto,
                    'test-key',
                    'test-correlation',
                ),
            ).rejects.toThrow();
        });
    });

    describe('Consultas de Pagamento', () => {
        it('deve lançar NotFoundException quando pagamento não existe', async () => {
            const invalidId = '550e8400-e29b-41d4-a716-446655440001';

            await expect(paymentService.getPayment(invalidId)).rejects.toThrow();
        });
    });

    describe('Integração com Mercado Pago', () => {
        it('deve criar pagamento PIX simulado em sandbox', async () => {
            const createPaymentDto = {
                amount: 125.50,
                description: 'Pedido sandbox',
                customer_email: 'sandbox@example.com',
                customer_name: 'Sandbox User',
            };

            const idempotencyKey = 'test-sandbox-' + Date.now();

            const payment = await paymentService.createPixPayment(
                createPaymentDto,
                idempotencyKey,
                'test-correlation-id',
            );

            expect(payment.external_id).toMatch(/^SANDBOX-/);
            expect(payment.pix_qr_code).toContain('REF-sandbox');
        });
    });
});
