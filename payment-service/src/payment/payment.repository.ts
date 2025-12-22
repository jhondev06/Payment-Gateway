import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../infra/database/database.service';
import { Payment, PaymentStatus } from './payment.dto';
import { Logger } from '../shared/logger';
import { v4 as uuidv4 } from 'uuid';

/**
 * Interface para dados de criação de pagamento
 */
interface CreatePaymentData {
    idempotency_key: string;
    amount: number;
    currency: string;
    status: PaymentStatus;
    payment_method: string;
    customer_email: string | null;
    customer_name: string | null;
    description: string | null;
    metadata: Record<string, unknown>;
}

/**
 * Interface para dados de atualização de pagamento
 */
interface UpdatePaymentData {
    external_id?: string;
    status?: PaymentStatus;
    pix_qr_code?: string;
    pix_qr_code_base64?: string;
    pix_expiration?: Date;
    paid_at?: Date | null;
    metadata?: Record<string, unknown>;
}

/**
 * Interface para row do banco de dados
 */
interface PaymentRow {
    id: string;
    external_id: string | null;
    idempotency_key: string;
    amount: string | number;
    currency: string;
    status: PaymentStatus;
    payment_method: string | null;
    pix_qr_code: string | null;
    pix_qr_code_base64: string | null;
    pix_expiration: string | Date | null;
    customer_email: string | null;
    customer_name: string | null;
    description: string | null;
    metadata: string | Record<string, unknown>;
    created_at: string | Date;
    updated_at: string | Date;
    paid_at: string | Date | null;
}

/**
 * Repository de Pagamentos
 * 
 * Responsável por persistir e recuperar pagamentos do PostgreSQL.
 */
@Injectable()
export class PaymentRepository {
    private readonly logger = new Logger('PaymentRepository');

    constructor(private readonly db: DatabaseService) { }

    /**
     * Cria um novo pagamento
     */
    async create(data: CreatePaymentData): Promise<Payment> {
        const id = uuidv4();
        const now = new Date();

        const query = `
      INSERT INTO payments (
        id, idempotency_key, amount, currency, status, payment_method,
        customer_email, customer_name, description, metadata, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *
    `;

        const values = [
            id,
            data.idempotency_key,
            data.amount,
            data.currency,
            data.status,
            data.payment_method,
            data.customer_email,
            data.customer_name,
            data.description,
            JSON.stringify(data.metadata),
            now,
            now,
        ];

        const result = await this.db.query(query, values);
        return this.mapRow(result.rows[0] as PaymentRow);
    }

    /**
     * Atualiza um pagamento existente
     */
    async update(id: string, data: UpdatePaymentData): Promise<Payment> {
        const setClauses: string[] = ['updated_at = NOW()'];
        const values: unknown[] = [];
        let paramIndex = 1;

        if (data.external_id !== undefined) {
            setClauses.push(`external_id = $${paramIndex++}`);
            values.push(data.external_id);
        }
        if (data.status !== undefined) {
            setClauses.push(`status = $${paramIndex++}`);
            values.push(data.status);
        }
        if (data.pix_qr_code !== undefined) {
            setClauses.push(`pix_qr_code = $${paramIndex++}`);
            values.push(data.pix_qr_code);
        }
        if (data.pix_qr_code_base64 !== undefined) {
            setClauses.push(`pix_qr_code_base64 = $${paramIndex++}`);
            values.push(data.pix_qr_code_base64);
        }
        if (data.pix_expiration !== undefined) {
            setClauses.push(`pix_expiration = $${paramIndex++}`);
            values.push(data.pix_expiration);
        }
        if (data.paid_at !== undefined) {
            setClauses.push(`paid_at = $${paramIndex++}`);
            values.push(data.paid_at);
        }
        if (data.metadata !== undefined) {
            setClauses.push(`metadata = $${paramIndex++}`);
            values.push(JSON.stringify(data.metadata));
        }

        values.push(id);

        const query = `
      UPDATE payments 
      SET ${setClauses.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

        const result = await this.db.query(query, values);
        return this.mapRow(result.rows[0] as PaymentRow);
    }

    /**
     * Busca pagamento por ID
     */
    async findById(id: string): Promise<Payment | null> {
        const query = 'SELECT * FROM payments WHERE id = $1';
        const result = await this.db.query(query, [id]);

        if (result.rows.length === 0) {
            return null;
        }

        return this.mapRow(result.rows[0] as PaymentRow);
    }

    /**
     * Busca pagamento por external_id (ID do Mercado Pago)
     */
    async findByExternalId(externalId: string): Promise<Payment | null> {
        const query = 'SELECT * FROM payments WHERE external_id = $1';
        const result = await this.db.query(query, [externalId]);

        if (result.rows.length === 0) {
            return null;
        }

        return this.mapRow(result.rows[0] as PaymentRow);
    }

    /**
     * Busca pagamento por idempotency_key
     */
    async findByIdempotencyKey(key: string): Promise<Payment | null> {
        const query = 'SELECT * FROM payments WHERE idempotency_key = $1';
        const result = await this.db.query(query, [key]);

        if (result.rows.length === 0) {
            return null;
        }

        return this.mapRow(result.rows[0] as PaymentRow);
    }

    /**
     * Mapeia row do banco para Payment
     */
    private mapRow(row: PaymentRow): Payment {
        return {
            id: row.id,
            external_id: row.external_id,
            idempotency_key: row.idempotency_key,
            amount: typeof row.amount === 'string' ? parseFloat(row.amount) : row.amount,
            currency: row.currency,
            status: row.status,
            payment_method: row.payment_method,
            pix_qr_code: row.pix_qr_code,
            pix_qr_code_base64: row.pix_qr_code_base64,
            pix_expiration: row.pix_expiration ? new Date(row.pix_expiration) : null,
            customer_email: row.customer_email,
            customer_name: row.customer_name,
            description: row.description,
            metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata,
            created_at: new Date(row.created_at),
            updated_at: new Date(row.updated_at),
            paid_at: row.paid_at ? new Date(row.paid_at) : null,
        };
    }
}
