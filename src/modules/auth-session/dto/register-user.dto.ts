import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  Equals,
  IsBoolean,
  IsEmail,
  IsIn,
  IsString,
  Length,
  MaxLength,
} from 'class-validator';
import { preserveRawConsentValue } from '../../../common/utils/strict-boolean.util';

export const ALLOWED_REGISTRATION_ROLES = [
  'ACUDIENTE',
  'VOLUNTARIO',
  'INVERSOR',
  'BENEFICIARIO',
  'ADMIN',
] as const;

export type RegistrationRole = (typeof ALLOWED_REGISTRATION_ROLES)[number];

export class RegisterUserDto {
  @ApiProperty({
    minLength: 3,
    maxLength: 80,
    example: 'maria.acudiente',
  })
  @IsString()
  @Length(3, 80)
  username!: string;

  @ApiProperty({
    format: 'email',
    maxLength: 120,
    example: 'maria@prueba.com',
  })
  @IsEmail()
  @MaxLength(120)
  email!: string;

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
    enum: ALLOWED_REGISTRATION_ROLES,
    maxLength: 40,
    example: 'ACUDIENTE',
  })
  @IsString()
  @MaxLength(40)
  @IsIn(ALLOWED_REGISTRATION_ROLES)
  rol!: RegistrationRole;

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
