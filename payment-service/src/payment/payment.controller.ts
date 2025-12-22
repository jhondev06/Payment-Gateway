import {
    Controller,
    Post,
    Get,
    Param,
    Body,
    Headers,
    HttpCode,
    HttpStatus,
    BadRequestException,
} from '@nestjs/common';
import { PaymentService } from './payment.service';
import { CreatePaymentDto, Payment, PaymentResponse } from './payment.dto';
import { Logger } from '../shared/logger';

/**
 * Controller de Pagamentos
 * 
 * Responsável pelos endpoints REST de pagamentos.
 */
@Controller('payments')
export class PaymentController {
    private readonly logger = new Logger('PaymentController');

    constructor(private readonly paymentService: PaymentService) { }

    /**
     * POST /payments
     * Cria um novo pagamento PIX
     */
    @Post()
    @HttpCode(HttpStatus.CREATED)
    async createPayment(
        @Body() dto: CreatePaymentDto,
        @Headers('idempotency-key') idempotencyKey: string,
        @Headers('x-correlation-id') correlationId?: string,
    ): Promise<PaymentResponse> {

        if (!idempotencyKey) {
            throw new BadRequestException('Header Idempotency-Key é obrigatório');
        }

        this.logger.info('Criando pagamento', {
            amount: dto.amount,
            idempotencyKey,
            correlationId,
        });

        const payment = await this.paymentService.createPixPayment(
            dto,
            idempotencyKey,
            correlationId,
        );

        return this.toResponse(payment);
    }

    /**
     * GET /payments/:id
     * Retorna um pagamento pelo ID
     */
    @Get(':id')
    async getPayment(
        @Param('id') id: string,
        @Headers('x-correlation-id') correlationId?: string,
    ): Promise<PaymentResponse> {

        this.logger.debug('Buscando pagamento', { paymentId: id, correlationId });

        const payment = await this.paymentService.getPayment(id);
        return this.toResponse(payment);
    }

    /**
     * Converte Payment para PaymentResponse
     */
    private toResponse(payment: Payment): PaymentResponse {
        const response: PaymentResponse = {
            id: payment.id,
            status: payment.status,
            amount: payment.amount,
            currency: payment.currency,
            created_at: payment.created_at.toISOString(),
        };

        if (payment.pix_qr_code) {
            response.pix = {
                qr_code: payment.pix_qr_code,
                qr_code_base64: payment.pix_qr_code_base64 || '',
                expiration: payment.pix_expiration?.toISOString() || '',
            };
        }

        return response;
    }
}
