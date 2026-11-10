import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddLastNotificationsReadAt1761520000000 implements MigrationInterface {
  name = 'AddLastNotificationsReadAt1761520000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "actors"
        ADD COLUMN IF NOT EXISTS "last_notifications_read_at" timestamptz NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "actors"
        DROP COLUMN IF EXISTS "last_notifications_read_at";
    `);
  }
}
