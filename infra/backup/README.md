# Database Backups

Este diretório contém scripts para backup e restore do PostgreSQL.

## 📋 Scripts

### backup.sh
Script automatizado para backup do banco de dados PostgreSQL.

**Funcionalidades:**
- Backup automático com `pg_dump`
- Compressão com gzip
- Validação de integridade do backup
- Remoção automática de backups antigos (7 dias)
- Suporte a secrets via Docker secrets

**Variáveis de ambiente:**
- `DB_HOST`: Host do PostgreSQL (default: postgres)
- `DB_PORT`: Porta do PostgreSQL (default: 5432)
- `POSTGRES_DB`: Nome do banco (default: gateway)
- `POSTGRES_USER`: Usuário do PostgreSQL (default: gateway)
- `POSTGRES_PASSWORD`: Senha do PostgreSQL (via Docker secret)

**Exemplo de uso:**
```bash
./backup.sh
```

**Cron para backup diário às 2h da manhã:**
```
0 2 * * * /app/backup.sh >> /app/backup.log 2>&1
```

### restore.sh
Script para restaurar um backup do PostgreSQL.

**Aviso:** Este script DROP e RECREATE o banco de dados!

**Exemplo de uso:**
```bash
./restore.sh payment_gateway_20250125_020000.sql.gz
```

## 🔧 Configuração no Docker Compose

O serviço de backup já está configurado no `docker-compose.yml`:

```yaml
backup:
  image: postgres:15-alpine
  container_name: gateway-backup
  environment:
    - DB_HOST=postgres
    - DB_PORT=5432
    - POSTGRES_DB=gateway
    - POSTGRES_USER=gateway
    - SCHEDULE=0 2 * * *  # 2h da manhã
    - DAYS_TO_KEEP=7
  volumes:
    - ./infra/backup/backup.sh:/app/backup.sh:ro
    - ./infra/backup/restore.sh:/app/restore.sh:ro
    - backup_data:/app/backups
  secrets:
    - postgres_password
  depends_on:
    postgres:
      condition: service_healthy
```

## 📁 Estrutura de Diretório

```
backups/
├── payment_gateway_20250125_020000.sql.gz  # Backup diário
├── payment_gateway_20250124_020000.sql.gz  # Backup anterior (removido após 7 dias)
└── backup.log                                 # Log de operações de backup
```

## ⚠️ Boas Práticas

1. **Backup antes de migrações:** Sempre faça backup antes de executar migrações no banco de dados
2. **Validação de restore:** Teste regularmente o restore em ambiente de staging
3. **Monitoramento:** Monitore o tamanho dos backups e o espaço em disco
4. **Off-site backup:** Considere enviar backups para S3 ou outro storage externo
5. **Alertas:** Configure alertas se o backup falhar (via serviço de alertas)

## 🚨 Troubleshooting

### Erro: FATAL: password authentication failed
**Causa:** Senha do PostgreSQL incorreta ou não configurada
**Solução:** Verifique se o secret `postgres_password.txt` está configurado corretamente

### Erro: No space left on device
**Causa:** Disco cheio
**Solução:** Aumente o tamanho do volume ou limpe backups antigos manualmente

### Erro: gzip: invalid magic number
**Causa:** Arquivo de backup corrompido
**Solução:** Use o último backup válido e investigue a causa da corrupção

### Backup muito grande
**Causa:** Muito dados no banco
**Solução:** Considere:
- Implementar purga de logs antigos
- Usar pg_dump com opções de seleção de tabelas
- Arquivar backups mensalmente em storage externo

## 📊 Métricas Recomendadas

Monitore as seguintes métricas:
- **Tamanho do backup:** Detectar crescimento anormal
- **Duração do backup:** Avisar se demorar mais que 1 hora
- **Sucesso/Falha:** Avisar imediatamente em falhas
- **Espaço em disco:** Avisar se < 20% livre
- **Integridade:** Validar backup após criação

## 🔄 Rotina de Backup

| Frequência | Tipo | Retenção |
|------------|-------|----------|
| Diário | Full | 7 dias |
| Mensal | Full | 12 meses |
| Imediato | Pré-migração | Manual |

## 📖 Referências

- [PostgreSQL Documentation](https://www.postgresql.org/docs/current/app-pgdump.html)
- [Docker Secrets](https://docs.docker.com/engine/swarm/secrets/)
- [Crontab Examples](https://crontab.guru/)
