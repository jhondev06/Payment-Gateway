import * as amqp from 'amqplib';
import * as nodemailer from 'nodemailer';

const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://localhost:5672';
const FEATURE_EMAIL = process.env.FEATURE_EMAIL === 'true';

const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY = 1000;

/**
 * Logger
 */
function log(level: string, message: string, data?: Record<string, unknown>) {
    console.log(JSON.stringify({
        timestamp: new Date().toISOString(),
        service: 'email-service',
        level,
        message,
        ...data,
    }));
}

/**
 * Email templates
 */
const templates = {
    PAYMENT_CREATED: (data: any) => ({
        subject: `Pagamento criado - ${data.payment_id}`,
        html: `
      <h1>Pagamento PIX Criado</h1>
      <p>Olá!</p>
      <p>Seu pagamento de <strong>R$ ${data.amount.toFixed(2)}</strong> foi criado.</p>
      <p>Escaneie o QR Code PIX para pagar.</p>
      <p>ID do pagamento: ${data.payment_id}</p>
    `,
    }),

    PAYMENT_COMPLETED: (data: any) => ({
        subject: `Pagamento confirmado - ${data.payment_id}`,
        html: `
      <h1>Pagamento Confirmado!</h1>
      <p>Seu pagamento de <strong>R$ ${data.amount.toFixed(2)}</strong> foi confirmado.</p>
      <p>Obrigado!</p>
      <p>ID do pagamento: ${data.payment_id}</p>
    `,
    }),

    PAYMENT_FAILED: (data: any) => ({
        subject: `Pagamento falhou - ${data.payment_id}`,
        html: `
      <h1>Pagamento Não Realizado</h1>
      <p>Infelizmente seu pagamento de <strong>R$ ${data.amount.toFixed(2)}</strong> não foi concluído.</p>
      <p>Por favor, tente novamente.</p>
      <p>ID do pagamento: ${data.payment_id}</p>
    `,
    }),
};

/**
 * Create email transporter
 */
function createTransporter() {
    // Use ethereal.email for testing if no SMTP configured
    if (!process.env.SMTP_HOST) {
        log('WARN', 'No SMTP configured, using console output');
        return null;
    }

    return nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587', 10),
        secure: process.env.SMTP_PORT === '465',
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
        },
    });
}

/**
 * Send email
 */
async function sendEmail(
    transporter: nodemailer.Transporter | null,
    to: string,
    template: { subject: string; html: string },
) {
    if (!transporter) {
        log('INFO', 'Email would be sent (dry run)', { to, subject: template.subject });
        return;
    }

    await transporter.sendMail({
        from: process.env.EMAIL_FROM || 'noreply@gateway.com',
        to,
        subject: template.subject,
        html: template.html,
    });

    log('INFO', 'Email sent', { to, subject: template.subject });
}

/**
 * Process payment event
 */
async function handlePaymentEvent(
    transporter: nodemailer.Transporter | null,
    event: Record<string, unknown>,
) {
    const eventType = event.type as keyof typeof templates;
    const email = (event.metadata as any)?.customer_email;

    if (!email) {
        log('WARN', 'No customer email in event, skipping', { eventType });
        return;
    }

    const templateFn = templates[eventType];
    if (!templateFn) {
        log('WARN', 'No template for event type', { eventType });
        return;
    }

    const template = templateFn(event);
    await sendEmail(transporter, email, template);
}

/**
 * Setup RabbitMQ consumer with exponential backoff retry
 */
async function setupRabbitMQWithRetry(
    transporter: nodemailer.Transporter | null,
    retryCount = 0,
): Promise<void> {
    try {
        const connection = await amqp.connect(RABBITMQ_URL);
        const channel = await connection.createChannel();

        await channel.assertQueue('email.events', { durable: true });
        await channel.prefetch(5);

        channel.consume('email.events', async (msg) => {
            if (!msg) return;

            try {
                const event = JSON.parse(msg.content.toString());
                await handlePaymentEvent(transporter, event);
                channel.ack(msg);
            } catch (error) {
                log('ERROR', 'Failed to process message', {
                    error: (error as Error).message,
                    retryCount: (msg.fields.headers['x-retry-count'] as number) || 0,
                });

                const currentRetryCount = (msg.fields.headers['x-retry-count'] as number) || 0;

                if (currentRetryCount >= MAX_RETRIES) {
                    log('ERROR', 'Max retries reached, moving to DLQ');
                    // Don't requeue - will go to DLQ if configured
                    channel.nack(msg, false, false);
                } else {
                    // Requeue with exponential backoff delay
                    const delay = INITIAL_RETRY_DELAY * Math.pow(2, currentRetryCount);
                    channel.nack(msg, false, true);
                    log('INFO', 'Message requeued for retry', { delay, retryCount: currentRetryCount + 1 });
                }
            }
        });

        log('INFO', 'RabbitMQ consumer started');
    } catch (error) {
        if (retryCount >= MAX_RETRIES) {
            log('ERROR', 'Max retries reached for RabbitMQ connection', {
                error: (error as Error).message
            });
            // Exponential backoff before next retry
            const delay = INITIAL_RETRY_DELAY * Math.pow(2, retryCount);
            log('WARN', `Retrying in ${delay}ms`);
            setTimeout(() => setupRabbitMQWithRetry(transporter, 0), delay);
        } else {
            const delay = INITIAL_RETRY_DELAY * Math.pow(2, retryCount);
            log('WARN', `RabbitMQ connection failed, retrying in ${delay}ms`, {
                error: (error as Error).message,
                retryCount: retryCount + 1
            });
            setTimeout(() => setupRabbitMQWithRetry(transporter, retryCount + 1), delay);
        }
    }
}

/**
 * Main
 */
async function main() {
    log('INFO', 'Starting Email Service', { enabled: FEATURE_EMAIL });

    if (!FEATURE_EMAIL) {
        log('WARN', 'Email feature disabled, service will not process events');
        return;
    }

    const transporter = createTransporter();
    await setupRabbitMQWithRetry(transporter);

    log('INFO', 'Email Service ready');
}

main().catch((err) => {
    log('ERROR', 'Fatal error', { error: err.message });
    process.exit(1);
});
