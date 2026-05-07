import { Injectable } from '@nestjs/common';
import { Logger } from '../../shared/logger';
import CircuitBreaker from 'opossum';

interface CreatePixPaymentInput {
    amount: number;
    description: string;
    email: string;
    external_reference: string;
}

interface PixPaymentResult {
    id: string;
    qr_code: string;
    qr_code_base64: string;
    expiration: Date;
}

/**
 * Provider de integração com Mercado Pago
 * 
 * Em modo sandbox, simula respostas para facilitar testes.
 * Em produção, integra com a API real do Mercado Pago.
 * 
 * @todo: Implementar integração real com API do Mercado Pago
 */
@Injectable()
export class MercadoPagoProvider {
    private readonly logger = new Logger('MercadoPagoProvider');
    private readonly isSandbox: boolean;
    private readonly hasValidToken: boolean;
    private readonly circuitBreaker: CircuitBreaker;

    constructor() {
        const accessToken = process.env.MP_ACCESS_TOKEN || '';
        this.isSandbox = process.env.PAYMENT_MODE !== 'production';

        // Token válido: começa com TEST- e tem mais de 20 caracteres
        this.hasValidToken = accessToken.startsWith('TEST-') && accessToken.length > 20;

        this.logger.info('MercadoPago provider inicializado', {
            sandbox: this.isSandbox,
            hasValidToken: this.hasValidToken,
        });

        this.circuitBreaker = new CircuitBreaker(this.createPixPaymentInternal.bind(this), {
            timeout: 5000,
            errorThresholdPercentage: 50,
            resetTimeout: 30000,
        });

        this.circuitBreaker.on('open', () => {
            this.logger.warn('Circuit breaker aberto - Mercado Pago está indisponível');
        });

        this.circuitBreaker.on('halfOpen', () => {
            this.logger.info('Circuit breaker meio-aberto - testando Mercado Pago');
        });

        this.circuitBreaker.on('close', () => {
            this.logger.info('Circuit breaker fechado - Mercado Pago está disponível');
        });

        this.circuitBreaker.on('fallback', (result) => {
            this.logger.warn('Fallback acionado para Mercado Pago', { result });
        });
    }

    /**
     * Cria pagamento PIX no Mercado Pago (com Circuit Breaker)
     */
    async createPixPayment(input: CreatePixPaymentInput): Promise<PixPaymentResult> {
        return this.circuitBreaker.fire(input) as Promise<PixPaymentResult>;
    }

    /**
     * Cria pagamento PIX no Mercado Pago (implementação interna)
     */
    private async createPixPaymentInternal(input: CreatePixPaymentInput): Promise<PixPaymentResult> {
        this.logger.info('Criando pagamento PIX', {
            amount: input.amount,
            externalReference: input.external_reference,
            mode: this.isSandbox ? 'sandbox' : 'production',
        });

        // Em sandbox sem token válido, SEMPRE simula resposta
        if (this.isSandbox && !this.hasValidToken) {
            return this.simulateSandboxResponse(input);
        }

        // Aqui entraria a integração real com Mercado Pago
        // Por enquanto, simula para qualquer caso em sandbox
        if (this.isSandbox) {
            return this.simulateSandboxResponse(input);
        }

        // Produção sem token - erro
        throw new Error('Token de acesso do Mercado Pago não configurado');
    }

    /**
     * Valida assinatura do webhook
     */
    validateWebhookSignature(
        payload: string,
        signature: string,
        secret: string,
    ): boolean {
        const crypto = require('crypto');
        const expectedSignature = crypto
            .createHmac('sha256', secret)
            .update(payload)
            .digest('hex');

        try {
            return crypto.timingSafeEqual(
                Buffer.from(signature),
                Buffer.from(expectedSignature),
            );
        } catch {
            return false;
        }
    }

    /**
     * Simula resposta em sandbox (para testes sem conta MP)
     */
    private simulateSandboxResponse(input: CreatePixPaymentInput): PixPaymentResult {
        this.logger.info('Usando resposta SIMULADA do sandbox');

        const expirationDate = new Date();
        expirationDate.setMinutes(expirationDate.getMinutes() + 30);

        // Gera QR Code fake para sandbox
        const fakeQRCode = `00020126580014br.gov.bcb.pix0136${input.external_reference}5204000053039865802BR5925SANDBOX PAYMENT6009SAO PAULO62070503***6304`;

        return {
            id: `SANDBOX-${Date.now()}`,
            qr_code: fakeQRCode,
            qr_code_base64: Buffer.from(fakeQRCode).toString('base64'),
            expiration: expirationDate,
        };
    }

    /**
     * Health check do circuit breaker
     */
    getCircuitBreakerState(): string {
        if (this.circuitBreaker.opened) return 'open';
        if (this.circuitBreaker.closed) return 'closed';
        return 'half-open';
    }
}
