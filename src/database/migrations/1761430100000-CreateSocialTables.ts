import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateSocialTables1761430100000 implements MigrationInterface {
  name = 'CreateSocialTables1761430100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."moderation_status_enum" AS ENUM('PENDING', 'APPROVED', 'REJECTED')`,
    );

    await queryRunner.query(`
      CREATE TABLE "categories" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" character varying(80) NOT NULL,
        "description" text NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_categories_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_categories_name" UNIQUE ("name")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "posts" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "device_id" uuid NOT NULL,
        "user_account_id" uuid,
        "category_id" uuid NOT NULL,
        "content" text NOT NULL,
        "image_url" character varying(500),
        "status" "public"."moderation_status_enum" NOT NULL DEFAULT 'PENDING',
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_posts_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_posts_device_id" FOREIGN KEY ("device_id")
          REFERENCES "device_sessions"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
        CONSTRAINT "FK_posts_user_account_id" FOREIGN KEY ("user_account_id")
          REFERENCES "user_accounts"("id") ON DELETE SET NULL ON UPDATE NO ACTION,
        CONSTRAINT "FK_posts_category_id" FOREIGN KEY ("category_id")
          REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE NO ACTION
      )
    `);

    await queryRunner.query(`CREATE INDEX "IDX_posts_status" ON "posts" ("status")`);
    await queryRunner.query(`CREATE INDEX "IDX_posts_created_at" ON "posts" ("created_at")`);
    await queryRunner.query(
      `CREATE INDEX "IDX_posts_status_category_created" ON "posts" ("status", "category_id", "created_at" DESC)`,
    );

    await queryRunner.query(`
      CREATE TABLE "comments" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "post_id" uuid NOT NULL,
        "device_id" uuid NOT NULL,
        "user_account_id" uuid,
        "content" text NOT NULL,
        "status" "public"."moderation_status_enum" NOT NULL DEFAULT 'PENDING',
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_comments_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_comments_post_id" FOREIGN KEY ("post_id")
          REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT "FK_comments_device_id" FOREIGN KEY ("device_id")
          REFERENCES "device_sessions"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
        CONSTRAINT "FK_comments_user_account_id" FOREIGN KEY ("user_account_id")
          REFERENCES "user_accounts"("id") ON DELETE SET NULL ON UPDATE NO ACTION
      )
    `);

    await queryRunner.query(`CREATE INDEX "IDX_comments_status" ON "comments" ("status")`);
    await queryRunner.query(
      `CREATE INDEX "IDX_comments_post_status_created" ON "comments" ("post_id", "status", "created_at" ASC)`,
    );

    await queryRunner.query(`
      CREATE TABLE "reactions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "post_id" uuid NOT NULL,
        "device_id" uuid NOT NULL,
        "user_account_id" uuid,
        "type" character varying(20) NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_reactions_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_reactions_post_device_type" UNIQUE ("post_id", "device_id", "type"),
        CONSTRAINT "FK_reactions_post_id" FOREIGN KEY ("post_id")
          REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT "FK_reactions_device_id" FOREIGN KEY ("device_id")
          REFERENCES "device_sessions"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT "FK_reactions_user_account_id" FOREIGN KEY ("user_account_id")
          REFERENCES "user_accounts"("id") ON DELETE SET NULL ON UPDATE NO ACTION
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "reactions"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_comments_post_status_created"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_comments_status"`);
    await queryRunner.query(`DROP TABLE "comments"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_posts_status_category_created"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_posts_created_at"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_posts_status"`);
    await queryRunner.query(`DROP TABLE "posts"`);
    await queryRunner.query(`DROP TABLE "categories"`);
    await queryRunner.query(`DROP TYPE "public"."moderation_status_enum"`);
  }
}
