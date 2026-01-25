import { WebhookService } from './webhook.service';

describe('WebhookService', () => {
    let service: WebhookService;
    let paymentServiceMock: any;
    let dbMock: any;

    beforeEach(() => {
        paymentServiceMock = {
            updatePaymentStatus: jest.fn(),
        };

        dbMock = {
            query: jest.fn(),
        };

        service = new WebhookService(paymentServiceMock, dbMock);
    });

    describe('processWebhook', () => {
        const mockPayload: any = {
            id: 'evt-123',
            type: 'payment',
            action: 'payment.approved',
            data: { id: 'mp-456' },
            live_mode: false,
            date_created: '2025-01-25T10:00:00Z',
            user_id: 'user-123',
            api_version: 'v1',
        };

        it('deve processar evento de pagamento aprovado', async () => {
            dbMock.query
                .mockResolvedValueOnce({ rows: [], rowCount: 1 })
                .mockResolvedValueOnce({ rows: [], rowCount: 0 });

            await service.processWebhook(mockPayload, '', 'req-1', 'raw-body');

            expect(paymentServiceMock.updatePaymentStatus).toHaveBeenCalledWith('mp-456', 'PAID');
        });

        it('deve processar evento de pagamento rejeitado', async () => {
            const rejectedPayload = { ...mockPayload, action: 'payment.rejected' };
            dbMock.query
                .mockResolvedValueOnce({ rows: [], rowCount: 1 })
                .mockResolvedValueOnce({ rows: [], rowCount: 0 });

            await service.processWebhook(rejectedPayload, '', 'req-1', 'raw-body');

            expect(paymentServiceMock.updatePaymentStatus).toHaveBeenCalledWith('mp-456', 'FAILED');
        });

        it('deve processar evento de pagamento expirado', async () => {
            const expiredPayload = { ...mockPayload, action: 'payment.expired' };
            dbMock.query
                .mockResolvedValueOnce({ rows: [], rowCount: 1 })
                .mockResolvedValueOnce({ rows: [], rowCount: 0 });

            await service.processWebhook(expiredPayload, '', 'req-1', 'raw-body');

            expect(paymentServiceMock.updatePaymentStatus).toHaveBeenCalledWith('mp-456', 'EXPIRED');
        });

        it('deve processar evento de pagamento cancelado', async () => {
            const cancelledPayload = { ...mockPayload, action: 'payment.cancelled' };
            dbMock.query
                .mockResolvedValueOnce({ rows: [], rowCount: 1 })
                .mockResolvedValueOnce({ rows: [], rowCount: 0 });

            await service.processWebhook(cancelledPayload, '', 'req-1', 'raw-body');

            expect(paymentServiceMock.updatePaymentStatus).toHaveBeenCalledWith('mp-456', 'FAILED');
        });

        it('deve ignorar evento payment.created', async () => {
            const createdPayload = { ...mockPayload, action: 'payment.created' };
            dbMock.query
                .mockResolvedValueOnce({ rows: [], rowCount: 1 })
                .mockResolvedValueOnce({ rows: [], rowCount: 0 });

            await service.processWebhook(createdPayload, '', 'req-1', 'raw-body');

            expect(paymentServiceMock.updatePaymentStatus).not.toHaveBeenCalled();
        });

        it('deve processar payment.updated como PAID', async () => {
            const updatedPayload = { ...mockPayload, action: 'payment.updated' };
            dbMock.query
                .mockResolvedValueOnce({ rows: [], rowCount: 1 })
                .mockResolvedValueOnce({ rows: [], rowCount: 0 });

            await service.processWebhook(updatedPayload, '', 'req-1', 'raw-body');

            expect(paymentServiceMock.updatePaymentStatus).toHaveBeenCalledWith('mp-456', 'PAID');
        });

        it('deve logar warning para action desconhecida', async () => {
            const unknownPayload = { ...mockPayload, action: 'payment.unknown' };
            dbMock.query
                .mockResolvedValueOnce({ rows: [], rowCount: 1 })
                .mockResolvedValueOnce({ rows: [], rowCount: 0 });

            await service.processWebhook(unknownPayload, '', 'req-1', 'raw-body');

            expect(paymentServiceMock.updatePaymentStatus).not.toHaveBeenCalled();
        });

        it('deve ignorar eventos não-payment', async () => {
            const nonPaymentPayload = { ...mockPayload, type: 'preapproval', action: 'created' };
            dbMock.query
                .mockResolvedValueOnce({ rows: [], rowCount: 1 })
                .mockResolvedValueOnce({ rows: [], rowCount: 0 });

            await service.processWebhook(nonPaymentPayload, '', 'req-1', 'raw-body');

            expect(paymentServiceMock.updatePaymentStatus).not.toHaveBeenCalled();
        });

        it('deve ignorar evento duplicado', async () => {
            dbMock.query
                .mockResolvedValueOnce({ rows: [], rowCount: 1 })
                .mockResolvedValueOnce({ rows: [{ id: 1 }], rowCount: 1 });

            await service.processWebhook(mockPayload, '', 'req-1', 'raw-body');

            expect(paymentServiceMock.updatePaymentStatus).not.toHaveBeenCalled();
        });
    });

    describe('storeProviderEvent', () => {
        it('deve lidar com erro ao armazenar evento', async () => {
            dbMock.query.mockRejectedValue(new Error('Database error'));

            const mockPayload: any = {
                id: 'evt-123',
                type: 'payment',
                action: 'payment.approved',
                data: { id: 'mp-456' },
                live_mode: false,
                date_created: '2025-01-25T10:00:00Z',
                user_id: 'user-123',
                api_version: 'v1',
            };

            await expect(service.processWebhook(mockPayload, '', 'req-1')).resolves.not.toThrow();
        });
    });
});
