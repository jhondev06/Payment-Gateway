import {
    Controller,
    Post,
    Body,
    HttpCode,
    HttpStatus,
    ForbiddenException,
    InternalServerErrorException,
} from '@nestjs/common';
import { PaymentService } from '../payment/payment.service';
import { Logger } from '../shared/logger';

/**
 * DTO para simulação de webhook
 */
interface SimulateWebhookDto {
    payment_id: string;
    status: 'PAID' | 'FAILED' | 'EXPIRED';
}

/**
 * Controller de Sandbox
 * 
 * SOMENTE disponível quando FEATURE_SANDBOX_ENDPOINTS=true
 * 
 * Permite simular webhooks para facilitar testes sem conta Mercado Pago.
 */
@Controller('sandbox')
export class SandboxController {
    private readonly logger = new Logger('SandboxController');
    private readonly isEnabled: boolean;

    constructor(private readonly paymentService: PaymentService) {
        this.isEnabled = process.env.FEATURE_SANDBOX_ENDPOINTS === 'true';
        this.logger.info('SandboxController inicializado', { isEnabled: this.isEnabled });
    }

    /**
     * POST /sandbox/simulate/webhook
     * 
     * Simula um webhook do Mercado Pago para testes.
     */
    @Post('simulate/webhook')
    @HttpCode(HttpStatus.OK)
    async simulateWebhook(@Body() dto: SimulateWebhookDto) {
        this.checkEnabled();

        this.logger.warn('SANDBOX: Simulando webhook', {
            paymentId: dto.payment_id,
            status: dto.status,
        });

        try {
            const payment = await this.paymentService.getPayment(dto.payment_id);

            if (!payment) {
                return {
                    success: false,
                    error: 'Pagamento não encontrado',
                };
            }

            await this.paymentService.updatePaymentStatus(
                payment.external_id || payment.id,
                dto.status,
            );

            return {
                success: true,
                message: `Pagamento ${dto.payment_id} atualizado para ${dto.status}`,
                payment_id: dto.payment_id,
                new_status: dto.status,
            };
        } catch (error) {
            this.logger.error('SANDBOX: Falha na simulação de webhook', error as Error);
            throw error;
        }
    }

    /**
     * POST /sandbox/simulate/payment
     * 
     * Cria um pagamento de teste completo (útil para testes E2E)
     */
    @Post('simulate/payment')
    @HttpCode(HttpStatus.CREATED)
    async simulatePayment(@Body() dto: { amount: number }) {
        this.checkEnabled();

        this.logger.info('SANDBOX: Criando pagamento simulado', { amount: dto.amount });

        const idempotencyKey = `SANDBOX-${Date.now()}-${Math.random().toString(36).substring(7)}`;

        try {
            const payment = await this.paymentService.createPixPayment(
                {
                    amount: dto.amount || 100.00,
                    description: 'Pagamento de Teste Sandbox',
                    customer_email: 'teste@sandbox.com',
                    customer_name: 'Usuário Sandbox',
                },
                idempotencyKey,
            );

            this.logger.info('SANDBOX: Pagamento criado com sucesso', { paymentId: payment.id });

            return {
                success: true,
                message: 'Pagamento sandbox criado',
                payment,
                idempotency_key: idempotencyKey,
                proximo_passo: 'Use POST /sandbox/simulate/webhook para simular confirmação',
            };
        } catch (error) {
            const err = error as Error;
            this.logger.error('SANDBOX: Falha na criação do pagamento', err, {
                stack: err.stack,
                message: err.message,
            });
            throw new InternalServerErrorException(`Falha ao criar pagamento: ${err.message}`);
        }
    }

    /**
     * Verifica se sandbox está habilitado
     */
    private checkEnabled(): void {
        if (!this.isEnabled) {
            throw new ForbiddenException(
                'Endpoints sandbox desabilitados. Defina FEATURE_SANDBOX_ENDPOINTS=true para habilitar.',
            );
        }
    }
}
