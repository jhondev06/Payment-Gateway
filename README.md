# Payment Gateway MVP

Gateway de pagamentos event-driven para o mercado brasileiro, com foco inicial em PIX.

---

## Sumário

- [Visão Geral](#visão-geral)
- [Arquitetura](#arquitetura)
- [Stack Tecnológica](#stack-tecnológica)
- [Estrutura do Projeto](#estrutura-do-projeto)
- [Início Rápido](#início-rápido)
- [API Reference](#api-reference)
- [Testes](#testes)
- [Documentação](#documentação)

---

## Visão Geral

Este projeto implementa um gateway de pagamentos modular e escalável, projetado com as seguintes premissas:

- **Event-Driven Architecture**: Processamento assíncrono via RabbitMQ
- **Idempotência**: Garantia de não-duplicação de transações
- **Observabilidade**: Logging estruturado em JSON
- **Testabilidade**: Endpoints sandbox para validação sem conta Mercado Pago

### Decisões Arquiteturais

| Decisão | Escolha | Justificativa |
|---------|---------|---------------|
| Método de pagamento inicial | PIX | Fluxo simples, sem PCI-DSS, ideal para MVP |
| Fonte de verdade | PostgreSQL | ACID compliance, transações confiáveis |
| Mensageria | RabbitMQ | Simplicidade, suporte a DLQ, custo acessível |
| Cache/Idempotência | Redis | Baixa latência, TTL nativo |
| Processamento de cartão | Tokenização via provedor | Evita PCI-DSS Level 1 |

---

## Arquitetura

```
┌─────────────────────────────────────────────────────────────┐
│                         Cliente                              │
└──────────────────────────┬──────────────────────────────────┘
                           │ HTTP
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                      API Gateway                             │
│            (Auth, Rate Limit, Correlation-ID)                │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                    Payment Service                           │
│              (Core de processamento)                         │
├─────────────┬─────────────┬─────────────┬───────────────────┤
│ PostgreSQL  │    Redis    │  RabbitMQ   │   Mercado Pago    │
│   (ACID)    │  (Cache)    │  (Eventos)  │    (Provedor)     │
└─────────────┴─────────────┴──────┬──────┴───────────────────┘
                                   │
                    ┌──────────────┴──────────────┐
                    ▼                              ▼
        ┌───────────────────┐          ┌───────────────────┐
        │ Notification Svc  │          │   Email Service   │
        │   (WebSocket)     │          │     (SMTP)        │
        └───────────────────┘          └───────────────────┘
```

### Fluxo de Pagamento PIX

1. Cliente envia requisição `POST /payments` com `Idempotency-Key`
2. Payment Service verifica idempotência no Redis
3. Cria registro no PostgreSQL com status `CREATED`
4. Chama Mercado Pago para gerar QR Code PIX
5. Atualiza status para `PENDING` e retorna QR Code
6. Mercado Pago envia webhook quando pagamento confirmado
7. Payment Service atualiza para `PAID` e publica evento
8. Notification/Email Services consomem evento e notificam cliente

---

## Stack Tecnológica

| Camada | Tecnologia | Versão |
|--------|------------|--------|
| Runtime | Node.js | 20+ |
| Framework | NestJS | 10.x |
| Linguagem | TypeScript | 5.x |
| Banco de Dados | PostgreSQL | 15+ |
| Cache | Redis | 7.x |
| Mensageria | RabbitMQ | 3.x |
| Provedor de Pagamento | Mercado Pago | SDK 2.x |
| Containerização | Docker | 24+ |
| Testes | Jest | 29.x |

---

## Estrutura do Projeto

```
gateway/
├── docker-compose.yml          # Infraestrutura containerizada
├── .env.example                # Template de configuração
├── README.md                   # Este arquivo
├── DEVELOPER_GUIDE.md          # Guia detalhado de setup
├── ROADMAP.md                  # Plano de evolução
│
├── api-gateway/                # Proxy e autenticação
│   ├── src/main.ts
│   ├── package.json
│   └── Dockerfile
│
├── payment-service/            # Core de pagamentos
│   ├── src/
│   │   ├── payment/            # Módulo de pagamentos
│   │   │   ├── payment.controller.ts
│   │   │   ├── payment.service.ts
│   │   │   ├── payment.repository.ts
│   │   │   ├── payment.dto.ts
│   │   │   ├── idempotency.service.ts
│   │   │   └── *.spec.ts       # Testes unitários
│   │   ├── webhook/            # Processamento de webhooks
│   │   ├── sandbox/            # Endpoints de teste
│   │   ├── health/             # Health checks
│   │   ├── infra/              # Integrações externas
│   │   │   ├── database/
│   │   │   ├── redis/
│   │   │   ├── rabbitmq/
│   │   │   └── mercadopago/
│   │   └── shared/             # Utilitários compartilhados
│   ├── package.json
│   ├── tsconfig.json
│   ├── jest.config.js
│   └── Dockerfile
│
├── notification-service/       # WebSocket + Firebase
├── email-service/              # Envio de emails
│
└── infra/
    └── postgres/init.sql       # Schema do banco
```

---

## Início Rápido

### Pré-requisitos

- Node.js 20+
- Docker e Docker Compose
- Git

### Setup

```bash
# 1. Configurar ambiente
cd gateway
cp .env.example .env

# 2. Iniciar infraestrutura
docker-compose up -d postgres redis rabbitmq

# 3. Instalar dependências
cd payment-service && npm install

# 4. Executar serviço
npm run start:dev
```

### Verificar instalação

```bash
curl http://localhost:3000/health
```

Para instruções detalhadas, consulte o [Guia do Desenvolvedor](./DEVELOPER_GUIDE.md).

---

## API Reference

### Autenticação

Todas as requisições devem incluir:

```
X-API-Key: <sua-api-key>
Idempotency-Key: <uuid-único>
Content-Type: application/json
```

### Endpoints

#### Criar Pagamento PIX

```http
POST /payments
```

**Request:**
```json
{
  "amount": 100.00,
  "description": "Pedido #12345",
  "customer_email": "cliente@exemplo.com",
  "customer_name": "João Silva"
}
```

**Response (201 Created):**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "PENDING",
  "amount": 100.00,
  "currency": "BRL",
  "pix": {
    "qr_code": "00020126580014br.gov.bcb.pix...",
    "qr_code_base64": "iVBORw0KGgo...",
    "expiration": "2025-12-22T14:00:00Z"
  },
  "created_at": "2025-12-22T13:30:00Z"
}
```

#### Consultar Pagamento

```http
GET /payments/:id
```

#### Status de Pagamento

| Status | Descrição |
|--------|-----------|
| `CREATED` | Pagamento criado, aguardando provedor |
| `PENDING` | QR Code gerado, aguardando pagamento |
| `PAID` | Pagamento confirmado |
| `FAILED` | Falha no processamento |
| `EXPIRED` | QR Code expirou |
| `CANCELLED` | Cancelado pelo usuário |
| `REFUNDED` | Estornado |

---

## Testes

### Testes Unitários

```bash
cd payment-service
npm test
```

### Testes em Sandbox

Para testar sem conta Mercado Pago:

```bash
# Criar pagamento simulado
curl -X POST http://localhost:3000/sandbox/simulate/payment \
  -H "Content-Type: application/json" \
  -d '{"amount": 50.00}'

# Simular confirmação
curl -X POST http://localhost:3000/sandbox/simulate/webhook \
  -H "Content-Type: application/json" \
  -d '{"payment_id": "ID_RETORNADO", "status": "PAID"}'
```

---

## Documentação

| Documento | Descrição |
|-----------|-----------|
| [Guia do Desenvolvedor](./DEVELOPER_GUIDE.md) | Setup, troubleshooting, referência de portas |
| [Roadmap](./ROADMAP.md) | Evolução do MVP para produção |
| `.env.example` | Todas as variáveis de ambiente documentadas |

---

## Qualidade de Código

| Métrica | Status |
|---------|--------|
| Tipagem estática | TypeScript strict mode |
| Testes unitários | Jest com mocks |
| Logging estruturado | JSON com contexto |
| Documentação | Comentários em português |
| Padrões | Repository, DI, Event-Driven |

---

## Licença

MIT
