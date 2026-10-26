import { ApiProperty } from '@nestjs/swagger';
import { PaginationMetaDto } from '../../../common/dto/pagination-meta.dto';

export class FaqItemDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: '¿Cómo inscribo a un beneficiario en SUMA 21?' })
  question!: string;

  @ApiProperty({
    example:
      'Puedes acercarte a la sede principal o comunicarte por el canal oficial de WhatsApp con el documento de identidad del acudiente y del beneficiario.',
  })
  answer!: string;

  @ApiProperty({ example: 'Inscripciones' })
  category!: string;
}

export class FaqPageDto {
  @ApiProperty({
    example:
      'Esta orientación automatizada es de carácter informativo y no reemplaza la atención profesional o administrativa directa de la Fundación Asisco.',
  })
  disclaimer!: string;

  @ApiProperty({ type: () => [FaqItemDto] })
  data!: FaqItemDto[];

  @ApiProperty({ type: () => PaginationMetaDto })
  meta!: PaginationMetaDto;
}
