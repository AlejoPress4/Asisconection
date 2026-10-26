import { Module } from '@nestjs/common';
import { ConditionalModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import type { EnvironmentVariables } from '../config/env.validation';
import { GlobalUserViewEntity } from './external-entities/global-user.view-entity';

function shouldEnableGlobalDb(env: NodeJS.ProcessEnv): boolean {
  const flag = env['USE_MOCK_EXTERNAL_SERVICES']?.trim().toLowerCase();
  return flag !== 'true' && flag !== '1';
}

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<EnvironmentVariables, true>) => ({
        type: 'postgres',
        url: config.get('DB_LOCAL_URL', { infer: true }),
        autoLoadEntities: true,
        synchronize: false,
        migrationsRun: false,
      }),
    }),
    ConditionalModule.registerWhen(
      TypeOrmModule.forRootAsync({
        name: 'global_db',
        inject: [ConfigService],
        useFactory: (config: ConfigService<EnvironmentVariables, true>) => ({
          type: 'postgres',
          url: config.get('DB_GLOBAL_URL', { infer: true }),
          entities: [GlobalUserViewEntity],
          synchronize: false,
          migrationsRun: false,
          extra: {
            options: '-c default_transaction_read_only=on',
          },
        }),
      }),
      shouldEnableGlobalDb,
    ),
  ],
})
export class DatabaseModule {}
