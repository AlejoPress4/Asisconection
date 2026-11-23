import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class EscalateRequestDto {
  @ApiPropertyOptional({
    maxLength: 120,
    example: 'Orientación sobre matrícula AULA UP',
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  topic?: string;
}

export class EscalateResponseDto {
  @ApiProperty({
    format: 'uri',
    example: 'https://wa.me/573001234567?text=Hola%20Fundaci%C3%B3n%20Asisco',
  })
  whatsapp_url!: string;

  @ApiProperty({
    example: '573001234567',
  })
  phone!: string;

  @ApiProperty({
    example: 'Hola Fundación Asisco, requiero acompañamiento humano desde AsisConexión.',
  })
  message!: string;

  @ApiProperty({
    example: 'Serás redirigido de forma nativa al canal humano oficial en WhatsApp.',
  })
  support_message!: string;
}
