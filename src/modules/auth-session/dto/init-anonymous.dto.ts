import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { Equals, IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';
import { preserveRawConsentValue } from '../../../common/utils/strict-boolean.util';

export class InitAnonymousSessionDto {
  @ApiPropertyOptional({
    maxLength: 50,
    example: 'MamáDeMateo',
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  nickname?: string;

  @ApiPropertyOptional({
    maxLength: 40,
    example: 'ACUDIENTE',
  })
  @IsOptional()
  @IsString()
  @MaxLength(40)
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
