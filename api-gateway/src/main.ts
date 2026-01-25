import 'reflect-metadata';
import express, { Request, Response, NextFunction } from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import Redis from 'ioredis';
import { v4 as uuidv4 } from 'uuid';
import { validateSecrets, getSecretValue } from './secrets.validator';

validateSecrets([
    {
        name: 'API Key',
        envKey: 'API_KEY',
        required: true,
        description: 'API Key para autenticação de requisições',
    },
    {
        name: 'Redis URL',
        envKey: 'REDIS_URL',
        required: true,
        description: 'String de conexão do Redis',
    },
    {
        name: 'Payment Service URL',
        envKey: 'PAYMENT_SERVICE_URL',
        required: true,
        description: 'URL do Payment Service para proxy',
    },
]);

const app = express();
const port = process.env.PORT || 3000;

const apiKey = getSecretValue('API_KEY') || 'your-api-key-here';

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

app.use(express.json());

app.use((req: Request, res: Response, next: NextFunction) => {
    const correlationId = req.headers['x-correlation-id'] as string || uuidv4();
    req.headers['x-correlation-id'] = correlationId;
    res.setHeader('x-correlation-id', correlationId);
    next();
});

const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
    const clientApiKey = req.headers['x-api-key'] as string;

    if (req.path === '/health') {
        return next();
    }

    if (!clientApiKey || clientApiKey !== apiKey) {
        return res.status(401).json({
            error: 'Unauthorized',
            message: 'Invalid or missing X-API-Key header',
        });
    }

    next();
};

// Middleware: Rate Limiting
const rateLimitMiddleware = async (req: Request, res: Response, next: NextFunction) => {
    const apiKey = req.headers['x-api-key'] as string || 'anonymous';
    const key = `ratelimit:${apiKey}`;
    const limit = 100; // requests per minute
    const ttl = 60; // seconds

    try {
        const current = await redis.incr(key);
        if (current === 1) {
            await redis.expire(key, ttl);
        }

        res.setHeader('X-RateLimit-Limit', limit);
        res.setHeader('X-RateLimit-Remaining', Math.max(0, limit - current));

        if (current > limit) {
            return res.status(429).json({
                error: 'Too Many Requests',
                message: `Rate limit exceeded. Try again in ${ttl} seconds.`,
            });
        }

        next();
    } catch (error) {
        // Redis down - allow request (graceful degradation)
        console.warn('Rate limit check failed, allowing request');
        next();
    }
};

// Middleware: Request Logging
app.use((req: Request, res: Response, next: NextFunction) => {
    const start = Date.now();
    res.on('finish', () => {
        console.log(JSON.stringify({
            timestamp: new Date().toISOString(),
            method: req.method,
            path: req.path,
            status: res.statusCode,
            duration: `${Date.now() - start}ms`,
            correlationId: req.headers['x-correlation-id'],
        }));
    });
    next();
});

// Apply middlewares
app.use(authMiddleware);
app.use(rateLimitMiddleware);

// Health check (no proxy)
app.get('/health', (req: Request, res: Response) => {
    res.json({
        status: 'ok',
        service: 'api-gateway',
        timestamp: new Date().toISOString(),
    });
});

// Proxy to Payment Service
const paymentServiceUrl = process.env.PAYMENT_SERVICE_URL || 'http://localhost:3001';

app.use('/payments', createProxyMiddleware({
    target: paymentServiceUrl,
    changeOrigin: true,
    pathRewrite: { '^/payments': '/payments' },
}));

app.use('/webhooks', createProxyMiddleware({
    target: paymentServiceUrl,
    changeOrigin: true,
    pathRewrite: { '^/webhooks': '/webhooks' },
}));

app.use('/sandbox', createProxyMiddleware({
    target: paymentServiceUrl,
    changeOrigin: true,
    pathRewrite: { '^/sandbox': '/sandbox' },
}));

// 404 handler
app.use((req: Request, res: Response) => {
    res.status(404).json({
        error: 'Not Found',
        message: `Route ${req.method} ${req.path} not found`,
    });
});

// Error handler
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
    console.error(JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'ERROR',
        message: err.message,
        stack: err.stack,
        correlationId: req.headers['x-correlation-id'],
    }));

    res.status(500).json({
        error: 'Internal Server Error',
        message: 'An unexpected error occurred',
    });
});

// Start server
app.listen(port, () => {
    console.log(JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'INFO',
        message: `API Gateway running on port ${port}`,
        environment: process.env.NODE_ENV || 'development',
    }));
});
