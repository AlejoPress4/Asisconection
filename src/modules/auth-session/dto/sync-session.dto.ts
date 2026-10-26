import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { Equals, IsBoolean, IsNotEmpty, IsString, Length, MaxLength } from 'class-validator';
import { preserveRawConsentValue } from '../../../common/utils/strict-boolean.util';

export class SyncSessionDto {
  @ApiProperty({
    maxLength: 120,
    description: 'Username o email registrado en el ecosistema general fundacional.',
    example: 'maria.acudiente',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  identifier!: string;

  @ApiProperty({
    minLength: 8,
    maxLength: 128,
    writeOnly: true,
    example: 'ClaveAcudiente2026',
  })
  @IsString()
  @Length(8, 128)
  clave!: string;

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
