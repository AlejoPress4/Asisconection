import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { buildPaginationMeta } from '../../common/dto/pagination.util';
import type {
  CreateRedirectionLinkDto,
  DeletedRedirectionLinkResponseDto,
  RedirectionLinkItemDto,
  RedirectionLinksPageDto,
  UpdateRedirectionLinkDto,
} from './dto/redirection-link-response.dto';
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

  async createLink(dto: CreateRedirectionLinkDto): Promise<RedirectionLinkItemDto> {
    if (!this.redirectionLinkRepository.create) {
      throw new NotFoundException('El repositorio del directorio no soporta creación.');
    }

    const created = await this.redirectionLinkRepository.create({
      projectName: dto.project_name,
      url: dto.url,
      description: dto.description,
    });

    return {
      id: created.id,
      project_name: created.projectName,
      url: created.url,
      description: created.description,
    };
  }

  async updateLink(id: string, dto: UpdateRedirectionLinkDto): Promise<RedirectionLinkItemDto> {
    if (
      dto.project_name === undefined &&
      dto.url === undefined &&
      dto.description === undefined &&
      dto.is_active === undefined
    ) {
      throw new BadRequestException(
        'Debe proporcionar al menos un campo (project_name, url, description o is_active) para actualizar el enlace.',
      );
    }

    if (!this.redirectionLinkRepository.update) {
      throw new NotFoundException('El repositorio del directorio no soporta actualización.');
    }

    const updated = await this.redirectionLinkRepository.update(id, {
      projectName: dto.project_name,
      url: dto.url,
      description: dto.description,
      isActive: dto.is_active,
    });

    if (!updated) {
      throw new NotFoundException(`No existe un enlace en el directorio con id "${id}".`);
    }

    return {
      id: updated.id,
      project_name: updated.projectName,
      url: updated.url,
      description: updated.description,
    };
  }

  async deleteLink(id: string): Promise<DeletedRedirectionLinkResponseDto> {
    if (!this.redirectionLinkRepository.deleteById) {
      throw new NotFoundException('El repositorio del directorio no soporta eliminación.');
    }

    const deleted = await this.redirectionLinkRepository.deleteById(id);
    if (!deleted) {
      throw new NotFoundException(`No existe un enlace en el directorio con id "${id}".`);
    }

    return {
      id,
      deleted: true,
    };
  }
}
