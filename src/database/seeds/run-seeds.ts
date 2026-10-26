import { Logger } from '@nestjs/common';
import type { DataSource } from 'typeorm';
import AppDataSource from '../data-source';
import { seedCategories } from './categories.seed';
import { seedFaqKnowledge } from './faq-knowledge.seed';
import { seedRedirectionLinks } from './redirection-links.seed';

export type SeederFn = (dataSource: DataSource) => Promise<void>;

export const seeders: ReadonlyArray<SeederFn> = [
  seedCategories,
  seedRedirectionLinks,
  seedFaqKnowledge,
];

export async function runAllSeeds(dataSource: DataSource = AppDataSource): Promise<void> {
  const logger = new Logger('DatabaseSeeder');
  const shouldInitialize = !dataSource.isInitialized;

  if (shouldInitialize) {
    await dataSource.initialize();
  }

  try {
    for (const seeder of seeders) {
      await seeder(dataSource);
    }
    logger.log(`Ejecutados ${seeders.length} seeders de forma idempotente.`);
  } finally {
    if (shouldInitialize && dataSource.isInitialized) {
      await dataSource.destroy();
    }
  }
}

if (require.main === module) {
  runAllSeeds().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Error ejecutando semillas: ${message}`);
    process.exit(1);
  });
}
