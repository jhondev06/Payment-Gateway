export interface SecretConfig {
    name: string;
    envKey: string;
    required: boolean;
    description?: string;
}

export function validateSecrets(secrets: SecretConfig[]): void {
    const missing: SecretConfig[] = [];
    const provided: SecretConfig[] = [];

    for (const secret of secrets) {
        const envValue = process.env[secret.envKey];
        const fileValue = process.env[`${secret.envKey}_FILE`];

        if (!envValue && !fileValue) {
            if (secret.required) {
                missing.push(secret);
            }
        } else {
            provided.push(secret);
        }
    }

    if (missing.length > 0) {
        console.error('❌ Erro: Secrets obrigatórios não configurados');
        console.error('');
        console.error('Por favor, configure os seguintes secrets:');
        console.error('');

        for (const secret of missing) {
            console.error(`  - ${secret.name} (${secret.envKey})`);
            if (secret.description) {
                console.error(`    ${secret.description}`);
            }
        }

        console.error('');
        console.error('Para mais informações, consulte: secrets/README.md');
        console.error('');

        process.exit(1);
    }

    if (provided.length > 0) {
        console.log('✓ Secrets validados com sucesso:');
        for (const secret of provided) {
            const source = process.env[secret.envKey] ? 'env' : 'file';
            console.log(`  - ${secret.name} (${source})`);
        }
    }
}

export function getSecretValue(envKey: string): string | undefined {
    const fileValue = process.env[`${envKey}_FILE`];
    if (fileValue) {
        try {
            const fs = require('fs');
            return fs.readFileSync(fileValue, 'utf-8').trim();
        } catch (error) {
            console.warn(`⚠️  Não foi possível ler secret do arquivo ${fileValue}:`, (error as Error).message);
        }
    }
    return process.env[envKey];
}
