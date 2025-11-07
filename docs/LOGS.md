# Guide d'accès aux logs Docker/ECS

Les applications API et Bot tournent sur AWS ECS Fargate et envoient leurs logs vers **CloudWatch Logs**.

## Configuration

- **API Log Group**: `/ecs/financial-helper-api`
- **Bot Log Group**: `/ecs/financial-helper-bot`
- **Région**: `eu-west-3` (Paris)
- **Rétention**: 7 jours

Les logs utilisent le format JSON de Pino et sont structurés pour faciliter la recherche et le filtrage.

## Méthode 1 : AWS Console (Interface Web)

### Accéder aux logs via la console AWS

1. Connectez-vous à la [Console AWS](https://console.aws.amazon.com/)
2. Allez dans **CloudWatch** → **Logs** → **Log groups**
3. Recherchez les groupes de logs :
   - `/ecs/financial-helper-api` pour l'API
   - `/ecs/financial-helper-bot` pour le Bot
4. Cliquez sur un groupe pour voir les streams de logs
5. Cliquez sur un stream pour voir les logs détaillés

### Filtrer les logs dans la console

Vous pouvez utiliser des filtres CloudWatch Logs Insights pour rechercher dans les logs :

```
# Voir les erreurs uniquement
fields @timestamp, @message
| filter @message like /ERROR|error/
| sort @timestamp desc
| limit 100

# Voir les requêtes HTTP avec un code de statut >= 400
fields @timestamp, @message
| filter @message like /"statusCode":\s*[4-5]\d\d/
| sort @timestamp desc
| limit 100

# Voir les logs d'un endpoint spécifique
fields @timestamp, @message
| filter @message like /\/v1\/trade-ideas/
| sort @timestamp desc
| limit 100
```

## Méthode 2 : AWS CLI

### Installer AWS CLI

```bash
# Sur Linux/Mac
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install

# Vérifier l'installation
aws --version
```

### Configurer les credentials

```bash
aws configure
# Entrez votre AWS Access Key ID
# Entrez votre AWS Secret Access Key
# Région: eu-west-3
# Format de sortie: json (ou text)
```

### Commandes utiles

#### Voir les logs récents de l'API

```bash
# Derniers 50 logs
aws logs tail /ecs/financial-helper-api --follow --format short --region eu-west-3

# Derniers 100 logs avec format JSON
aws logs tail /ecs/financial-helper-api --since 1h --format json --region eu-west-3 | jq

# Logs des 30 dernières minutes
aws logs tail /ecs/financial-helper-api --since 30m --region eu-west-3
```

#### Voir les logs récents du Bot

```bash
aws logs tail /ecs/financial-helper-bot --follow --format short --region eu-west-3
```

#### Rechercher des erreurs

```bash
# Erreurs dans l'API
aws logs filter-log-events \
  --log-group-name /ecs/financial-helper-api \
  --filter-pattern "ERROR" \
  --region eu-west-3 \
  --max-items 50

# Erreurs dans le Bot
aws logs filter-log-events \
  --log-group-name /ecs/financial-helper-bot \
  --filter-pattern "ERROR" \
  --region eu-west-3 \
  --max-items 50
```

#### Exporter les logs vers un fichier

```bash
# Exporter les logs de la dernière heure
aws logs tail /ecs/financial-helper-api \
  --since 1h \
  --region eu-west-3 > api-logs-$(date +%Y%m%d-%H%M%S).log

# Exporter les logs du Bot
aws logs tail /ecs/financial-helper-bot \
  --since 1h \
  --region eu-west-3 > bot-logs-$(date +%Y%m%d-%H%M%S).log
```

## Méthode 3 : Scripts utilitaires

### Script pour suivre les logs en temps réel

Créez un script `scripts/tail-logs.sh` :

```bash
#!/bin/bash

LOG_GROUP=$1
REGION=${2:-eu-west-3}

if [ -z "$LOG_GROUP" ]; then
  echo "Usage: $0 <log-group-name> [region]"
  echo "Examples:"
  echo "  $0 /ecs/financial-helper-api"
  echo "  $0 /ecs/financial-helper-bot"
  exit 1
fi

aws logs tail "$LOG_GROUP" \
  --follow \
  --format short \
  --region "$REGION" \
  --filter-pattern "${3:-}"  # Optionnel: filtre de pattern
```

Utilisation :

```bash
chmod +x scripts/tail-logs.sh

# Suivre les logs de l'API
./scripts/tail-logs.sh /ecs/financial-helper-api

# Suivre les logs du Bot
./scripts/tail-logs.sh /ecs/financial-helper-bot

# Suivre avec un filtre (erreurs uniquement)
./scripts/tail-logs.sh /ecs/financial-helper-api eu-west-3 "ERROR"
```

### Script pour rechercher des patterns

Créez un script `scripts/search-logs.sh` :

```bash
#!/bin/bash

LOG_GROUP=$1
PATTERN=$2
HOURS=${3:-1}
REGION=${4:-eu-west-3}

if [ -z "$LOG_GROUP" ] || [ -z "$PATTERN" ]; then
  echo "Usage: $0 <log-group-name> <pattern> [hours] [region]"
  echo "Example: $0 /ecs/financial-helper-api 'trade-ideas' 2"
  exit 1
fi

SINCE="${HOURS}h"

echo "Searching for '$PATTERN' in $LOG_GROUP (last $HOURS hours)..."
aws logs tail "$LOG_GROUP" \
  --since "$SINCE" \
  --format short \
  --region "$REGION" \
  --filter-pattern "$PATTERN"
```

## Méthode 4 : CloudWatch Logs Insights (Requêtes avancées)

### Requêtes utiles

#### Toutes les erreurs des dernières 24h

```sql
fields @timestamp, level, @message
| filter level = "ERROR" or level = "FATAL"
| sort @timestamp desc
| limit 100
```

#### Requêtes HTTP avec temps de réponse

```sql
fields @timestamp, method, url, statusCode, responseTime
| filter @message like /GET|POST|PUT|DELETE/
| stats avg(responseTime) as avgResponseTime, max(responseTime) as maxResponseTime by method
```

#### Logs par correlation ID (pour tracer une requête)

```sql
fields @timestamp, correlationId, @message
| filter correlationId = "votre-correlation-id"
| sort @timestamp asc
```

#### Activité du Bot

```sql
fields @timestamp, @message
| filter @message like /tick|opportunity|signal/
| sort @timestamp desc
| limit 100
```

## Format des logs

Les logs sont au format JSON (Pino) et contiennent :

```json
{
  "level": "INFO",
  "time": "2024-01-15T10:30:45.123Z",
  "msg": "GET /v1/trade-ideas 200",
  "method": "GET",
  "url": "/v1/trade-ideas",
  "statusCode": 200,
  "responseTime": 45,
  "correlationId": "abc-123-def"
}
```

## Conseils

1. **Utilisez CloudWatch Logs Insights** pour des recherches complexes
2. **Configurez des alarmes** sur les erreurs critiques
3. **Exportez les logs** régulièrement si vous avez besoin d'une rétention plus longue (actuellement 7 jours)
4. **Utilisez les correlation IDs** pour tracer une requête à travers tous les logs

## Dépannage

### Les logs n'apparaissent pas

1. Vérifiez que les tâches ECS sont en cours d'exécution :
   ```bash
   aws ecs list-tasks --cluster financial-helper-cluster --region eu-west-3
   ```

2. Vérifiez les permissions IAM de la tâche ECS (doit avoir accès à CloudWatch Logs)

3. Vérifiez que le log group existe :
   ```bash
   aws logs describe-log-groups --log-group-name-prefix /ecs/financial-helper --region eu-west-3
   ```

### Logs trop verbeux

Ajustez le niveau de log via la variable d'environnement `LOG_LEVEL` dans la task definition ECS :
- `fatal` : Seulement les erreurs fatales
- `error` : Erreurs uniquement
- `warn` : Warnings et erreurs
- `info` : Informations, warnings et erreurs (défaut)
- `debug` : Tous les logs (très verbeux)

