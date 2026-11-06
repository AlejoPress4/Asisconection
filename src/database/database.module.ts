import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import type { EnvironmentVariables } from '../config/env.validation';

function requiresSsl(dbUrl: string): boolean {
  return (
    dbUrl.includes('.supabase.co') ||
    dbUrl.includes('.supabase.com') ||
    dbUrl.includes('sslmode=require')
  );
}

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<EnvironmentVariables, true>) => {
        const dbUrl = config.get('DB_LOCAL_URL', { infer: true });
        return {
          type: 'postgres',
          url: dbUrl,
          ssl: requiresSsl(dbUrl) ? { rejectUnauthorized: false } : false,
          autoLoadEntities: true,
          synchronize: false,
          migrationsRun: false,
        };
      },
    }),
  ],
})
export class DatabaseModule {}
