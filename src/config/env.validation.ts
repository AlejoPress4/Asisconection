import { plainToInstance } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  Max,
  Min,
  MinLength,
  ValidateIf,
  validateSync,
} from 'class-validator';

export type NodeEnv = 'development' | 'production' | 'test';
export type AssistantEngineMode = 'faq';

/**
 * Contrato tipado de variables de entorno validado al iniciar la aplicación (Fail-Fast).
 */
export class EnvironmentVariables {
  @IsInt()
  @Min(1)
  @Max(65535)
  PORT: number = 3000;

  @IsIn(['development', 'production', 'test'])
  NODE_ENV: NodeEnv = 'development';

  @IsBoolean()
  USE_MOCK_EXTERNAL_SERVICES: boolean = false;

  @IsString()
  @IsNotEmpty()
  DB_LOCAL_URL!: string;

  @ValidateIf((env: EnvironmentVariables) => !env.USE_MOCK_EXTERNAL_SERVICES)
  @IsUrl({ require_tld: false, require_protocol: true })
  RENDER_API_URL?: string;

  @IsString()
  @IsNotEmpty()
  RENDER_REGISTER_PATH: string = '/auth/registro';

  @IsString()
  @IsNotEmpty()
  RENDER_LOGIN_PATH: string = '/auth/login';

  @IsString()
  @IsNotEmpty()
  RENDER_PROFILE_PATH: string = '/auth/perfil';

  @IsInt()
  @Min(500)
  @Max(60000)
  RENDER_HTTP_TIMEOUT_MS: number = 5000;

  @IsString()
  @MinLength(32)
  JWT_SECRET!: string;

  @IsString()
  @IsNotEmpty()
  JWT_EXPIRES_IN: string = '30d';

  @IsInt()
  @Min(1)
  @Max(100)
  ANON_MAX_POSTS_PER_DAY: number = 3;

  @IsInt()
  @Min(1)
  @Max(200)
  ANON_MAX_COMMENTS_PER_DAY: number = 10;

  @IsString()
  @Matches(/^\d{7,15}$/, {
    message: 'WHATSAPP_SUPPORT_PHONE debe contener únicamente dígitos (7 a 15 caracteres).',
  })
  WHATSAPP_SUPPORT_PHONE!: string;

  @IsString()
  @IsNotEmpty()
  WHATSAPP_DEFAULT_MESSAGE: string =
    'Hola Fundación Asisco, requiero acompañamiento humano desde AsisConexión.';

  @IsIn(['faq'])
  ASSISTANT_ENGINE: AssistantEngineMode = 'faq';

  @IsOptional()
  @IsString()
  CORS_ORIGINS?: string;
}

const str = (val: unknown, fallback?: string): string | undefined =>
  typeof val === 'string' && val.trim() !== '' ? val.trim() : fallback;

const int = (val: unknown, fallback: number): number => {
  if (typeof val === 'number' && Number.isFinite(val)) return val;
  if (typeof val === 'string' && val.trim() !== '') return Number.parseInt(val.trim(), 10);
  return fallback;
};

const bool = (val: unknown, fallback: boolean): boolean => {
  if (typeof val === 'boolean') return val;
  if (typeof val === 'string') {
    const v = val.trim().toLowerCase();
    if (v === 'true' || v === '1') return true;
    if (v === 'false' || v === '0' || v === '') return false;
  }
  return fallback;
};

export function validate(config: Record<string, unknown>): EnvironmentVariables {
  const normalized = {
    PORT: int(config['PORT'], 3000),
    NODE_ENV: str(config['NODE_ENV'], 'development'),
    USE_MOCK_EXTERNAL_SERVICES: bool(config['USE_MOCK_EXTERNAL_SERVICES'], false),
    DB_LOCAL_URL: str(config['DB_LOCAL_URL']),
    RENDER_API_URL:
      str(config['EXTERNAL_AUTH_API_URL']) ??
      str(config['RENDER_API_URL']) ??
      str(config['RENDER_AUTH_API_URL']),
    RENDER_REGISTER_PATH: str(config['RENDER_REGISTER_PATH'], '/auth/registro'),
    RENDER_LOGIN_PATH: str(config['RENDER_LOGIN_PATH'], '/auth/login'),
    RENDER_PROFILE_PATH: str(config['RENDER_PROFILE_PATH'], '/auth/perfil'),
    RENDER_HTTP_TIMEOUT_MS: int(config['RENDER_HTTP_TIMEOUT_MS'], 5000),
    JWT_SECRET: str(config['JWT_SECRET']),
    JWT_EXPIRES_IN: str(config['JWT_EXPIRES_IN'], '30d'),
    ANON_MAX_POSTS_PER_DAY: int(config['ANON_MAX_POSTS_PER_DAY'], 3),
    ANON_MAX_COMMENTS_PER_DAY: int(config['ANON_MAX_COMMENTS_PER_DAY'], 10),
    WHATSAPP_SUPPORT_PHONE: str(config['WHATSAPP_SUPPORT_PHONE']),
    WHATSAPP_DEFAULT_MESSAGE: str(
      config['WHATSAPP_DEFAULT_MESSAGE'],
      'Hola Fundación Asisco, requiero acompañamiento humano desde AsisConexión.',
    ),
    ASSISTANT_ENGINE: str(config['ASSISTANT_ENGINE'], 'faq'),
    CORS_ORIGINS: str(config['CORS_ORIGINS']),
  };

  const validated = plainToInstance(EnvironmentVariables, normalized, {
    enableImplicitConversion: false,
  });
  const errors = validateSync(validated, { skipMissingProperties: false });

  if (errors.length > 0) {
    const details = errors
      .map((e) => `${e.property}: ${Object.values(e.constraints ?? {}).join(', ') || 'inválido'}`)
      .join('; ');
    throw new Error(`Error de configuración en variables de entorno: ${details}`);
  }

  return validated;
}
