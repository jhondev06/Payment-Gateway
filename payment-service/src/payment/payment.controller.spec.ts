import { Test, TestingModule } from '@nestjs/testing';
import { PaymentController } from './payment.controller';
import { PaymentService } from './payment.service';
import { BadRequestException } from '@nestjs/common';
import { Payment } from './payment.dto';

describe('PaymentController', () => {
    let controller: PaymentController;
    let paymentServiceMock: jest.Mocked<PaymentService>;

    const mockPayment: Payment = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        external_id: 'MP-123',
        idempotency_key: 'key-123',
        amount: 100.5,
        currency: 'BRL',
        status: 'PENDING',
        payment_method: 'pix',
        pix_qr_code: '00020126580014br.gov.bcb.pix0136REF-123',
        pix_qr_code_base64: 'iVBORw0KGgoAAAANSUhEUg...',
        pix_expiration: new Date('2025-01-25T10:30:00Z'),
        customer_email: 'test@example.com',
        customer_name: 'Test User',
        description: 'Test payment',
        metadata: {},
        created_at: new Date('2025-01-25T10:00:00Z'),
        updated_at: new Date('2025-01-25T10:00:00Z'),
        paid_at: null,
    };

    beforeEach(async () => {
        paymentServiceMock = {
            createPixPayment: jest.fn(),
            getPayment: jest.fn(),
        } as any;

        const module: TestingModule = await Test.createTestingModule({
            controllers: [PaymentController],
            providers: [
                {
                    provide: PaymentService,
                    useValue: paymentServiceMock,
                },
            ],
        }).compile();

        controller = module.get<PaymentController>(PaymentController);
    });

    describe('createPayment', () => {
        const createPaymentDto = {
            amount: 100.5,
            description: 'Test payment',
            customer_email: 'test@example.com',
            customer_name: 'Test User',
        };

        it('deve criar pagamento com sucesso', async () => {
            paymentServiceMock.createPixPayment.mockResolvedValue(mockPayment);

            const result = await controller.createPayment(
                createPaymentDto,
                'idempotency-key-123',
                'correlation-123',
            );

            expect(paymentServiceMock.createPixPayment).toHaveBeenCalledWith(
                createPaymentDto,
                'idempotency-key-123',
                'correlation-123',
            );
            expect(result.id).toBe(mockPayment.id);
            expect(result.status).toBe(mockPayment.status);
            expect(result.amount).toBe(mockPayment.amount);
            expect(result.pix).toBeDefined();
        });

        it('deve lançar BadRequestException quando idempotency-key não fornecido', async () => {
            await expect(
                controller.createPayment(createPaymentDto, ''),
            ).rejects.toThrow(BadRequestException);

            await expect(
                controller.createPayment(createPaymentDto, undefined as any),
            ).rejects.toThrow(BadRequestException);
        });

        it('deve converter data para ISO string', async () => {
            paymentServiceMock.createPixPayment.mockResolvedValue(mockPayment);

            const result = await controller.createPayment(
                createPaymentDto,
                'idempotency-key-123',
            );

            expect(result.created_at).toBe(mockPayment.created_at.toISOString());
        });

        it('deve incluir dados PIX quando disponível', async () => {
            paymentServiceMock.createPixPayment.mockResolvedValue(mockPayment);

            const result = await controller.createPayment(
                createPaymentDto,
                'idempotency-key-123',
            );

            expect(result.pix).toEqual({
                qr_code: mockPayment.pix_qr_code,
                qr_code_base64: mockPayment.pix_qr_code_base64 || '',
                expiration: mockPayment.pix_expiration?.toISOString() || '',
            });
        });

        it('deve não incluir dados PIX quando não disponível', async () => {
            const paymentWithoutPix = { ...mockPayment, pix_qr_code: null };
            paymentServiceMock.createPixPayment.mockResolvedValue(paymentWithoutPix);

            const result = await controller.createPayment(
                createPaymentDto,
                'idempotency-key-123',
            );

            expect(result.pix).toBeUndefined();
        });

        it('deve lidar com pix_qr_code_base64 null', async () => {
            const paymentWithoutBase64 = { ...mockPayment, pix_qr_code_base64: null };
            paymentServiceMock.createPixPayment.mockResolvedValue(paymentWithoutBase64);

            const result = await controller.createPayment(
                createPaymentDto,
                'idempotency-key-123',
            );

            expect(result.pix?.qr_code_base64).toBe('');
        });

        it('deve lidar com pix_expiration null', async () => {
            const paymentWithoutExpiration = { ...mockPayment, pix_expiration: null };
            paymentServiceMock.createPixPayment.mockResolvedValue(paymentWithoutExpiration);

            const result = await controller.createPayment(
                createPaymentDto,
                'idempotency-key-123',
            );

            expect(result.pix?.expiration).toBe('');
        });
    });

    describe('getPayment', () => {
        it('deve retornar pagamento existente', async () => {
            paymentServiceMock.getPayment.mockResolvedValue(mockPayment);

            const result = await controller.getPayment(mockPayment.id, 'correlation-123');

            expect(paymentServiceMock.getPayment).toHaveBeenCalledWith(mockPayment.id);
            expect(result.id).toBe(mockPayment.id);
            expect(result.status).toBe(mockPayment.status);
            expect(result.amount).toBe(mockPayment.amount);
        });

        it('deve converter data para ISO string', async () => {
            paymentServiceMock.getPayment.mockResolvedValue(mockPayment);

            const result = await controller.getPayment(mockPayment.id);

            expect(result.created_at).toBe(mockPayment.created_at.toISOString());
        });

        it('deve incluir dados PIX quando disponível', async () => {
            paymentServiceMock.getPayment.mockResolvedValue(mockPayment);

            const result = await controller.getPayment(mockPayment.id);

            expect(result.pix).toBeDefined();
            expect(result.pix?.qr_code).toBe(mockPayment.pix_qr_code);
        });

        it('deve não incluir dados PIX quando não disponível', async () => {
            const paymentWithoutPix = { ...mockPayment, pix_qr_code: null };
            paymentServiceMock.getPayment.mockResolvedValue(paymentWithoutPix);

            const result = await controller.getPayment(mockPayment.id);

            expect(result.pix).toBeUndefined();
        });
    });

    describe('toResponse', () => {
        it('deve converter Payment para PaymentResponse corretamente', async () => {
            paymentServiceMock.getPayment.mockResolvedValue(mockPayment);

            const result = await controller.getPayment(mockPayment.id);

            expect(result).toHaveProperty('id');
            expect(result).toHaveProperty('status');
            expect(result).toHaveProperty('amount');
            expect(result).toHaveProperty('currency');
            expect(result).toHaveProperty('created_at');
        });

        it('deve manter moeda padrão BRL', async () => {
            paymentServiceMock.getPayment.mockResolvedValue(mockPayment);

            const result = await controller.getPayment(mockPayment.id);

            expect(result.currency).toBe('BRL');
        });
    });
});
