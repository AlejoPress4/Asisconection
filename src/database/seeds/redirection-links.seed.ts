import type { DataSource } from 'typeorm';
import { RedirectionLink } from '../../modules/directory/entities/redirection-link.entity';

interface RedirectionLinkSeedItem {
  readonly projectName: string;
  readonly url: string;
  readonly description: string;
}

const DEFAULT_SATELLITE_LINKS: ReadonlyArray<RedirectionLinkSeedItem> = [
  {
    projectName: 'SUMA 21',
    // TODO: confirmar URL oficial con la Fundación
    url: 'https://suma21.fundacionasisco.org',
    description: 'Programa y plataforma de inclusión social y formación integral.',
  },
  {
    projectName: 'AULA UP',
    // TODO: confirmar URL oficial con la Fundación
    url: 'https://aulaup.fundacionasisco.org',
    description: 'Entorno virtual de acompañamiento pedagógico y fortalecimiento educativo.',
  },
  {
    projectName: 'SAGA-UP',
    // TODO: confirmar URL oficial con la Fundación
    url: 'https://sagaup.fundacionasisco.org',
    description: 'Sistema académico y de seguimiento para beneficiarios y familias.',
  },
];

export async function seedRedirectionLinks(dataSource: DataSource): Promise<void> {
  const repo = dataSource.getRepository(RedirectionLink);

  for (const item of DEFAULT_SATELLITE_LINKS) {
    const existing = await repo.findOne({
      where: { projectName: item.projectName },
      select: { id: true },
    });

    if (!existing) {
      const entity = repo.create({
        projectName: item.projectName,
        url: item.url,
        description: item.description,
        isActive: true,
      });
      await repo.save(entity);
    }
  }
}
