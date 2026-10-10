import type { PrismaClient } from "@prisma/client";
import { createDatabase } from "../../scripts/database.mjs";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? createDatabase();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
