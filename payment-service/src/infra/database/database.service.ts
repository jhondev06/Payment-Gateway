import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool, PoolClient } from 'pg';
import { Logger } from '../../shared/logger';

interface QueryResult {
    rows: any[];
    rowCount: number | null;
}

/**
 * Serviço de banco de dados PostgreSQL
 * 
 * Gerencia pool de conexões e execução de queries.
 */
@Injectable()
export class DatabaseService implements OnModuleDestroy {
    private readonly pool: Pool;
    private readonly logger = new Logger('DatabaseService');

    constructor() {
        this.pool = new Pool({
            connectionString: process.env.DATABASE_URL,
            max: parseInt(process.env.DATABASE_POOL_SIZE || '10', 10),
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 2000,
        });

        this.pool.on('error', (err) => {
            this.logger.error('Erro inesperado do banco de dados', err);
        });

        this.logger.info('Pool de conexões inicializado');
    }

    /**
     * Executa query no banco
     */
    async query(text: string, params?: any[]): Promise<QueryResult> {
        const start = Date.now();

        try {
            const result = await this.pool.query(text, params);
            const duration = Date.now() - start;

            this.logger.debug('Query executada', {
                query: text.substring(0, 100),
                duracao: `${duration}ms`,
                linhas: result.rowCount,
            });

            return result;
        } catch (error) {
            this.logger.error('Falha na query', error, { query: text.substring(0, 100) });
            throw error;
        }
    }

    /**
     * Executa transação
     */
    async transaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
        const client = await this.pool.connect();

        try {
            await client.query('BEGIN');
            const result = await callback(client);
            await client.query('COMMIT');
            return result;
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * Health check
     */
    async isHealthy(): Promise<boolean> {
        try {
            await this.pool.query('SELECT 1');
            return true;
        } catch {
            return false;
        }
    }

    async onModuleDestroy() {
        await this.pool.end();
        this.logger.info('Pool de conexões fechado');
    }
}
