import type { DataSource } from 'typeorm';
import { Category } from '../../modules/social/entities/category.entity';

interface CategorySeedItem {
  readonly name: string;
  readonly mainTopic: string;
  readonly description: string;
  readonly coverImageUrl: string | null;
}

const DEFAULT_CATEGORIES: ReadonlyArray<CategorySeedItem> = [
  {
    name: 'Apoyo Pedagógico',
    mainTopic: 'Educación',
    description:
      'Espacio comunitario para compartir experiencias educativas, adaptaciones y acompañamiento familiar.',
    coverImageUrl: 'https://cdn.asisco.org/categories/apoyo-pedagogico.jpg',
  },
  {
    name: 'Salud y Bienestar',
    mainTopic: 'Salud',
    description:
      'Orientación entre familias y profesionales sobre autocuidado, terapias y desarrollo integral.',
    coverImageUrl: 'https://cdn.asisco.org/categories/salud-bienestar.jpg',
  },
  {
    name: 'Voluntariado',
    mainTopic: 'Comunidad',
    description:
      'Iniciativas solidarias, jornadas de participación y articulación de voluntarios de la Fundación Asisco.',
    coverImageUrl: 'https://cdn.asisco.org/categories/voluntariado.jpg',
  },
  {
    name: 'Noticias de la Fundación',
    mainTopic: 'Institucional',
    description:
      'Convocatorias oficiales, talleres, logros comunitarios y novedades institucionales.',
    coverImageUrl: 'https://cdn.asisco.org/categories/noticias.jpg',
  },
];

export async function seedCategories(dataSource: DataSource): Promise<void> {
  const repo = dataSource.getRepository(Category);

  for (const item of DEFAULT_CATEGORIES) {
    await repo.upsert(
      {
        name: item.name,
        mainTopic: item.mainTopic,
        description: item.description,
        coverImageUrl: item.coverImageUrl,
      },
      ['name'],
    );
  }
}
