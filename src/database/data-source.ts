import 'dotenv/config';
import { join } from 'path';
import { DataSource } from 'typeorm';

const dbLocalUrl = process.env['DB_LOCAL_URL'];

if (!dbLocalUrl) {
  throw new Error('DB_LOCAL_URL es requerido para ejecutar migraciones o semillas sobre ASISCONEXION_DB.');
}

const useSsl =
  dbLocalUrl.includes('.supabase.co') ||
  dbLocalUrl.includes('.supabase.com') ||
  dbLocalUrl.includes('sslmode=require');

const AppDataSource = new DataSource({
  type: 'postgres',
  url: dbLocalUrl,
  ssl: useSsl ? { rejectUnauthorized: false } : false,
  entities: [join(__dirname, '..', 'modules', '**', '*.entity.{ts,js}')],
  migrations: [join(__dirname, 'migrations', '*.{ts,js}')],
  synchronize: false,
  migrationsRun: false,
});

export default AppDataSource;
