import { Injectable, OnModuleDestroy } from '@nestjs/common';
import * as amqp from 'amqplib';
import { Logger } from '../../shared/logger';

/**
 * Publicador de eventos para RabbitMQ
 * 
 * Responsável por publicar eventos de pagamento para as filas.
 * Usa conexão lazy para não bloquear startup se RabbitMQ indisponível.
 */
@Injectable()
export class EventPublisher implements OnModuleDestroy {
    private connection: amqp.ChannelModel | null = null;
    private channel: amqp.Channel | null = null;
    private readonly logger = new Logger('EventPublisher');
    private connecting = false;

    /**
     * Conecta ao RabbitMQ (lazy - chamado na primeira publicação)
     */
    private async connect(): Promise<boolean> {
        if (this.channel) return true;
        if (this.connecting) return false;

        this.connecting = true;
        const url = process.env.RABBITMQ_URL || 'amqp://localhost:5672';

        try {
            this.connection = await amqp.connect(url);
            this.channel = await this.connection.createChannel();

            // Declara exchanges e filas
            await this.setupTopology();

            this.connection.on('error', (err: Error) => {
                this.logger.error('Erro de conexão RabbitMQ', err);
                this.channel = null;
                this.connection = null;
            });

            this.connection.on('close', () => {
                this.logger.warn('Conexão RabbitMQ fechada');
                this.channel = null;
                this.connection = null;
            });

            this.logger.info('RabbitMQ conectado');
            this.connecting = false;
            return true;
        } catch (error) {
            this.logger.warn('RabbitMQ indisponível, eventos serão apenas logados', {
                error: (error as Error).message,
            });
            this.connecting = false;
            return false;
        }
    }

    /**
     * Configura exchanges e filas
     */
    private async setupTopology(): Promise<void> {
        if (!this.channel) return;

        // Exchange de eventos de pagamento
        await this.channel.assertExchange('payment.events', 'topic', { durable: true });

        // Exchange de Dead Letter Queue
        await this.channel.assertExchange('payment.dlx', 'topic', { durable: true });

        // Fila DLQ para mensagens que falharam após todos os retries
        await this.channel.assertQueue('payment.dlq', {
            durable: true,
        });
        await this.channel.bindQueue('payment.dlq', 'payment.dlx', '#');

        // Filas principais com DLX configurado
        await this.channel.assertQueue('notification.events', {
            durable: true,
            arguments: {
                'x-dead-letter-exchange': 'payment.dlx',
                'x-dead-letter-routing-key': 'notification.dead',
                'x-message-ttl': 86400000,
            },
        });
        await this.channel.assertQueue('email.events', {
            durable: true,
            arguments: {
                'x-dead-letter-exchange': 'payment.dlx',
                'x-dead-letter-routing-key': 'email.dead',
                'x-message-ttl': 86400000,
            },
        });

        // Bindings
        await this.channel.bindQueue('notification.events', 'payment.events', 'payment.*');
        await this.channel.bindQueue('email.events', 'payment.events', 'payment.*');

        this.logger.info('Topologia RabbitMQ configurada (com DLQ)');
    }

    /**
     * Publica evento no exchange
     */
    async publish(exchange: string, event: Record<string, unknown>): Promise<void> {
        // Tenta conectar se não conectado
        const connected = await this.connect();

        if (!connected || !this.channel) {
            // Degradação graciosa - apenas loga o evento
            this.logger.info('Evento logado (RabbitMQ indisponível)', {
                exchange,
                eventType: event.type,
                paymentId: event.payment_id,
            });
            return;
        }

        const routingKey = `payment.${(event.type as string || 'unknown').toLowerCase()}`;
        const message = Buffer.from(JSON.stringify(event));

        try {
            this.channel.publish(exchange, routingKey, message, {
                persistent: true,
                contentType: 'application/json',
                timestamp: Date.now(),
            });

            this.logger.debug('Evento publicado', {
                exchange,
                routingKey,
                eventType: event.type,
            });
        } catch (error) {
            this.logger.error('Falha ao publicar evento', error, { exchange, event });
        }
    }

    /**
     * Health check
     */
    async isHealthy(): Promise<boolean> {
        return this.connection !== null && this.channel !== null;
    }

    async onModuleDestroy() {
        if (this.channel) {
            await this.channel.close();
        }
        if (this.connection) {
            await this.connection.close();
        }
        this.logger.info('RabbitMQ desconectado');
    }
}
