/**
 * Custom Logger with structured JSON output
 */
export class Logger {
    constructor(private context: string) { }

    private format(level: string, message: string, data?: Record<string, unknown>) {
        const log = {
            timestamp: new Date().toISOString(),
            level,
            context: this.context,
            message,
            ...data,
        };
        return JSON.stringify(log);
    }

    info(message: string, data?: Record<string, unknown>) {
        console.log(this.format('INFO', message, data));
    }

    warn(message: string, data?: Record<string, unknown>) {
        console.warn(this.format('WARN', message, data));
    }

    error(message: string, error?: Error | unknown, data?: Record<string, unknown>) {
        const errorData = error instanceof Error
            ? { error: error.message, stack: error.stack }
            : { error };
        console.error(this.format('ERROR', message, { ...errorData, ...data }));
    }

    debug(message: string, data?: Record<string, unknown>) {
        if (process.env.LOG_LEVEL === 'debug') {
            console.log(this.format('DEBUG', message, data));
        }
    }
}
