import {
  BadRequestException,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBadGatewayResponse,
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConsumes,
  ApiCreatedResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ProblemDetailsDto } from '../../common/filters/all-exceptions.filter';
import { DeviceSessionGuard } from '../../common/guards/device-session.guard';
import { UploadMediaResponseDto } from './dto/upload-media-response.dto';
import { MediaService } from './media.service';

const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

@ApiTags('Media')
@ApiBearerAuth('DeviceSessionBearer')
@UseGuards(DeviceSessionGuard)
@Controller('media')
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  @Post('upload')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Sube un archivo de imagen a almacenamiento en la nube (Cloudinary) y devuelve su URL',
  })
  @ApiCreatedResponse({
    description: 'Imagen subida exitosamente con URL permanente y metadatos',
    type: UploadMediaResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Archivo ausente, formato inválido o tamaño superior a 5 MB',
    type: ProblemDetailsDto,
  })
  @ApiUnauthorizedResponse({
    description: 'DeviceSession ausente, inválida o expirada',
    type: ProblemDetailsDto,
  })
  @ApiBadGatewayResponse({
    description: 'Error o indisponibilidad en el servicio externo de almacenamiento Cloudinary',
    type: ProblemDetailsDto,
  })
  async uploadFile(
    @UploadedFile() file?: Express.Multer.File,
  ): Promise<UploadMediaResponseDto> {
    if (!file) {
      throw new BadRequestException('Debe adjuntar un archivo en el campo "file".');
    }

    if (!ALLOWED_MIME_TYPES.has(file.mimetype.toLowerCase())) {
      throw new BadRequestException(
        `Formato de imagen inválido (${file.mimetype}). Solo se admiten archivos JPG, PNG y WEBP.`,
      );
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      throw new BadRequestException('La imagen excede el límite máximo permitido de 5 MB.');
    }

    return this.mediaService.uploadImage(file);
  }
}
