import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  Equals,
  IsBoolean,
  IsNotEmpty,
  IsString,
  Length,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { preserveRawConsentValue } from '../../../common/utils/strict-boolean.util';

export class SyncSessionDto {
  @ApiPropertyOptional({
    maxLength: 120,
    description: 'Username o email registrado en el servicio central (alias compatible).',
    example: 'maria@prueba.com',
  })
  @ValidateIf((dto: SyncSessionDto) => !dto.email)
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  identifier?: string;

  @ApiPropertyOptional({
    maxLength: 120,
    description: 'Email o identificador de inicio de sesión.',
    example: 'maria@prueba.com',
  })
  @ValidateIf((dto: SyncSessionDto) => !dto.identifier)
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  email?: string;

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

export { SyncSessionDto as LoginUserDto };
