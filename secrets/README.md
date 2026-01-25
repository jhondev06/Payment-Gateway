# 🔐 Secrets Management

Este diretório contém os secrets usados pelo Docker Compose.

## ⚠️ Importante

**NUNCA commit estes arquivos no Git!** Eles já estão no `.gitignore`.

## 📝 Como Configurar os Secrets

### Para Desenvolvimento Local

Para desenvolvimento local, você pode usar valores simples (estes não devem ser usados em produção):

```bash
# Criar secrets de desenvolvimento
echo "gateway_dev_password" > secrets/postgres_password.txt
echo "redis_dev_password" > secrets/redis_password.txt
echo "rabbitmq_dev_password" > secrets/rabbitmq_password.txt
echo "dev-api-key-12345" > secrets/api_key.txt
echo "TEST-xxx-mercadopago-access-token" > secrets/mp_access_token.txt
echo "webhook-secret-dev" > secrets/mp_webhook_secret.txt
echo "smtp@example.com" > secrets/smtp_user.txt
echo "smtp-password" > secrets/smtp_pass.txt
```

### Para Produção

Use secrets fortes e únicos para produção:

```bash
# Gerar secrets fortes
openssl rand -base64 32 > secrets/postgres_password.txt
openssl rand -base64 32 > secrets/redis_password.txt
openssl rand -base64 32 > secrets/rabbitmq_password.txt
openssl rand -base64 64 > secrets/api_key.txt
echo "SUA_ACCESS_TOKEN_REAL" > secrets/mp_access_token.txt
openssl rand -base64 64 > secrets/mp_webhook_secret.txt
echo "SEU_SMTP_USER" > secrets/smtp_user.txt
echo "SUA_SMTP_PASSWORD" > secrets/smtp_pass.txt
```

## 🔐 Permissões dos Arquivos

Configure permissões restritas para os arquivos de secrets:

```bash
chmod 600 secrets/*.txt
```

## 📋 Lista de Secrets

| Arquivo | Descrição | Onde é usado |
|---------|-----------|--------------|
| `postgres_password.txt` | Senha do PostgreSQL | postgres service |
| `redis_password.txt` | Senha do Redis | redis service |
| `rabbitmq_password.txt` | Senha do RabbitMQ | rabbitmq service |
| `api_key.txt` | API Key para autenticação | api-gateway |
| `mp_access_token.txt` | Access Token Mercado Pago | payment-service |
| `mp_webhook_secret.txt` | Webhook Secret Mercado Pago | payment-service |
| `smtp_user.txt` | Usuário SMTP | email-service |
| `smtp_pass.txt` | Senha SMTP | email-service |

## 🚀 Inicialização

Após criar os secrets, inicie os serviços:

```bash
# Iniciar apenas infraestrutura
docker-compose up -d postgres redis rabbitmq

# Iniciar todos os serviços
docker-compose up -d
```

## ⚠️ Boas Práticas

1. **Nunca** commit secrets no repositório
2. Use secrets únicos e fortes em produção
3. Rote secrets regularmente
4. Limite o acesso aos arquivos de secrets (chmod 600)
5. Use secrets diferentes para cada ambiente (dev, staging, production)
6. Em produção, considere usar HashiCorp Vault ou AWS Secrets Manager

## 🔄 Rotação de Secrets

Para rotacionar um secret:

1. Atualize o arquivo correspondente
2. Reinicie os serviços que usam o secret:
   ```bash
   docker-compose up -d postgres
   ```

## 📖 Variáveis de Ambiente

Alguns secrets também podem ser configurados via variáveis de ambiente (veja `.env.example`):

- `CADDY_DOMAIN` - Domínio para HTTPS/Let's Encrypt
- `POSTGRES_USER` - Usuário do PostgreSQL (default: gateway)
- `RABBITMQ_USER` - Usuário do RabbitMQ (default: gateway)
- `NODE_ENV` - Ambiente (development|production)
