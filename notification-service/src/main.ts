import * as amqp from 'amqplib';
import { WebSocketServer, WebSocket } from 'ws';

const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://localhost:5672';
const WS_PORT = parseInt(process.env.WEBSOCKET_PORT || '3003', 10);
const FEATURE_FIREBASE = process.env.FEATURE_FIREBASE === 'true';

const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY = 1000;

// WebSocket clients by user_id
const clients = new Map<string, Set<WebSocket>>();

/**
 * Logger
 */
function log(level: string, message: string, data?: Record<string, unknown>) {
    console.log(JSON.stringify({
        timestamp: new Date().toISOString(),
        service: 'notification-service',
        level,
        message,
        ...data,
    }));
}

/**
 * Setup WebSocket Server
 */
function setupWebSocket(): WebSocketServer {
    const wss = new WebSocketServer({ port: WS_PORT });

    wss.on('connection', (ws, req) => {
        // Extract user_id from query string: ws://localhost:3003?user_id=xxx
        const url = new URL(req.url || '', `http://localhost:${WS_PORT}`);
        const userId = url.searchParams.get('user_id') || 'anonymous';

        // Store client
        if (!clients.has(userId)) {
            clients.set(userId, new Set());
        }
        clients.get(userId)!.add(ws);

        log('INFO', 'WebSocket client connected', { userId });

        ws.on('close', () => {
            clients.get(userId)?.delete(ws);
            if (clients.get(userId)?.size === 0) {
                clients.delete(userId);
            }
            log('INFO', 'WebSocket client disconnected', { userId });
        });

        ws.on('error', (error) => {
            log('ERROR', 'WebSocket error', { userId, error: error.message });
        });
    });

    log('INFO', `WebSocket server started on port ${WS_PORT}`);
    return wss;
}

/**
 * Send notification to user via WebSocket
 */
function notifyUser(userId: string, event: Record<string, unknown>) {
    const userClients = clients.get(userId);
    if (!userClients || userClients.size === 0) {
        log('WARN', 'No active WebSocket clients for user', { userId });
        return;
    }

    const message = JSON.stringify(event);
    userClients.forEach((ws) => {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(message);
        }
    });

    log('INFO', 'Notification sent via WebSocket', { userId, eventType: event.type });
}

/**
 * Process payment event
 */
async function handlePaymentEvent(event: Record<string, unknown>) {
    log('INFO', 'Processing payment event', { eventType: event.type, paymentId: event.payment_id });

    // TODO: Get user_id from payment metadata
    const userId = (event.metadata as any)?.user_id || 'default';

    // Send via WebSocket
    notifyUser(userId, {
        type: 'PAYMENT_UPDATE',
        payment_id: event.payment_id,
        status: event.status,
        timestamp: event.timestamp,
    });

    // Send via Firebase (if enabled)
    if (FEATURE_FIREBASE) {
        log('INFO', 'Firebase notification skipped (not configured)');
    }
}

/**
 * Setup RabbitMQ consumer with exponential backoff retry
 */
async function setupRabbitMQWithRetry(retryCount = 0): Promise<void> {
    try {
        const connection = await amqp.connect(RABBITMQ_URL);
        const channel = await connection.createChannel();

        await channel.assertQueue('notification.events', { durable: true });
        await channel.prefetch(10);

        channel.consume('notification.events', async (msg) => {
            if (!msg) return;

            try {
                const event = JSON.parse(msg.content.toString());
                await handlePaymentEvent(event);
                channel.ack(msg);
            } catch (error) {
                log('ERROR', 'Failed to process message', { 
                    error: (error as Error).message,
                    retryCount: msg.fields.headers['x-retry-count'] || 0 
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
            setTimeout(() => setupRabbitMQWithRetry(0), delay);
        } else {
            const delay = INITIAL_RETRY_DELAY * Math.pow(2, retryCount);
            log('WARN', `RabbitMQ connection failed, retrying in ${delay}ms`, { 
                error: (error as Error).message,
                retryCount: retryCount + 1 
            });
            setTimeout(() => setupRabbitMQWithRetry(retryCount + 1), delay);
        }
    }
}

/**
 * Main
 */
async function main() {
    log('INFO', 'Starting Notification Service');

    setupWebSocket();
    await setupRabbitMQWithRetry();

    log('INFO', 'Notification Service ready', { wsPort: WS_PORT });
}

main().catch((err) => {
    log('ERROR', 'Fatal error', { error: err.message });
    process.exit(1);
});
