import { Injectable } from '@nestjs/common';
import { Logger } from './logger';

interface AlertConfig {
    webhookUrl: string;
    enabled: boolean;
}

interface AlertPayload {
    title: string;
    text: string;
    color: string;
    fields: Array<{ title: string; value: string; short?: boolean }>;
}

/**
 * Service de Alertas para Slack
 */
@Injectable()
export class AlertService {
    private readonly logger = new Logger('AlertService');
    private readonly config: AlertConfig;

    constructor() {
        this.config = {
            webhookUrl: process.env.SLACK_WEBHOOK_URL || '',
            enabled: !!process.env.SLACK_WEBHOOK_URL,
        };

        if (this.config.enabled) {
            this.logger.info('Alert service enabled', { webhook: this.config.webhookUrl });
        } else {
            this.logger.warn('Alert service disabled (no webhook URL)');
        }
    }

    /**
     * Envia alerta para Slack
     */
    async sendAlert(payload: AlertPayload): Promise<void> {
        if (!this.config.enabled) {
            this.logger.debug('Alert service disabled, skipping', { title: payload.title });
            return;
        }

        const slackPayload = {
            attachments: [
                {
                    color: payload.color,
                    title: payload.title,
                    text: payload.text,
                    fields: payload.fields,
                    footer: 'Payment Gateway',
                    ts: Math.floor(Date.now() / 1000),
                },
            ],
        };

        try {
            const response = await fetch(this.config.webhookUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(slackPayload),
            });

            if (!response.ok) {
                throw new Error(`Slack webhook failed: ${response.statusText}`);
            }

            this.logger.info('Alert sent to Slack', { title: payload.title });
        } catch (error) {
            this.logger.error('Failed to send alert to Slack', error as Error, {
                title: payload.title,
            });
        }
    }

    /**
     * Alerta de erro crítico
     */
    async sendCriticalAlert(
        title: string,
        message: string,
        context?: Record<string, unknown>,
    ): Promise<void> {
        const fields = [
            { title: 'Level', value: 'CRITICAL', short: true },
            { title: 'Service', value: 'Payment Gateway', short: true },
        ];

        if (context) {
            Object.entries(context).forEach(([key, value]) => {
                fields.push({ title: key, value: String(value), short: false });
            });
        }

        await this.sendAlert({
            title: `🚨 ${title}`,
            text: message,
            color: 'danger',
            fields,
        });
    }

    /**
     * Alerta de erro
     */
    async sendErrorAlert(
        title: string,
        message: string,
        context?: Record<string, unknown>,
    ): Promise<void> {
        const fields = [
            { title: 'Level', value: 'ERROR', short: true },
            { title: 'Service', value: 'Payment Gateway', short: true },
        ];

        if (context) {
            Object.entries(context).forEach(([key, value]) => {
                fields.push({ title: key, value: String(value), short: false });
            });
        }

        await this.sendAlert({
            title: `❌ ${title}`,
            text: message,
            color: 'warning',
            fields,
        });
    }

    /**
     * Alerta de warning
     */
    async sendWarningAlert(
        title: string,
        message: string,
        context?: Record<string, unknown>,
    ): Promise<void> {
        const fields = [
            { title: 'Level', value: 'WARNING', short: true },
            { title: 'Service', value: 'Payment Gateway', short: true },
        ];

        if (context) {
            Object.entries(context).forEach(([key, value]) => {
                fields.push({ title: key, value: String(value), short: false });
            });
        }

        await this.sendAlert({
            title: `⚠️ ${title}`,
            text: message,
            color: '#ff9900',
            fields,
        });
    }

    /**
     * Alerta de info
     */
    async sendInfoAlert(
        title: string,
        message: string,
        context?: Record<string, unknown>,
    ): Promise<void> {
        const fields = [
            { title: 'Level', value: 'INFO', short: true },
            { title: 'Service', value: 'Payment Gateway', short: true },
        ];

        if (context) {
            Object.entries(context).forEach(([key, value]) => {
                fields.push({ title: key, value: String(value), short: false });
            });
        }

        await this.sendAlert({
            title: `ℹ️ ${title}`,
            text: message,
            color: 'good',
            fields,
        });
    }
}
