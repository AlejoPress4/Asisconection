import type { MigrationInterface, QueryRunner } from 'typeorm';

export class InitAuthSession1761430000000 implements MigrationInterface {
  name = 'InitAuthSession1761430000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    await queryRunner.query(`
      CREATE TABLE "user_accounts" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "external_user_id" character varying(120),
        "username" character varying(80) NOT NULL,
        "email" character varying(120) NOT NULL,
        "rol" character varying(40) NOT NULL,
        "is_active" boolean NOT NULL DEFAULT true,
        "last_synced_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_user_accounts_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_user_accounts_external_user_id" UNIQUE ("external_user_id"),
        CONSTRAINT "UQ_user_accounts_username" UNIQUE ("username"),
        CONSTRAINT "UQ_user_accounts_email" UNIQUE ("email")
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "IDX_user_accounts_is_active" ON "user_accounts" ("is_active")`,
    );

    await queryRunner.query(`
      CREATE TABLE "device_sessions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_account_id" uuid,
        "device_token" character varying(512) NOT NULL,
        "nickname" character varying(50),
        "role_tag" character varying(40),
        "consent_accepted_at" TIMESTAMP WITH TIME ZONE,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_device_sessions_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_device_sessions_device_token" UNIQUE ("device_token"),
        CONSTRAINT "FK_device_sessions_user_account_id" FOREIGN KEY ("user_account_id")
          REFERENCES "user_accounts"("id") ON DELETE SET NULL ON UPDATE NO ACTION
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "IDX_device_sessions_user_account_id" ON "device_sessions" ("user_account_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_device_sessions_user_account_id"`);
    await queryRunner.query(`DROP TABLE "device_sessions"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_user_accounts_is_active"`);
    await queryRunner.query(`DROP TABLE "user_accounts"`);
  }
}
