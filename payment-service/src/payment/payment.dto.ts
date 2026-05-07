import { IsNumber, IsString, IsOptional, IsEmail, Min, IsObject } from 'class-validator';

/**
 * DTO para criação de pagamento PIX
 */
export class CreatePaymentDto {
    @IsNumber()
    @Min(0.01)
    amount!: number;

    @IsString()
    @IsOptional()
    description?: string;

    @IsEmail()
    @IsOptional()
    customer_email?: string;

    @IsString()
    @IsOptional()
    customer_name?: string;

    @IsObject()
    @IsOptional()
    metadata?: Record<string, unknown>;
}

/**
 * Payment Entity
 */
export interface Payment {
    id: string;
    external_id: string | null;
    idempotency_key: string;
    amount: number;
    currency: string;
    status: PaymentStatus;
    payment_method: string | null;
    pix_qr_code: string | null;
    pix_qr_code_base64: string | null;
    pix_expiration: Date | null;
    customer_email: string | null;
    customer_name: string | null;
    description: string | null;
    metadata: Record<string, unknown>;
    created_at: Date;
    updated_at: Date;
    paid_at: Date | null;
}

/**
 * Payment Status Enum
 */
export type PaymentStatus =
    | 'CREATED'
    | 'PENDING'
    | 'PAID'
    | 'FAILED'
    | 'EXPIRED'
    | 'REFUNDED'
    | 'CANCELLED';

/**
 * Payment Response DTO
 */
export interface PaymentResponse {
    id: string;
    status: PaymentStatus;
    amount: number;
    currency: string;
    pix?: {
        qr_code: string;
        qr_code_base64: string;
        expiration: string;
    };
    created_at: string;
}

/**
 * Payment Event (for RabbitMQ)
 */
export interface PaymentEvent {
    type: 'PAYMENT_CREATED' | 'PAYMENT_UPDATED' | 'PAYMENT_COMPLETED' | 'PAYMENT_FAILED';
    payment_id: string;
    status: PaymentStatus;
    amount: number;
    timestamp: string;
    metadata?: Record<string, unknown>;
    [key: string]: unknown; // Index signature for compatibility with Record<string, unknown>
}
