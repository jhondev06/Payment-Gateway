#!/bin/bash

# Script de backup do PostgreSQL para Payment Gateway

set -e

# Configurações
BACKUP_DIR="/app/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="payment_gateway_${TIMESTAMP}.sql.gz"
DAYS_TO_KEEP=7

# Variáveis de ambiente (injetadas via Docker secrets)
if [ -f "/run/secrets/postgres_password" ]; then
    POSTGRES_PASSWORD=$(cat /run/secrets/postgres_password)
else
    POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-}"
fi

DB_HOST="${DB_HOST:-postgres}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${POSTGRES_DB:-gateway}"
DB_USER="${POSTGRES_USER:-gateway}"

echo "=========================================="
echo "Iniciando backup do PostgreSQL"
echo "=========================================="
echo "Timestamp: ${TIMESTAMP}"
echo "Diretório de backup: ${BACKUP_DIR}"
echo ""

# Criar diretório de backups se não existir
mkdir -p "${BACKUP_DIR}"

# Criar URL de conexão do PostgreSQL
if [ -n "${POSTGRES_PASSWORD}" ]; then
    DB_URL="postgresql://${DB_USER}:${POSTGRES_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}"
else
    # Usar autenticação por trust/peer se senha não definida
    DB_URL="postgresql://${DB_USER}@${DB_HOST}:${DB_PORT}/${DB_NAME}"
fi

echo "Conectando ao banco de dados: ${DB_HOST}:${DB_PORT}/${DB_NAME}"
echo ""

# Executar backup
echo "Executando pg_dump..."
if pg_dump "${DB_URL}" | gzip > "${BACKUP_DIR}/${BACKUP_FILE}"; then
    BACKUP_SIZE=$(du -h "${BACKUP_DIR}/${BACKUP_FILE}" | cut -f1)
    echo "✓ Backup concluído com sucesso"
    echo "  Arquivo: ${BACKUP_DIR}/${BACKUP_FILE}"
    echo "  Tamanho: ${BACKUP_SIZE}"
    echo ""
else
    echo "✗ Erro ao executar backup"
    exit 1
fi

# Validar integridade do backup
echo "Validando integridade do backup..."
if gzip -t "${BACKUP_DIR}/${BACKUP_FILE}" 2>/dev/null; then
    echo "✓ Backup válido (integridade OK)"
    echo ""
else
    echo "✗ Backup corrompido"
    exit 1
fi

# Remover backups antigos
echo "Removendo backups antigos (> ${DAYS_TO_KEEP} dias)..."
BACKUPS_REMOVED=0
for old_backup in $(find "${BACKUP_DIR}" -name "payment_gateway_*.sql.gz" -mtime +${DAYS_TO_KEEP}); do
    rm -f "${old_backup}"
    BACKUPS_REMOVED=$((BACKUPS_REMOVED + 1))
    echo "  Removido: ${old_backup}"
done

if [ ${BACKUPS_REMOVED} -gt 0 ]; then
    echo "✓ Removidos ${BACKUPS_REMOVED} backup(s) antigo(s)"
    echo ""
else
    echo "Nenhum backup antigo para remover"
    echo ""
fi

# Resumo
echo "=========================================="
echo "Resumo do Backup"
echo "=========================================="
echo "Arquivo: ${BACKUP_DIR}/${BACKUP_FILE}"
echo "Tamanho: ${BACKUP_SIZE}"
echo "Backups mantidos: ${DAYS_TO_KEEP} dias"
echo "Backup concluído em: $(date)"
echo "=========================================="
