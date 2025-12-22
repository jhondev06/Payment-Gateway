import { Injectable } from '@nestjs/common';
import { PaymentService } from '../payment/payment.service';
import { DatabaseService } from '../infra/database/database.service';
import { Logger } from '../shared/logger';

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

    constructor(
        private readonly paymentService: PaymentService,
        private readonly db: DatabaseService,
    ) { }

    /**
     * Processa webhook do Mercado Pago
     */
    async processWebhook(
        payload: MercadoPagoWebhookPayload,
        signature: string,
        requestId: string,
    ): Promise<void> {

        // 1. Store raw event for audit
        await this.storeProviderEvent(payload, signature);

        // 2. Check for duplicate (idempotency)
        const isDuplicate = await this.isDuplicateEvent(payload.id);
        if (isDuplicate) {
            this.logger.info('Duplicate webhook ignored', { eventId: payload.id });
            return;
        }

        // 3. Route by event type
        if (payload.type === 'payment') {
            await this.handlePaymentEvent(payload);
        }
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
}
