import { Module, Global } from '@nestjs/common';
import { DatabaseService } from './database/database.service';
import { RedisService } from './redis/redis.service';
import { EventPublisher } from './rabbitmq/event.publisher';
import { MercadoPagoProvider } from './mercadopago/mercadopago.provider';

/**
 * Módulo de Infraestrutura Global
 * 
 * Exporta serviços compartilhados para todos os módulos.
 */
@Global()
@Module({
    providers: [
        DatabaseService,
        RedisService,
        EventPublisher,
        MercadoPagoProvider,
    ],
    exports: [
        DatabaseService,
        RedisService,
        EventPublisher,
        MercadoPagoProvider,
    ],
})
export class InfraModule { }
