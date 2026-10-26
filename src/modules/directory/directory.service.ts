import { Inject, Injectable } from '@nestjs/common';
import type { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { buildPaginationMeta } from '../../common/dto/pagination.util';
import type { RedirectionLinksPageDto } from './dto/redirection-link-response.dto';
import {
  type IRedirectionLinkRepository,
  REDIRECTION_LINK_REPOSITORY,
} from './interfaces/i-redirection-link.repository';

@Injectable()
export class DirectoryService {
  constructor(
    @Inject(REDIRECTION_LINK_REPOSITORY)
    private readonly redirectionLinkRepository: IRedirectionLinkRepository,
  ) {}

  async listActive(query: PaginationQueryDto): Promise<RedirectionLinksPageDto> {
    const { items, total } = await this.redirectionLinkRepository.findActivePaginated(
      query.skip,
      query.limit,
    );

    return {
      data: items.map((item) => ({
        id: item.id,
        project_name: item.projectName,
        url: item.url,
        description: item.description,
      })),
      meta: buildPaginationMeta(query.page, query.limit, total),
    };
  }
}
