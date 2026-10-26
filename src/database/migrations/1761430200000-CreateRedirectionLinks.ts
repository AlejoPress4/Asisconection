import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateRedirectionLinks1761430200000 implements MigrationInterface {
  name = 'CreateRedirectionLinks1761430200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "redirection_links" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "project_name" character varying(100) NOT NULL,
        "url" character varying(500) NOT NULL,
        "description" text NOT NULL,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_redirection_links_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "IDX_redirection_links_is_active" ON "redirection_links" ("is_active")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_redirection_links_is_active"`);
    await queryRunner.query(`DROP TABLE "redirection_links"`);
  }
}
