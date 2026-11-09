import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { seedRedirectionLinks } from '../../../database/seeds/redirection-links.seed';
import { RedirectionLink } from '../entities/redirection-link.entity';
import type {
  IRedirectionLinkRepository,
  RedirectionLinkProjection,
} from '../interfaces/i-redirection-link.repository';

@Injectable()
export class RedirectionLinkRepository implements IRedirectionLinkRepository, OnModuleInit {
  private readonly logger = new Logger(RedirectionLinkRepository.name);

  constructor(
    @InjectRepository(RedirectionLink)
    private readonly repository: Repository<RedirectionLink>,
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      await seedRedirectionLinks(this.repository.manager.connection);
    } catch (error) {
      // Mock environments: the standalone seed script remains available.
      this.logger.warn(
        `No se pudo asegurar el catálogo del ecosistema: ${
          error instanceof Error ? error.message : 'error desconocido'
        }`,
      );
    }
  }

  async findActivePaginated(
    skip: number,
    take: number,
  ): Promise<{ items: RedirectionLinkProjection[]; total: number }> {
    const [entities, total] = await this.repository
      .createQueryBuilder('rl')
      .select(['rl.id', 'rl.projectName', 'rl.url', 'rl.description'])
      .where('rl.isActive = :isActive', { isActive: true })
      .orderBy('rl.projectName', 'ASC')
      .skip(skip)
      .take(take)
      .getManyAndCount();

    const items: RedirectionLinkProjection[] = entities.map((entity) => ({
      id: entity.id,
      projectName: entity.projectName,
      url: entity.url,
      description: entity.description,
    }));

    return { items, total };
  }
}
