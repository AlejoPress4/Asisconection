import 'dotenv/config';
import { join } from 'path';
import { DataSource } from 'typeorm';

const dbLocalUrl = process.env['DB_LOCAL_URL'];

if (!dbLocalUrl) {
  throw new Error('DB_LOCAL_URL es requerido para ejecutar migraciones o semillas sobre ASISCONEXION_DB.');
}

export const AppDataSource = new DataSource({
  type: 'postgres',
  url: dbLocalUrl,
  entities: [join(__dirname, '..', 'modules', '**', '*.entity.{ts,js}')],
  migrations: [join(__dirname, 'migrations', '*.{ts,js}')],
  synchronize: false,
  migrationsRun: false,
});

export default AppDataSource;
