import type { DataSource } from 'typeorm';
import { Category } from '../../modules/social/entities/category.entity';

interface CategorySeedItem {
  readonly name: string;
  readonly description: string;
}

const DEFAULT_CATEGORIES: ReadonlyArray<CategorySeedItem> = [
  {
    name: 'Apoyo Pedagógico',
    description:
      'Espacio comunitario para compartir experiencias educativas, adaptaciones y acompañamiento familiar.',
  },
  {
    name: 'Salud y Bienestar',
    description:
      'Orientación entre familias y profesionales sobre autocuidado, terapias y desarrollo integral.',
  },
  {
    name: 'Voluntariado',
    description:
      'Iniciativas solidarias, jornadas de participación y articulación de voluntarios de la Fundación Asisco.',
  },
  {
    name: 'Noticias de la Fundación',
    description:
      'Convocatorias oficiales, talleres, logros comunitarios y novedades institucionales.',
  },
];

export async function seedCategories(dataSource: DataSource): Promise<void> {
  const repo = dataSource.getRepository(Category);

  for (const item of DEFAULT_CATEGORIES) {
    await repo.upsert(
      {
        name: item.name,
        description: item.description,
      },
      ['name'],
    );
  }
}
