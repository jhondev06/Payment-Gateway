import { Injectable } from '@nestjs/common';
import * as client from 'prom-client';

/**
 * Service de Métricas Prometheus
 */
@Injectable()
export class MetricsService {
    private readonly register: client.Registry;

    // Counters
    private readonly paymentsCreatedTotal: client.Counter<string>;
    private readonly paymentsCompletedTotal: client.Counter<string>;
    private readonly paymentsFailedTotal: client.Counter<string>;
    private readonly requestsTotal: client.Counter<string>;

    // Histograms
    private readonly paymentProcessingDuration: client.Histogram<string>;
    private readonly requestDuration: client.Histogram<string>;

    // Gauges
    private readonly activeConnections: client.Gauge<string>;
    private readonly queueLength: client.Gauge<string>;
    private readonly circuitBreakerState: client.Gauge<string>;

    constructor() {
        // Create default registry
        client.collectDefaultMetrics({
            register: client.register,
        });

        this.register = client.register;

        // Initialize counters
        this.paymentsCreatedTotal = new client.Counter({
            name: 'payments_created_total',
            help: 'Total de pagamentos criados',
            labelNames: ['currency', 'payment_method'],
            registers: [this.register],
        });

        this.paymentsCompletedTotal = new client.Counter({
            name: 'payments_completed_total',
            help: 'Total de pagamentos completados com sucesso',
            labelNames: ['currency', 'payment_method'],
            registers: [this.register],
        });

        this.paymentsFailedTotal = new client.Counter({
            name: 'payments_failed_total',
            help: 'Total de pagamentos falhados',
            labelNames: ['currency', 'error_type'],
            registers: [this.register],
        });

        this.requestsTotal = new client.Counter({
            name: 'http_requests_total',
            help: 'Total de requisições HTTP',
            labelNames: ['method', 'route', 'status_code'],
            registers: [this.register],
        });

        // Initialize histograms
        this.paymentProcessingDuration = new client.Histogram({
            name: 'payment_processing_duration_seconds',
            help: 'Duração do processamento de pagamento em segundos',
            labelNames: ['currency', 'payment_method'],
            buckets: [0.1, 0.5, 1, 2, 5, 10, 30],
            registers: [this.register],
        });

        this.requestDuration = new client.Histogram({
            name: 'http_request_duration_seconds',
            help: 'Duração da requisição HTTP em segundos',
            labelNames: ['method', 'route'],
            buckets: [0.005, 0.01, 0.05, 0.1, 0.5, 1, 5],
            registers: [this.register],
        });

        // Initialize gauges
        this.activeConnections = new client.Gauge({
            name: 'active_connections',
            help: 'Número de conexões ativas',
            labelNames: ['service'],
            registers: [this.register],
        });

        this.queueLength = new client.Gauge({
            name: 'queue_length',
            help: 'Tamanho da fila de mensagens',
            labelNames: ['queue_name'],
            registers: [this.register],
        });

        this.circuitBreakerState = new client.Gauge({
            name: 'circuit_breaker_state',
            help: 'Estado do circuit breaker',
            labelNames: ['service'],
            registers: [this.register],
        });
    }

    /**
     * Incrementa contador de pagamentos criados
     */
    incrementPaymentsCreated(currency: string, paymentMethod: string): void {
        this.paymentsCreatedTotal.inc({ currency, payment_method: paymentMethod });
    }

    /**
     * Incrementa contador de pagamentos completados
     */
    incrementPaymentsCompleted(currency: string, paymentMethod: string): void {
        this.paymentsCompletedTotal.inc({ currency, payment_method: paymentMethod });
    }

    /**
     * Incrementa contador de pagamentos falhados
     */
    incrementPaymentsFailed(currency: string, errorType: string): void {
        this.paymentsFailedTotal.inc({ currency, error_type: errorType });
    }

    /**
     * Incrementa contador de requisições
     */
    incrementRequests(method: string, route: string, statusCode: number): void {
        this.requestsTotal.inc({
            method,
            route,
            status_code: statusCode.toString(),
        });
    }

    /**
     * Registra duração do processamento de pagamento
     */
    observePaymentProcessing(durationSeconds: number, currency: string, paymentMethod: string): void {
        this.paymentProcessingDuration.observe(
            { currency, payment_method: paymentMethod },
            durationSeconds,
        );
    }

    /**
     * Registra duração da requisição
     */
    observeRequestDuration(durationSeconds: number, method: string, route: string): void {
        this.requestDuration.observe({ method, route }, durationSeconds);
    }

    /**
     * Define número de conexões ativas
     */
    setActiveConnections(service: string, count: number): void {
        this.activeConnections.set({ service }, count);
    }

    /**
     * Define tamanho da fila
     */
    setQueueLength(queueName: string, length: number): void {
        this.queueLength.set({ queue_name: queueName }, length);
    }

    /**
     * Define estado do circuit breaker
     */
    setCircuitBreakerState(service: string, state: 'closed' | 'open' | 'half-open'): void {
        const stateValue = state === 'closed' ? 0 : state === 'open' ? 2 : 1;
        this.circuitBreakerState.set({ service }, stateValue);
    }

    /**
     * Retorna métricas em formato Prometheus
     */
    async getMetrics(): Promise<string> {
        return await this.register.metrics();
    }
}
