import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddActorPrivacyAndProfileFields1761510000000 implements MigrationInterface {
  name = 'AddActorPrivacyAndProfileFields1761510000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "actors"
        ADD COLUMN IF NOT EXISTS "birth_date" varchar(20) NULL,
        ADD COLUMN IF NOT EXISTS "city" varchar(80) NULL,
        ADD COLUMN IF NOT EXISTS "show_email" boolean NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS "show_birth_date" boolean NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS "show_city" boolean NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS "require_follow_approval" boolean NOT NULL DEFAULT false;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "actors"
        DROP COLUMN IF EXISTS "require_follow_approval",
        DROP COLUMN IF EXISTS "show_city",
        DROP COLUMN IF EXISTS "show_birth_date",
        DROP COLUMN IF EXISTS "show_email",
        DROP COLUMN IF EXISTS "city",
        DROP COLUMN IF EXISTS "birth_date";
    `);
  }
}
