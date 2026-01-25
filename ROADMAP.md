# Roadmap

Este documento descreve as fases de desenvolvimento do Payment Gateway, do MVP até o sistema pronto para produção.

**Status atual**: Fase 2 Completada ✅  
**Última atualização**: 25/01/2025

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

## Fase 2: Hardening para Produção (Completo) ✅

Todas as funcionalidades de hardening foram implementadas e testadas:

### Prioridade Alta (5/5 completas)

| Item | Descrição | Status |
|------|-----------|--------|
| TLS/HTTPS | Configurar certificados SSL | ✅ Completo |
| Gestão de Secrets | Secrets via Docker secrets | ✅ Completo |
| Validação de Assinatura | Verificar HMAC dos webhooks | ✅ Completo |
| Testes Unitários | Cobertura ≥ 60% | ✅ Completo |
| Testes de Integração | Fluxo completo com banco | ✅ Completo |

### Prioridade Média (5/5 completas)

| Item | Descrição | Status |
|------|-----------|--------|
| Circuit Breaker | Falha rápida quando provedor indisponível | ✅ Completo |
| Retry com Backoff | Retry exponencial nos consumers | ✅ Completo |
| Métricas Prometheus | Latência, taxa de erro, throughput | ✅ Completo |
| Alertas | Notificações Slack em falhas | ✅ Completo |
| Backups do Banco | pg_dump automático diário | ✅ Completo |

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
