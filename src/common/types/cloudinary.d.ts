declare module 'cloudinary' {
  import type { Writable } from 'stream';

  export interface UploadApiResponse {
    secure_url: string;
    format: string;
    bytes: number;
  }

  export interface UploadApiErrorResponse {
    message: string;
    http_code?: number;
  }

  export interface CloudinaryConfigOptions {
    cloud_name?: string;
    api_key?: string;
    api_secret?: string;
    secure?: boolean;
  }

  export interface UploadStreamOptions {
    folder?: string;
    resource_type?: 'image' | 'video' | 'raw' | 'auto';
    quality?: string;
    fetch_format?: string;
  }

  export const v2: {
    config(options: CloudinaryConfigOptions): void;
    uploader: {
      upload_stream(
        options: UploadStreamOptions,
        callback: (
          error: UploadApiErrorResponse | undefined,
          result?: UploadApiResponse,
        ) => void,
      ): Writable;
    };
  };
}
