import { BadGatewayException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary, type UploadApiResponse } from 'cloudinary';
import { Readable } from 'stream';
import type { EnvironmentVariables } from '../../config/env.validation';
import type { UploadMediaResponseDto } from './dto/upload-media-response.dto';

function cleanEnv(value?: string): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  return trimmed.replace(/^["'](.*)["']$/, '$1').trim();
}

@Injectable()
export class MediaService {
  private readonly logger = new Logger(MediaService.name);
  private readonly isConfigured: boolean;

  constructor(private readonly configService: ConfigService<EnvironmentVariables, true>) {
    const rawCloudName = this.configService.get('CLOUDINARY_CLOUD_NAME', { infer: true });
    const rawApiKey = this.configService.get('CLOUDINARY_API_KEY', { infer: true });
    const rawApiSecret = this.configService.get('CLOUDINARY_API_SECRET', { infer: true });

    const cloudName = cleanEnv(rawCloudName);
    const apiKey = cleanEnv(rawApiKey);
    const apiSecret = cleanEnv(rawApiSecret);

    if (cloudName && apiKey && apiSecret) {
      cloudinary.config({
        cloud_name: cloudName,
        api_key: apiKey,
        api_secret: apiSecret,
        secure: true,
      });
      this.isConfigured = true;
    } else if (process.env['CLOUDINARY_URL']) {
      cloudinary.config({
        secure: true,
      });
      this.isConfigured = true;
    } else {
      this.isConfigured = false;
      this.logger.warn(
        'Cloudinary no está configurado. Las subidas de archivos requerirán credenciales válidas en las variables de entorno.',
      );
    }
  }

  async uploadImage(
    file: Express.Multer.File,
    customFolder?: string,
  ): Promise<UploadMediaResponseDto> {
    if (!this.isConfigured) {
      throw new BadGatewayException(
        'El servicio de almacenamiento multimedia (Cloudinary) no está configurado en el servidor.',
      );
    }

    const defaultFolder =
      cleanEnv(this.configService.get('CLOUDINARY_FOLDER', { infer: true })) ?? 'asisconexion';
    const folder = customFolder ?? defaultFolder;

    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder,
          resource_type: 'image',
          quality: 'auto',
          fetch_format: 'auto',
        },
        (error, result?: UploadApiResponse) => {
          if (error || !result) {
            const rawMsg =
              error && typeof error === 'object' && 'message' in error
                ? String(error.message)
                : typeof error === 'string'
                  ? error
                  : 'Fallo al procesar y subir el archivo multimedia a Cloudinary.';
            this.logger.error(
              `Error al subir imagen a Cloudinary: ${rawMsg}`,
              JSON.stringify(error),
            );
            reject(
              new BadGatewayException(
                `Fallo en el servicio de almacenamiento (Cloudinary): ${rawMsg}`,
              ),
            );
            return;
          }

          resolve({
            url: result.secure_url,
            format: result.format,
            bytes: result.bytes,
          });
        },
      );

      Readable.from(file.buffer).pipe(uploadStream);
    });
  }
}
