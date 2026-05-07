import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PaymentService } from '../payment/payment.service';
import { DatabaseService } from '../infra/database/database.service';
import { MercadoPagoProvider } from '../infra/mercadopago/mercadopago.provider';
import { Logger } from '../shared/logger';
import { getSecretValue } from '../shared/secrets.validator';

interface MercadoPagoWebhookPayload {
    id: string;
    live_mode: boolean;
    type: string;
    date_created: string;
    user_id: string;
    api_version: string;
    action: string;
    data: {
        id: string;
    };
}

@Injectable()
export class WebhookService {
    private readonly logger = new Logger('WebhookService');
    public readonly webhookSecret = getSecretValue('MP_WEBHOOK_SECRET') || '';

    constructor(
        private readonly paymentService: PaymentService,
        private readonly db: DatabaseService,
        private readonly mpProvider: MercadoPagoProvider,
    ) { }

    /**
     * Processa webhook do Mercado Pago
     */
    async processWebhook(
        payload: MercadoPagoWebhookPayload,
        signature: string,
        requestId: string,
        rawBody?: string,
    ): Promise<void> {

        // 1. Validate webhook signature
        if (!this.webhookSecret) {
            this.logger.warn('Webhook secret não configurado, pulando validação');
        } else if (!signature) {
            this.logger.warn('Webhook recebido sem assinatura, rejeitando');
            throw new UnauthorizedException('Missing webhook signature');
        } else if (!rawBody) {
            this.logger.warn('Raw body não disponível, não é possível validar assinatura');
            throw new UnauthorizedException('Cannot validate signature without raw body');
        } else {
            const isValid = this.mpProvider.validateWebhookSignature(
                rawBody,
                signature,
                this.webhookSecret,
            );

            if (!isValid) {
                this.logger.warn('Assinatura de webhook inválida', {
                    signature,
                    requestId,
                });
                throw new UnauthorizedException('Invalid webhook signature');
            }

            this.logger.info('Assinatura de webhook validada com sucesso', { requestId });
        }

        // 2. Check for duplicate (idempotency)
        const isDuplicate = await this.isDuplicateEvent(payload.id);
        if (isDuplicate) {
            this.logger.info('Duplicate webhook ignored', { eventId: payload.id });
            return;
        }

        // 3. Store raw event for audit
        await this.storeProviderEvent(payload, signature);

        // 4. Route by event type
        if (payload.type === 'payment') {
            await this.handlePaymentEvent(payload);
        }

        // 5. Mark event as processed
        await this.markEventProcessed(payload.id);
    }

    /**
     * Processa evento de pagamento
     */
    private async handlePaymentEvent(payload: MercadoPagoWebhookPayload): Promise<void> {
        const externalId = payload.data.id;

        // Map action to status
        let status: 'PAID' | 'FAILED' | 'EXPIRED' | 'CANCELLED' | null = null;

        switch (payload.action) {
            case 'payment.created':
                // Already PENDING, no action needed
                return;
            case 'payment.updated':
                // Need to fetch payment status from MP API
                // For now, assume payment was successful
                status = 'PAID';
                break;
            case 'payment.approved':
                status = 'PAID';
                break;
            case 'payment.rejected':
            case 'payment.cancelled':
                status = 'FAILED';
                break;
            case 'payment.expired':
                status = 'EXPIRED';
                break;
            default:
                this.logger.warn('Unknown payment action', { action: payload.action });
                return;
        }

        if (status) {
            await this.paymentService.updatePaymentStatus(externalId, status);
        }
    }

    /**
     * Armazena evento bruto para auditoria
     */
    private async storeProviderEvent(
        payload: MercadoPagoWebhookPayload,
        signature: string,
    ): Promise<void> {
        try {
            await this.db.query(`
        INSERT INTO provider_events (provider, event_id, event_type, payload, signature)
        VALUES ($1, $2, $3, $4, $5)
      `, [
                'mercadopago',
                payload.id,
                payload.type,
                JSON.stringify(payload),
                signature,
            ]);
        } catch (error) {
            this.logger.error('Failed to store provider event', error);
        }
    }

    /**
     * Verifica se evento já foi processado
     */
    private async isDuplicateEvent(eventId: string): Promise<boolean> {
        const result = await this.db.query(
            'SELECT id FROM provider_events WHERE event_id = $1 AND processed = true',
            [eventId],
        );
        return result.rows.length > 0;
    }

    /**
     * Marca evento como processado
     */
    private async markEventProcessed(eventId: string): Promise<void> {
        try {
            await this.db.query(
                'UPDATE provider_events SET processed = true, processed_at = NOW() WHERE event_id = $1',
                [eventId],
            );
        } catch (error) {
            this.logger.error('Failed to mark event as processed', error as Error, { eventId });
        }
    }
}
