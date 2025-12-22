import { Module } from '@nestjs/common';
import { PaymentController } from './payment.controller';
import { PaymentService } from './payment.service';
import { IdempotencyService } from './idempotency.service';
import { PaymentRepository } from './payment.repository';

@Module({
    controllers: [PaymentController],
    providers: [
        PaymentService,
        IdempotencyService,
        PaymentRepository,
    ],
    exports: [PaymentService, PaymentRepository],
})
export class PaymentModule { }
