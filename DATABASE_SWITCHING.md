# Database Switching Guide

## Quick Start

### Switch to SQLite (Local Development)
```bash
./switch-db.sh sqlite
```

### Switch to Neon (Production/Testing)
```bash
./switch-db.sh neon
```

## Manual Setup

### 1. Edit `.env.neon`
Replace with your actual Neon connection string:
```
DATABASE_URL="postgresql://username:password@ep-xxx-xxx.ap-southeast-1.aws.neon.tech/your-game-db?sslmode=require"
```

Get connection string from: https://neon.tech → Dashboard → Connection Details

### 2. Switch Database
```bash
# For SQLite (fast, local)
./switch-db.sh sqlite

# For Neon (cloud, production)
./switch-db.sh neon
```

### 3. Sync Database (when switching to Neon)
```bash
# Push schema to Neon
npx prisma db push --accept-data-loss

# Or migrate existing data
npx prisma migrate dev --name init
```

## File Structure

```
.env.sqlite       → SQLite configuration (local)
.env.neon         → Neon configuration (production)
.env.local        → Active configuration (auto-generated)
switch-db.sh      → Database switcher script
```

## Performance Comparison

| Database | Speed | Use Case | Latency |
|----------|-------|----------|---------|
| **SQLite** | ⚡⚡⚡ Fastest | Local development | ~1ms |
| **Neon**   | ⚡⚡ Fast | Production/Testing | ~50-100ms |

## Tips

- Use **SQLite** for development (fastest, no network)
- Use **Neon** for testing production scenarios
- Always backup before switching: `cp dev.db dev.db.backup`
- When switching to Neon, data won't sync automatically

## Troubleshooting

### Prisma cache issues
```bash
rm -rf node_modules/.prisma
npx prisma generate
```

### Database URL not found
```bash
# Make sure .env.local exists
cp .env.sqlite .env.local  # or .env.neon
```

### Schema mismatch
```bash
# Reset and push schema
npx prisma db push --force-reset
```
