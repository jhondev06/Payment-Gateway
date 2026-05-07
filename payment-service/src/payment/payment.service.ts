import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { CreatePaymentDto, Payment, PaymentEvent, PaymentStatus } from './payment.dto';
import { IdempotencyService } from './idempotency.service';
import { PaymentRepository } from './payment.repository';
import { MercadoPagoProvider } from '../infra/mercadopago/mercadopago.provider';
import { EventPublisher } from '../infra/rabbitmq/event.publisher';
import { Logger } from '../shared/logger';
import { MetricsService } from '../shared/metrics.service';
import { AlertService } from '../shared/alert.service';

/**
 * Transições válidas da máquina de estados de pagamento
 */
const VALID_TRANSITIONS: Record<PaymentStatus, PaymentStatus[]> = {
    CREATED: ['PENDING', 'FAILED'],
    PENDING: ['PAID', 'FAILED', 'EXPIRED', 'CANCELLED'],
    PAID: ['REFUNDED'],
    FAILED: ['CREATED'],
    EXPIRED: ['CREATED'],
    REFUNDED: [],
    CANCELLED: ['CREATED'],
};

@Injectable()
export class PaymentService {
    private readonly logger = new Logger('PaymentService');

    constructor(
        private readonly idempotencyService: IdempotencyService,
        private readonly paymentRepository: PaymentRepository,
        private readonly mercadoPago: MercadoPagoProvider,
        private readonly eventPublisher: EventPublisher,
        private readonly metricsService: MetricsService,
        private readonly alertService: AlertService,
    ) { }

    /**
     * Cria um pagamento PIX
     * 
     * Fluxo:
     * 1. Valida Idempotency-Key
     * 2. Cria payment = CREATED
     * 3. Chama Mercado Pago
     * 4. Atualiza para PENDING
     * 5. Publica evento
     */
    async createPixPayment(
        dto: CreatePaymentDto,
        idempotencyKey: string,
        correlationId?: string,
    ): Promise<Payment> {
        const startTime = Date.now();

        // 1. Verifica idempotência - retorna resposta do cache se existir
        const cached = await this.idempotencyService.get(idempotencyKey);
        if (cached) {
            this.logger.info('Retornando pagamento do cache (idempotência)', {
                idempotencyKey,
                paymentId: cached.id,
            });
            return cached;
        }

        // 2. Cria registro de pagamento com status CREATED
        const payment = await this.paymentRepository.create({
            idempotency_key: idempotencyKey,
            amount: dto.amount,
            currency: 'BRL',
            status: 'CREATED',
            payment_method: 'pix',
            customer_email: dto.customer_email || null,
            customer_name: dto.customer_name || null,
            description: dto.description || null,
            metadata: dto.metadata || {},
        });

        this.logger.info('Pagamento criado', {
            paymentId: payment.id,
            status: payment.status,
            amount: payment.amount,
        });

        this.metricsService.incrementPaymentsCreated('BRL', 'pix');

        try {
            // 3. Chama Mercado Pago para criar PIX
            const pixData = await this.mercadoPago.createPixPayment({
                amount: dto.amount,
                description: dto.description || 'Pagamento',
                email: dto.customer_email || 'cliente@exemplo.com',
                external_reference: payment.id,
            });

            // 4. Atualiza pagamento com dados do PIX e status PENDING
            const updatedPayment = await this.paymentRepository.update(payment.id, {
                external_id: pixData.id,
                status: 'PENDING',
                pix_qr_code: pixData.qr_code,
                pix_qr_code_base64: pixData.qr_code_base64,
                pix_expiration: pixData.expiration,
            });

            // 5. Salva resposta no cache para idempotência
            await this.idempotencyService.set(idempotencyKey, updatedPayment);

            // 6. Publica evento (FORA da transação)
            await this.publishEvent({
                type: 'PAYMENT_CREATED',
                payment_id: updatedPayment.id,
                status: updatedPayment.status,
                amount: updatedPayment.amount,
                timestamp: new Date().toISOString(),
                metadata: {
                    customer_email: dto.customer_email,
                    customer_name: dto.customer_name,
                    description: dto.description,
                    ...dto.metadata,
                },
            });

            const duration = (Date.now() - startTime) / 1000;
            this.metricsService.observePaymentProcessing(duration, 'BRL', 'pix');

            this.logger.info('Pagamento pendente (PIX gerado)', {
                paymentId: updatedPayment.id,
                externalId: pixData.id,
            });

            return updatedPayment;

        } catch (error) {
            // Marca como FAILED se provedor falhar
            await this.paymentRepository.update(payment.id, {
                status: 'FAILED',
                metadata: {
                    ...payment.metadata,
                    error: error instanceof Error ? error.message : 'Erro desconhecido',
                },
            });

            const duration = (Date.now() - startTime) / 1000;
            this.metricsService.incrementPaymentsFailed('BRL', 'provider_error');
            this.metricsService.observePaymentProcessing(duration, 'BRL', 'pix');

            this.alertService.sendErrorAlert(
                'Falha ao criar pagamento PIX',
                error instanceof Error ? error.message : 'Erro desconhecido',
                { paymentId: payment.id, amount: dto.amount },
            );

            this.logger.error('Falha ao criar pagamento PIX', error, {
                paymentId: payment.id,
            });

            throw error;
        }
    }

    /**
     * Busca um pagamento pelo ID
     */
    async getPayment(id: string): Promise<Payment> {
        const payment = await this.paymentRepository.findById(id);

        if (!payment) {
            throw new NotFoundException(`Pagamento ${id} não encontrado`);
        }

        return payment;
    }

    /**
     * Atualiza status do pagamento (chamado pelo webhook)
     */
    async updatePaymentStatus(
        externalId: string,
        status: 'PAID' | 'FAILED' | 'EXPIRED' | 'CANCELLED',
    ): Promise<Payment> {
        const payment = await this.paymentRepository.findByExternalId(externalId);

        if (!payment) {
            throw new NotFoundException(`Pagamento com external_id ${externalId} não encontrado`);
        }

        // Valida transição da máquina de estados
        const allowedTransitions = VALID_TRANSITIONS[payment.status] || [];
        if (!allowedTransitions.includes(status)) {
            this.logger.warn('Transição de status inválida', {
                paymentId: payment.id,
                statusAtual: payment.status,
                statusSolicitado: status,
            });
            throw new ConflictException(
                `Transição inválida: ${payment.status} -> ${status}`,
            );
        }

        const updatedPayment = await this.paymentRepository.update(payment.id, {
            status,
            paid_at: status === 'PAID' ? new Date() : null,
        });

        const eventType = status === 'PAID' ? 'PAYMENT_COMPLETED' : 'PAYMENT_FAILED';

        // Publica evento
        await this.publishEvent({
            type: eventType,
            payment_id: updatedPayment.id,
            status: updatedPayment.status,
            amount: updatedPayment.amount,
            timestamp: new Date().toISOString(),
            metadata: {
                customer_email: payment.customer_email,
                customer_name: payment.customer_name,
                previous_status: payment.status,
            },
        });

        if (status === 'PAID') {
            this.metricsService.incrementPaymentsCompleted('BRL', payment.payment_method || 'pix');
        } else {
            this.metricsService.incrementPaymentsFailed('BRL', status.toLowerCase());
        }

        this.logger.info('Status do pagamento atualizado', {
            paymentId: payment.id,
            statusAnterior: payment.status,
            novoStatus: status,
        });

        return updatedPayment;
    }

    /**
     * Publica evento no RabbitMQ
     */
    private async publishEvent(event: PaymentEvent): Promise<void> {
        try {
            await this.eventPublisher.publish('payment.events', event);
        } catch (error) {
            // Loga mas não falha a transação
            this.logger.error('Falha ao publicar evento', error, { event });
        }
    }
}
