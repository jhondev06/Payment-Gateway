# Guia do Desenvolvedor

Este guia contém instruções detalhadas para configurar, executar e resolver problemas do Payment Gateway MVP.

**Público-alvo**: Desenvolvedores pleno  
**Tempo estimado de setup**: 30 minutos

---

## Pré-requisitos

Certifique-se de que as seguintes ferramentas estão instaladas:

- Node.js 20+ (`node -v`)
- Docker e Docker Compose (`docker --version`)
- Git (`git --version`)

---

## Instruções de Setup

### Passo 1: Configurar Ambiente

```bash
cd gateway
cp .env.example .env
```

Para testes em sandbox, os valores padrão do `.env.example` são suficientes. Nenhuma modificação é necessária.

### Passo 2: Iniciar Serviços de Infraestrutura

```bash
docker-compose up -d postgres redis rabbitmq
```

Verifique se todos os containers estão rodando:

```bash
docker-compose ps
```

Saída esperada:

```
NAME               STATUS
gateway-postgres   Up (healthy)
gateway-redis      Up (healthy)
gateway-rabbitmq   Up (healthy)
```

### Passo 3: Instalar Dependências

```bash
cd payment-service && npm install
cd ../api-gateway && npm install
cd ..
```

### Passo 4: Iniciar o Payment Service

```bash
cd payment-service
npm run start:dev
```

Saída esperada no console:

```json
{"level":"INFO","message":"Payment Service running on port 3000"}
{"level":"INFO","message":"Environment: sandbox"}
{"level":"INFO","message":"Redis connected"}
```

### Passo 5: Verificar o Serviço

```bash
curl http://localhost:3000/health
```

Resposta esperada:

```json
{"status":"ok","service":"payment-service","timestamp":"...","environment":"sandbox"}
```

---

## Testes

### Criar Pagamento Sandbox

```bash
curl -X POST http://localhost:3000/sandbox/simulate/payment \
  -H "Content-Type: application/json" \
  -d '{"amount": 99.90}'
```

### Simular Confirmação de Pagamento

```bash
curl -X POST http://localhost:3000/sandbox/simulate/webhook \
  -H "Content-Type: application/json" \
  -d '{"payment_id": "ID_DO_PASSO_ANTERIOR", "status": "PAID"}'
```

---

## Referência de Portas

| Serviço | Porta | URL |
|---------|-------|-----|
| API Gateway | 3000 | http://localhost:3000 |
| Payment Service | 3000 | http://localhost:3000 |
| WebSocket | 3003 | ws://localhost:3003 |
| PostgreSQL | 5432 | localhost:5432 |
| Redis | 6379 | localhost:6379 |
| RabbitMQ | 5672 | localhost:5672 |
| RabbitMQ UI | 15672 | http://localhost:15672 |

Credenciais do RabbitMQ Management: `gateway` / `gateway_secret`

---

## Troubleshooting

### Conexão recusada ao PostgreSQL

**Causa**: Container não está rodando ou ainda está inicializando.

**Solução**:
```bash
docker-compose ps
docker-compose up -d postgres
# Aguarde 10 segundos para inicialização
```

### Erro de módulo não encontrado

**Causa**: Dependências não instaladas.

**Solução**:
```bash
cd payment-service
rm -rf node_modules
npm install
```

### Porta já em uso

**Causa**: Outro processo está usando a porta.

**Solução (Windows)**:
```bash
netstat -ano | findstr :3000
taskkill /PID <PID> /F
```

**Solução (Linux/Mac)**:
```bash
lsof -i :3000
kill -9 <PID>
```

### Conexão recusada ao Redis

**Causa**: Container Redis não está rodando.

**Solução**:
```bash
docker-compose up -d redis
docker-compose logs redis
```

### Tabela não existe

**Causa**: Schema do banco não foi inicializado.

**Solução**:
```bash
docker-compose down
docker volume rm gateway_postgres_data
docker-compose up -d postgres
# Aguarde 10 segundos para o init.sql executar
```

### Falha de conexão com RabbitMQ

**Causa**: RabbitMQ leva aproximadamente 30 segundos para inicializar completamente.

**Solução**:
```bash
docker-compose logs -f rabbitmq
# Aguarde a mensagem "Server startup complete"
```

---

## Referência de Estrutura de Arquivos

```
gateway/
├── .env                    # Configuração local (não commitar)
├── .env.example            # Template de configuração
├── docker-compose.yml      # Serviços de infraestrutura
│
├── payment-service/
│   └── src/
│       ├── payment/        # Lógica de pagamento
│       ├── webhook/        # Handlers de webhook
│       ├── sandbox/        # Endpoints de teste
│       └── infra/          # Banco, Redis, RabbitMQ
│
└── infra/
    └── postgres/init.sql   # Schema do banco
```

---

## Checklist de Validação

Antes de considerar o setup completo, verifique:

- [ ] `docker-compose ps` mostra 3 containers rodando
- [ ] `curl localhost:3000/health` retorna `{"status":"ok"}`
- [ ] Criação de pagamento sandbox funciona
- [ ] Simulação de webhook sandbox funciona
- [ ] Logs aparecem em formato JSON estruturado

---

## Recursos Adicionais

- [Mercado Pago Sandbox](https://www.mercadopago.com.br/developers/panel)
- [RabbitMQ Management](http://localhost:15672)
