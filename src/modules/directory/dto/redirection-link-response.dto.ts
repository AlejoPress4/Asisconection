import { ApiProperty } from '@nestjs/swagger';
import { PaginationMetaDto } from '../../../common/dto/pagination-meta.dto';

export class RedirectionLinkItemDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'SUMA 21' })
  project_name!: string;

  @ApiProperty({ format: 'uri', example: 'https://suma21.fundacionasisco.org' })
  url!: string;

  @ApiProperty({ example: 'Plataforma de inclusión y formación integral.' })
  description!: string;
}

export class RedirectionLinksPageDto {
  @ApiProperty({ type: () => [RedirectionLinkItemDto] })
  data!: RedirectionLinkItemDto[];

  @ApiProperty({ type: () => PaginationMetaDto })
  meta!: PaginationMetaDto;
}
