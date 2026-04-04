# Performance Debugging Checklist

## 🔍 Backend (Prisma + Neon)

### 1. Run Slow Query Debug
```bash
npx tsx debug-slow-queries.ts
```

**What to look for:**
- Queries taking > 100ms
- N+1 query patterns (many similar queries in loop)
- Missing indexes

### 2. Common Performance Issues

#### ❌ N+1 Query Problem
```typescript
// BAD: Query in loop
for (const player of players) {
  const value = await evaluateMarketValue(player); // 1 query per player
}
// 100 players = 100 queries!

// GOOD: Batch processing
const values = await Promise.all(
  players.map(p => evaluateMarketValue(p))
);
// 100 players = 1 parallel execution
```

#### ❌ Missing Indexes
Check if queries are using indexes:
```sql
-- Run in Neon SQL Editor
EXPLAIN ANALYZE
SELECT * FROM "Player"
WHERE "transferStatus" = 'LISTED'
  AND "isRetired" = false;
```

Look for:
- ✅ Index Scan
- ❌ Seq Scan (Sequential Scan = slow)

#### ❌ Fetching Too Much Data
```typescript
// BAD: Fetch all columns
const players = await prisma.player.findMany();

// GOOD: Select only needed columns
const players = await prisma.player.findMany({
  select: {
    id: true,
    name: true,
    power: true,
    // ... only what you need
  }
});
```

### 3. Check Neon Dashboard

1. Go to https://neon.tech
2. Select your database
3. Click "Insights" or "Metrics"
4. Look for:
   - High CPU usage
   - Slow queries
   - Connection pool exhaustion

---

## 🖥️ Frontend (Next.js)

### 1. React DevTools Profiler

1. Install React DevTools extension
2. Open DevTools → Profiler tab
3. Click "Record"
4. Navigate to /players page
5. Stop recording
6. Check which components took longest

### 2. Chrome DevTools Network Tab

1. Open DevTools → Network tab
2. Filter by "Fetch/XHR"
3. Look for:
   - Slow API calls (> 500ms)
   - Large responses (> 1MB)
   - Too many requests

### 3. Chrome DevTools Performance Tab

1. Open DevTools → Performance tab
2. Click "Record"
3. Interact with the app
4. Stop recording
5. Analyze:
   - Long tasks (red bars)
   - Layout thrashing
   - JavaScript execution time

---

## 📊 Expected Performance (Neon)

| Operation | Expected Time | Alert If |
|-----------|--------------|----------|
| Simple query (1 row) | < 10ms | > 50ms |
| Query with index (100 rows) | < 50ms | > 200ms |
| Complex join (1000 rows) | < 200ms | > 1000ms |
| AI Market process (1 team) | < 5s | > 10s |
| Page load (frontend) | < 2s | > 5s |

---

## 🚀 Quick Wins

### 1. Add Missing Indexes
```prisma
// In schema.prisma
model Player {
  // ... fields
  
  @@index([transferStatus, isRetired])
  @@index([teamId, isRetired])
  @@index([age, transferStatus])
}
```

Then run:
```bash
npx prisma db push
```

### 2. Enable Connection Pooling
In `.env`:
```bash
# Use connection pooler URL from Neon
DATABASE_URL="postgresql://...@ep-xxx-xxx-pooler.aws.neon.tech/...?sslmode=require"
```

### 3. Batch Database Operations
See: `src/lib/services/aiMarketService.ts` - already optimized with batch updates

---

## 📝 Debug Workflow

1. **Run debug script:**
   ```bash
   npx tsx debug-slow-queries.ts
   ```

2. **Check output for:**
   - Queries > 100ms
   - Repeated queries (N+1)
   - Large result sets

3. **Fix issues:**
   - Add indexes
   - Batch queries
   - Reduce data fetching

4. **Re-test:**
   ```bash
   npx tsx debug-slow-queries.ts
   ```

5. **Compare before/after times**

---

## 🎯 Next Steps

After running debug, tell me:
1. Which queries are slowest?
2. How long does `processAIMarketForTeam` take?
3. Any N+1 patterns you see?

Then I'll help optimize those specific areas!
