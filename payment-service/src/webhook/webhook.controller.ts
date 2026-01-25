import {
    Controller,
    Post,
    Body,
    Headers,
    HttpCode,
    HttpStatus,
    RawBodyRequest,
    Req,
} from '@nestjs/common';
import { Request } from 'express';
import { WebhookService } from './webhook.service';
import { Logger } from '../shared/logger';

@Controller('webhooks')
export class WebhookController {
    private readonly logger = new Logger('WebhookController');

    constructor(private readonly webhookService: WebhookService) { }

    /**
     * POST /webhooks/mercadopago
     * Recebe notificações do Mercado Pago
     */
    @Post('mercadopago')
    @HttpCode(HttpStatus.OK)
    async handleMercadoPagoWebhook(
        @Req() req: RawBodyRequest<Request>,
        @Body() body: any,
        @Headers('x-signature') signature: string,
        @Headers('x-request-id') requestId: string,
    ) {
        this.logger.info('Webhook received from MercadoPago', {
            requestId,
            type: body.type,
            action: body.action,
        });

        const rawBody = req.raw?.toString() || req.body;

        try {
            await this.webhookService.processWebhook(body, signature, requestId, rawBody);
        } catch (error) {
            this.logger.error('Failed to process webhook', error, { requestId });
            throw error;
        }

        return { status: 'ok' };
    }
}
