import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SandboxController } from './sandbox.controller';
import { PaymentModule } from '../payment/payment.module';

@Module({
    imports: [PaymentModule],
    controllers: [SandboxController],
})
export class SandboxModule { }
