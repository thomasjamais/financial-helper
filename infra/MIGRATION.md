# Migration Guide: Old AWS Infrastructure → New Infrastructure

This guide helps you migrate from the old infrastructure setup to the new comprehensive setup.

## What Changed

### Old Infrastructure
- Simple VPC with only public subnets
- ECS setup for agent only
- No RDS database
- No web hosting
- No ALB

### New Infrastructure
- VPC with public and private subnets
- ECS for API and Bot services
- RDS PostgreSQL database
- S3 + CloudFront for web hosting
- Application Load Balancer for API

## Migration Steps

### 1. Backup Old Infrastructure State

```bash
cd infra/terraform
cp terraform.tfstate terraform.tfstate.backup.$(date +%Y%m%d)
```

### 2. Identify Conflicting Files

The new infrastructure uses:
- `vpc.tf` (replaces `networking.tf`)
- `ecs.tf` (replaces old agent-only ECS setup)
- New files: `rds.tf`, `web.tf`, `alb.tf`, `security_groups.tf`

**Action**: Remove or rename old conflicting files:
```bash
cd infra/terraform
mv networking.tf networking.tf.old  # Conflicts with vpc.tf
# Keep old ecs.tf for reference but new one will replace it
```

### 3. Clean Up Old Resources (if needed)

Run the cleanup script to see what exists:
```bash
./infra/cleanup-old.sh
```

**Option A: Start Fresh** (Recommended)
1. Destroy old infrastructure:
   ```bash
   cd infra/terraform
   terraform destroy
   ```
2. Remove old state files:
   ```bash
   rm terraform.tfstate terraform.tfstate.backup
   ```

**Option B: Migrate Existing Resources**
1. Import existing resources into new Terraform state
2. More complex, not recommended unless you have critical data

### 4. Deploy New Infrastructure

Follow the deployment guide in [DEPLOYMENT.md](DEPLOYMENT.md)

### 5. Data Migration (if needed)

If you have existing data:
1. Export from old database
2. Import to new RDS instance
3. Update application configuration

## File Conflicts Resolution

| Old File | New File | Action |
|----------|----------|--------|
| `networking.tf` | `vpc.tf` | Remove `networking.tf` |
| `ecs.tf` (agent only) | `ecs.tf` (API + Bot) | Replace with new `ecs.tf` |
| `ecr.tf` (agent only) | `ecr.tf` (API + Bot) | Keep, updated |
| N/A | `rds.tf` | New file |
| N/A | `web.tf` | New file |
| N/A | `alb.tf` | New file |
| N/A | `security_groups.tf` | New file |

## Notes

- The new infrastructure uses different resource names
- Make sure to update any scripts or documentation that reference old resource names
- Old agent infrastructure can coexist if needed (just use different project name)



