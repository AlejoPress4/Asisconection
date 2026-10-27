export interface CategoryProjection {
  readonly id: string;
  readonly name: string;
  readonly mainTopic?: string;
  readonly description: string;
  readonly coverImageUrl?: string | null;
}

export interface ICategoryRepository {
  findPaginated(
    skip: number,
    take: number,
  ): Promise<{ items: CategoryProjection[]; total: number }>;
  existsById(id: string): Promise<boolean>;
}

export const CATEGORY_REPOSITORY = Symbol('CATEGORY_REPOSITORY');
