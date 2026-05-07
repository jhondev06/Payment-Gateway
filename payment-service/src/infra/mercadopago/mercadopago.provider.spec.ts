import { MercadoPagoProvider } from './mercadopago.provider';

describe('MercadoPagoProvider', () => {
    let provider: MercadoPagoProvider;
    const originalEnv = process.env;

    const input = {
        amount: 100.5,
        description: 'Test payment',
        email: 'test@example.com',
        external_reference: 'REF-123',
    };

    beforeEach(() => {
        process.env = { ...originalEnv };
        process.env.PAYMENT_MODE = 'sandbox';
        provider = new MercadoPagoProvider();
    });

    afterEach(() => {
        process.env = originalEnv;
    });

    describe('createPixPayment', () => {
        it('deve simular resposta em sandbox', async () => {
            const result = await provider.createPixPayment(input);

            expect(result.id).toMatch(/^SANDBOX-/);
            expect(result.qr_code).toContain('REF-123');
            expect(result.expiration).toBeInstanceOf(Date);
        });

        it('deve lançar erro em produção sem token', async () => {
            process.env.PAYMENT_MODE = 'production';
            delete process.env.MP_ACCESS_TOKEN;
            const prodProvider = new MercadoPagoProvider();

            await expect(prodProvider.createPixPayment(input)).rejects.toThrow(
                'Token de acesso do Mercado Pago não configurado',
            );
        });
    });

    describe('Circuit Breaker', () => {
        it('deve ter circuit breaker configurado', () => {
            expect(provider.getCircuitBreakerState()).toBeDefined();
        });

        it('deve retornar estado closed inicialmente', () => {
            expect(provider.getCircuitBreakerState()).toBe('closed');
        });

        it('deve passar chamadas através do circuit breaker', async () => {
            const result = await provider.createPixPayment(input);

            expect(result.id).toMatch(/^SANDBOX-/);
        });
    });

    describe('validateWebhookSignature', () => {
        const secret = 'test-secret';
        const payload = JSON.stringify({ id: '123', type: 'payment' });

        it('deve validar assinatura correta', () => {
            const crypto = require('crypto');
            const signature = crypto
                .createHmac('sha256', secret)
                .update(payload)
                .digest('hex');

            const isValid = provider.validateWebhookSignature(payload, signature, secret);

            expect(isValid).toBe(true);
        });

        it('deve rejeitar assinatura incorreta', () => {
            const wrongSignature = 'wrong-signature';

            const isValid = provider.validateWebhookSignature(payload, wrongSignature, secret);

            expect(isValid).toBe(false);
        });
    });
});
