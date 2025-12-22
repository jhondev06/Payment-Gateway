import * as amqp from 'amqplib';
import { WebSocketServer, WebSocket } from 'ws';

const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://localhost:5672';
const WS_PORT = parseInt(process.env.WEBSOCKET_PORT || '3003', 10);
const FEATURE_FIREBASE = process.env.FEATURE_FIREBASE === 'true';

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
 * Setup RabbitMQ consumer
 */
async function setupRabbitMQ() {
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
                log('ERROR', 'Failed to process message', { error: (error as Error).message });
                // Reject and requeue (will go to DLQ after retries)
                channel.nack(msg, false, false);
            }
        });

        log('INFO', 'RabbitMQ consumer started');
    } catch (error) {
        log('ERROR', 'Failed to connect to RabbitMQ', { error: (error as Error).message });
        // Retry after 5s
        setTimeout(setupRabbitMQ, 5000);
    }
}

/**
 * Main
 */
async function main() {
    log('INFO', 'Starting Notification Service');

    setupWebSocket();
    await setupRabbitMQ();

    log('INFO', 'Notification Service ready', { wsPort: WS_PORT });
}

main().catch((err) => {
    log('ERROR', 'Fatal error', { error: err.message });
    process.exit(1);
});
