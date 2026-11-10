import { ApiProperty } from '@nestjs/swagger';

export class UploadMediaResponseDto {
  @ApiProperty({
    example: 'https://res.cloudinary.com/demo/image/upload/v12345/asisconexion/photo.webp',
    description: 'URL pública y permanente de la imagen alojada en Cloudinary',
  })
  url!: string;

  @ApiProperty({
    example: 'webp',
    description: 'Formato optimizado de la imagen',
  })
  format!: string;

  @ApiProperty({
    example: 154200,
    description: 'Tamaño del archivo optimizado en bytes',
  })
  bytes!: number;
}
