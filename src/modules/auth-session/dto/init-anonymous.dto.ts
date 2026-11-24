import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { Equals, IsBoolean, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { preserveRawConsentValue } from '../../../common/utils/strict-boolean.util';

export const ALLOWED_ANONYMOUS_ROLE_TAGS = [
  'VISITANTE',
  'ACUDIENTE',
  'VOLUNTARIO',
  'INVERSOR',
  'BENEFICIARIO',
] as const;

export class InitAnonymousSessionDto {
  @ApiPropertyOptional({
    maxLength: 50,
    example: 'Colibrí Alegre',
    description:
      'Apodo opcional. Si se omite o es genérico, el servidor genera un apodo familiar aleatorio.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  nickname?: string;

  @ApiPropertyOptional({
    maxLength: 40,
    enum: ALLOWED_ANONYMOUS_ROLE_TAGS,
    example: 'VISITANTE',
    description: 'Etiqueta comunitaria de la sesión anónima (por defecto VISITANTE).',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsString()
  @MaxLength(40)
  @IsIn(ALLOWED_ANONYMOUS_ROLE_TAGS, {
    message:
      'role_tag debe ser una etiqueta comunitaria permitida (VISITANTE, ACUDIENTE, VOLUNTARIO, INVERSOR o BENEFICIARIO).',
  })
  role_tag?: string;

  @ApiProperty({
    description: 'Aceptación obligatoria Ley 1581 de 2012 y Ley 1098 de 2006.',
    example: true,
  })
  @Transform(preserveRawConsentValue)
  @IsBoolean()
  @Equals(true, {
    message:
      'Debe aceptar expresamente el tratamiento de datos personales (Ley 1581 de 2012 y Ley 1098 de 2006).',
  })
  accept_consent!: boolean;
}
