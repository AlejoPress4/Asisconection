import { PaginationMetaDto } from './pagination-meta.dto';

export function buildPaginationMeta(
  page: number,
  limit: number,
  totalItems: number,
): PaginationMetaDto {
  const totalPages = totalItems === 0 ? 0 : Math.ceil(totalItems / limit);
  return {
    page,
    limit,
    total_items: totalItems,
    total_pages: totalPages,
    has_next_page: page < totalPages,
  };
}
