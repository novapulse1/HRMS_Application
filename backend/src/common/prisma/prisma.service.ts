import { PrismaClient } from '@prisma/client';

class PrismaServiceSingleton {
  private static instance: PrismaClient;

  public static getInstance(): PrismaClient {
    if (!PrismaServiceSingleton.instance) {
      PrismaServiceSingleton.instance = new PrismaClient({
        log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
      });
    }
    return PrismaServiceSingleton.instance;
  }
}

export const prisma = PrismaServiceSingleton.getInstance();
export default prisma;
