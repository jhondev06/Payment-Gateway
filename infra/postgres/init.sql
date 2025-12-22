-- ========================================
-- Payment Gateway MVP - Database Schema
-- ========================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ========================================
-- 💰 PAYMENTS
-- ========================================
CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    external_id VARCHAR(255),           -- ID do Mercado Pago
    idempotency_key VARCHAR(255) UNIQUE NOT NULL,
    
    -- Valores
    amount DECIMAL(10,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'BRL',
    
    -- Status
    status VARCHAR(50) NOT NULL DEFAULT 'CREATED',
    payment_method VARCHAR(50),         -- pix, card
    
    -- PIX específico
    pix_qr_code TEXT,
    pix_qr_code_base64 TEXT,
    pix_expiration TIMESTAMP,
    
    -- Metadata
    customer_email VARCHAR(255),
    customer_name VARCHAR(255),
    description TEXT,
    metadata JSONB DEFAULT '{}',
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    paid_at TIMESTAMP,
    
    -- Constraints
    CONSTRAINT valid_status CHECK (status IN ('CREATED', 'PENDING', 'PAID', 'FAILED', 'EXPIRED', 'REFUNDED', 'CANCELLED')),
    CONSTRAINT valid_method CHECK (payment_method IN ('pix', 'card') OR payment_method IS NULL),
    CONSTRAINT positive_amount CHECK (amount > 0)
);

-- ========================================
-- 🔑 IDEMPOTENCY KEYS
-- ========================================
CREATE TABLE idempotency_keys (
    key VARCHAR(255) PRIMARY KEY,
    payment_id UUID REFERENCES payments(id) ON DELETE CASCADE,
    request_hash VARCHAR(64),           -- SHA256 do request body
    response JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP NOT NULL
);

-- ========================================
-- 📨 PROVIDER EVENTS (Webhook Audit)
-- ========================================
CREATE TABLE provider_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_id UUID REFERENCES payments(id) ON DELETE SET NULL,
    
    -- Provider info
    provider VARCHAR(50) NOT NULL,
    event_id VARCHAR(255),              -- ID do evento do provedor
    event_type VARCHAR(100) NOT NULL,
    
    -- Payload
    payload JSONB NOT NULL,
    signature VARCHAR(255),
    
    -- Processing
    processed BOOLEAN DEFAULT FALSE,
    processed_at TIMESTAMP,
    error_message TEXT,
    
    -- Timestamps
    received_at TIMESTAMP DEFAULT NOW()
);

-- ========================================
-- 📋 AUDIT LOGS (Compliance)
-- ========================================
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Entity
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID NOT NULL,
    
    -- Action
    action VARCHAR(50) NOT NULL,
    actor VARCHAR(255),                 -- API Key, System, etc
    
    -- Changes
    previous_state JSONB,
    new_state JSONB,
    changes JSONB,
    
    -- Context
    ip_address VARCHAR(45),
    user_agent TEXT,
    correlation_id VARCHAR(255),
    
    -- Timestamp
    created_at TIMESTAMP DEFAULT NOW()
);

-- ========================================
-- 📊 INDEXES
-- ========================================

-- Payments
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_payments_external ON payments(external_id);
CREATE INDEX idx_payments_created ON payments(created_at DESC);
CREATE INDEX idx_payments_customer ON payments(customer_email);

-- Idempotency
CREATE INDEX idx_idempotency_expires ON idempotency_keys(expires_at);
CREATE INDEX idx_idempotency_payment ON idempotency_keys(payment_id);

-- Provider Events
CREATE INDEX idx_provider_events_payment ON provider_events(payment_id);
CREATE INDEX idx_provider_events_type ON provider_events(event_type);
CREATE INDEX idx_provider_events_received ON provider_events(received_at DESC);

-- Audit
CREATE INDEX idx_audit_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_created ON audit_logs(created_at DESC);
CREATE INDEX idx_audit_correlation ON audit_logs(correlation_id);

-- ========================================
-- 🔄 TRIGGERS
-- ========================================

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER payments_updated_at
    BEFORE UPDATE ON payments
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- ========================================
-- 🧹 CLEANUP FUNCTION
-- ========================================

-- Remove expired idempotency keys (run via cron)
CREATE OR REPLACE FUNCTION cleanup_expired_idempotency_keys()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM idempotency_keys WHERE expires_at < NOW();
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;
