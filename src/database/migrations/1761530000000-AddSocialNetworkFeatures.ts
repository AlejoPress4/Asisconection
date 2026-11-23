import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSocialNetworkFeatures1761530000000 implements MigrationInterface {
  name = 'AddSocialNetworkFeatures1761530000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "post_bookmarks" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "post_id" uuid NOT NULL,
        "device_id" uuid NOT NULL,
        "user_account_id" uuid NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_post_bookmarks_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_post_bookmarks_post_device" UNIQUE ("post_id", "device_id"),
        CONSTRAINT "FK_post_bookmarks_post" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_post_bookmarks_device" FOREIGN KEY ("device_id") REFERENCES "device_sessions"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_post_bookmarks_user" FOREIGN KEY ("user_account_id") REFERENCES "user_accounts"("id") ON DELETE CASCADE
      );
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_post_bookmarks_device_created"
        ON "post_bookmarks" ("device_id", "created_at" DESC);
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_post_bookmarks_user_created"
        ON "post_bookmarks" ("user_account_id", "created_at" DESC);
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "content_reports" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "target_type" varchar(20) NOT NULL,
        "post_id" uuid NULL,
        "comment_id" uuid NULL,
        "reporter_device_id" uuid NOT NULL,
        "reporter_user_account_id" uuid NULL,
        "reason" varchar(40) NOT NULL,
        "details" varchar(500) NULL,
        "status" varchar(20) NOT NULL DEFAULT 'OPEN',
        "resolved_by_user_account_id" uuid NULL,
        "resolved_at" TIMESTAMPTZ NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_content_reports_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_content_reports_post" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_content_reports_comment" FOREIGN KEY ("comment_id") REFERENCES "comments"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_content_reports_reporter_device" FOREIGN KEY ("reporter_device_id") REFERENCES "device_sessions"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_content_reports_reporter_user" FOREIGN KEY ("reporter_user_account_id") REFERENCES "user_accounts"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_content_reports_resolved_user" FOREIGN KEY ("resolved_by_user_account_id") REFERENCES "user_accounts"("id") ON DELETE SET NULL
      );
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_content_reports_status_created"
        ON "content_reports" ("status", "created_at" DESC);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "content_reports";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "post_bookmarks";`);
  }
}
