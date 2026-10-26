export interface CategoryProjection {
  readonly id: string;
  readonly name: string;
  readonly description: string;
}

export interface ICategoryRepository {
  findPaginated(
    skip: number,
    take: number,
  ): Promise<{ items: CategoryProjection[]; total: number }>;
  existsById(id: string): Promise<boolean>;
}

export const CATEGORY_REPOSITORY = Symbol('CATEGORY_REPOSITORY');
