import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ['error', 'warn'],
  })

// Enable SQLite Write-Ahead Logging (WAL) mode for high-concurrency read/write performance
if (typeof db.$queryRawUnsafe === 'function') {
  db.$queryRawUnsafe('PRAGMA journal_mode=WAL;').catch(() => {});
  db.$queryRawUnsafe('PRAGMA synchronous=NORMAL;').catch(() => {});
}

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db