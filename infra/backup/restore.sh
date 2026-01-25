#!/bin/bash

# Script de restore do PostgreSQL para Payment Gateway

set -e

if [ $# -eq 0 ]; then
    echo "Uso: $0 <arquivo_backup.sql.gz>"
    echo ""
    echo "Exemplo: $0 payment_gateway_20250125_100000.sql.gz"
    exit 1
fi

BACKUP_FILE="$1"

# Configurações
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
echo "Iniciando restore do PostgreSQL"
echo "=========================================="
echo "Arquivo: ${BACKUP_FILE}"
echo ""

# Verificar se arquivo existe
if [ ! -f "${BACKUP_FILE}" ]; then
    echo "✗ Erro: Arquivo de backup não encontrado: ${BACKUP_FILE}"
    exit 1
fi

echo "Arquivo encontrado: $(du -h "${BACKUP_FILE}" | cut -f1)"
echo ""

# Criar URL de conexão do PostgreSQL
if [ -n "${POSTGRES_PASSWORD}" ]; then
    DB_URL="postgresql://${DB_USER}:${POSTGRES_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}"
else
    DB_URL="postgresql://${DB_USER}@${DB_HOST}:${DB_PORT}/${DB_NAME}"
fi

echo "⚠️  AVISO IMPORTANTE:"
echo "⚠️  Este script vai DROP e RECREATE o banco de dados!"
echo "⚠️  Todos os dados atuais serão PERDIDOS!"
echo ""

# Pedir confirmação
read -p "Tem certeza que deseja continuar? (sim/Não): " CONFIRM
if [ "${CONFIRM}" != "sim" ] && [ "${CONFIRM}" != "SIM" ]; then
    echo "Operação cancelada pelo usuário"
    exit 0
fi

echo ""
echo "Dropping banco de dados..."
psql "${DB_URL}" -c "DROP DATABASE IF EXISTS ${DB_NAME}" || {
    echo "✗ Erro ao dropar banco de dados"
    exit 1
}

echo "Criando banco de dados..."
psql "${DB_URL}" -c "CREATE DATABASE ${DB_NAME}" || {
    echo "✗ Erro ao criar banco de dados"
    exit 1
}

echo "Restaurando backup..."
if gunzip -c "${BACKUP_FILE}" | psql "${DB_URL}"; then
    echo "✓ Restore concluído com sucesso"
    echo ""
else
    echo "✗ Erro ao restaurar backup"
    exit 1
fi

# Validar restore
echo "Validando restore..."
TABLES=$(psql "${DB_URL}" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public'")

if [ "${TABLES}" -gt 0 ]; then
    echo "✓ Banco de dados restaurado com ${TABLES} tabelas"
    echo ""
else
    echo "✗ Erro na validação: nenhuma tabela encontrada"
    exit 1
fi

echo "=========================================="
echo "Restore concluído com sucesso"
echo "=========================================="
echo "Banco: ${DB_NAME}"
echo "Arquivo: ${BACKUP_FILE}"
echo "Timestamp: $(date)"
echo "=========================================="
