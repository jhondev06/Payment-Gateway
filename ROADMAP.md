# Roadmap

Este documento descreve as fases de desenvolvimento do Payment Gateway, do MVP até o sistema pronto para produção.

**Status atual**: MVP Completo (Pronto para POC)  
**Última atualização**: 22/12/2025

---

## Fase 1: MVP (Completo)

As seguintes funcionalidades estão implementadas e testadas:

- [x] Criação de pagamento PIX via Mercado Pago
- [x] Tratamento de idempotência (Redis + PostgreSQL)
- [x] Processamento de webhooks
- [x] Publicação de eventos assíncronos (RabbitMQ)
- [x] Logging estruturado em JSON
- [x] Endpoints de health check
- [x] Endpoints de teste sandbox
- [x] Documentação para desenvolvedores

---

## Fase 2: Hardening para Produção

Necessário antes de processar transações reais.

### Prioridade Alta

| Item | Descrição | Esforço |
|------|-----------|---------|
| TLS/HTTPS | Configurar certificados SSL | 2 horas |
| Gestão de Secrets | Secrets via ambiente, sem `.env` em produção | 2 horas |
| Validação de Assinatura | Verificar HMAC dos webhooks Mercado Pago | 4 horas |
| Testes Unitários | Cobertura mínima de 60% nos services | 2 dias |
| Testes de Integração | Fluxo completo com banco real | 1 dia |

### Prioridade Média

| Item | Descrição | Esforço |
|------|-----------|---------|
| Circuit Breaker | Falha rápida quando provedor indisponível | 4 horas |
| Retry com Backoff | Retry exponencial nos consumers RabbitMQ | 4 horas |
| Métricas Prometheus | Latência, taxa de erro, throughput | 1 dia |
| Alertas | Notificações Slack/Discord em falhas | 4 horas |
| Backups do Banco | pg_dump automático diário | 2 horas |

### Prioridade Baixa

| Item | Descrição | Esforço |
|------|-----------|---------|
| Rate Limit Avançado | Por IP, por cliente, sliding window | 1 dia |
| Dashboard Admin | Visualização de pagamentos e métricas | 3 dias |
| Templates de Email | Templates HTML formatados | 1 dia |
| Pagamentos com Cartão | Fase 2 de métodos de pagamento | 1 semana |
| Multi-tenancy | Múltiplos clientes no mesmo gateway | 2 semanas |

---

## Fase 3: Escala

Necessário apenas se volume de transações ultrapassar 10.000 por dia.

- [ ] Orquestração de containers (Kubernetes ou Docker Swarm)
- [ ] Configuração de load balancer
- [ ] Read replicas do PostgreSQL
- [ ] Redis cluster
- [ ] CDN para assets estáticos
- [ ] Deploy multi-region
- [ ] Procedimentos de disaster recovery

---

## Resumo

| Fase | Status | Esforço Estimado |
|------|--------|------------------|
| MVP | Completo | - |
| Hardening para Produção | Pendente | 5 dias |
| Escala | Futuro | 2 semanas |

---

## Observações para Desenvolvedores

O MVP está pronto para testes de Prova de Conceito (POC). Você pode:

1. Configurar sua conta sandbox no Mercado Pago
2. Testar o fluxo completo de pagamento
3. Apresentar para stakeholders

Os itens de hardening para produção não são necessários para validação do POC.
