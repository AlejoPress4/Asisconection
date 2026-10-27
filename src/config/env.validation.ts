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

function parseBooleanEnv(value: unknown, fallback: boolean): boolean {
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true' || normalized === '1') {
      return true;
    }
    if (normalized === 'false' || normalized === '0' || normalized === '') {
      return false;
    }
  }
  return fallback;
}

function parseIntEnv(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number.parseInt(value.trim(), 10);
    return Number.isNaN(parsed) ? Number.NaN : parsed;
  }
  return fallback;
}

function parseStringEnv(value: unknown, fallback?: string): string | undefined {
  if (typeof value === 'string' && value.trim() !== '') {
    return value.trim();
  }
  return fallback;
}

export function validate(config: Record<string, unknown>): EnvironmentVariables {
  const renderUrl =
    parseStringEnv(config['EXTERNAL_AUTH_API_URL']) ??
    parseStringEnv(config['RENDER_API_URL']) ??
    parseStringEnv(config['RENDER_AUTH_API_URL']);

  const normalized: Record<string, unknown> = {
    PORT: parseIntEnv(config['PORT'], 3000),
    NODE_ENV: parseStringEnv(config['NODE_ENV'], 'development'),
    USE_MOCK_EXTERNAL_SERVICES: parseBooleanEnv(config['USE_MOCK_EXTERNAL_SERVICES'], false),
    DB_LOCAL_URL: parseStringEnv(config['DB_LOCAL_URL']),
    RENDER_API_URL: renderUrl,
    RENDER_REGISTER_PATH: parseStringEnv(config['RENDER_REGISTER_PATH'], '/auth/registro'),
    RENDER_LOGIN_PATH: parseStringEnv(config['RENDER_LOGIN_PATH'], '/auth/login'),
    RENDER_PROFILE_PATH: parseStringEnv(config['RENDER_PROFILE_PATH'], '/auth/perfil'),
    RENDER_HTTP_TIMEOUT_MS: parseIntEnv(config['RENDER_HTTP_TIMEOUT_MS'], 5000),
    JWT_SECRET: parseStringEnv(config['JWT_SECRET']),
    JWT_EXPIRES_IN: parseStringEnv(config['JWT_EXPIRES_IN'], '30d'),
    ANON_MAX_POSTS_PER_DAY: parseIntEnv(config['ANON_MAX_POSTS_PER_DAY'], 3),
    ANON_MAX_COMMENTS_PER_DAY: parseIntEnv(config['ANON_MAX_COMMENTS_PER_DAY'], 10),
    WHATSAPP_SUPPORT_PHONE: parseStringEnv(config['WHATSAPP_SUPPORT_PHONE']),
    WHATSAPP_DEFAULT_MESSAGE: parseStringEnv(
      config['WHATSAPP_DEFAULT_MESSAGE'],
      'Hola Fundación Asisco, requiero acompañamiento humano desde AsisConexión.',
    ),
    ASSISTANT_ENGINE: parseStringEnv(config['ASSISTANT_ENGINE'], 'faq'),
    CORS_ORIGINS: parseStringEnv(config['CORS_ORIGINS']),
  };

  const validatedConfig = plainToInstance(EnvironmentVariables, normalized, {
    enableImplicitConversion: false,
  });

  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    const messages = errors
      .map((err) => {
        const constraints = err.constraints ? Object.values(err.constraints).join(', ') : 'inválido';
        return `${err.property}: ${constraints}`;
      })
      .join('; ');
    throw new Error(`Error de configuración en variables de entorno: ${messages}`);
  }

  return validatedConfig;
}
