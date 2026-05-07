#!/bin/sh
set -e

SCHEDULE_SECONDS=86400
if [ "${SCHEDULE_HOUR}" = "" ]; then
    SCHEDULE_HOUR=2
fi

echo "Backup scheduler iniciado"
echo "Horário: ${SCHEDULE_HOUR}h UTC todos os dias"
echo ""

/app/backup.sh

while true; do
    CURRENT_HOUR=$(date +%H)
    CURRENT_MINUTE=$(date +%M)
    CURRENT_SECOND=$(date +%S)

    if [ "$CURRENT_HOUR" = "$SCHEDULE_HOUR" ] && [ "$CURRENT_MINUTE" = "00" ]; then
        echo "[$(date)] Executando backup agendado..."
        /app/backup.sh || echo "[$(date)] Backup falhou!"
        sleep 120
    fi

    sleep 30
done
