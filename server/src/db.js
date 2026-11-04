import { PrismaClient, Prisma } from '@prisma/client';

export const prisma = new PrismaClient();
export { Prisma };

// Serializable-Transaktionen können bei gleichzeitigen Einzahlungen kollidieren (P2034).
// Dann wird die Transaktion einfach erneut versucht.
export async function withRetry(fn, attempts = 4) {
  for (let i = 1; ; i++) {
    try {
      return await fn();
    } catch (err) {
      if (err?.code !== 'P2034' || i >= attempts) throw err;
      await new Promise((r) => setTimeout(r, 20 * i + Math.random() * 30));
    }
  }
}
