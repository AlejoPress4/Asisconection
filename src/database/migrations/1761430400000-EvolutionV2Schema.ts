import type { MigrationInterface, QueryRunner } from 'typeorm';

export class EvolutionV2Schema1761430400000 implements MigrationInterface {
  name = 'EvolutionV2Schema1761430400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "user_accounts"
      DROP CONSTRAINT IF EXISTS "UQ_user_accounts_external_user_id"
    `);

    await queryRunner.query(`
      ALTER TABLE "user_accounts"
      ALTER COLUMN "external_user_id" TYPE INTEGER
      USING CASE WHEN "external_user_id" ~ '^\\d+$' THEN "external_user_id"::INTEGER ELSE NULL END
    `);

    await queryRunner.query(`
      ALTER TABLE "user_accounts"
      ADD CONSTRAINT "UQ_user_accounts_external_user_id" UNIQUE ("external_user_id")
    `);

    await queryRunner.query(`
      ALTER TABLE "user_accounts"
      ADD COLUMN IF NOT EXISTS "external_roles" text[] NOT NULL DEFAULT '{}',
      ADD COLUMN IF NOT EXISTS "local_role" character varying(40)
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "actors" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_account_id" uuid NOT NULL,
        "primary_role" character varying(40) NOT NULL,
        "first_names" character varying(80),
        "last_names" character varying(80),
        "avatar_url" character varying(500),
        "short_bio" character varying(500),
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_actors_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_actors_user_account_id" UNIQUE ("user_account_id"),
        CONSTRAINT "FK_actors_user_account_id" FOREIGN KEY ("user_account_id")
          REFERENCES "user_accounts"("id") ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "actor_connections" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "requester_actor_id" uuid NOT NULL,
        "receiver_actor_id" uuid NOT NULL,
        "status" character varying(20) NOT NULL DEFAULT 'PENDING',
        "requested_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "accepted_at" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "PK_actor_connections_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_actor_connections_pair" UNIQUE ("requester_actor_id", "receiver_actor_id"),
        CONSTRAINT "FK_actor_connections_requester" FOREIGN KEY ("requester_actor_id")
          REFERENCES "actors"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT "FK_actor_connections_receiver" FOREIGN KEY ("receiver_actor_id")
          REFERENCES "actors"("id") ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_actor_connections_requester" ON "actor_connections" ("requester_actor_id")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_actor_connections_receiver" ON "actor_connections" ("receiver_actor_id")
    `);

    await queryRunner.query(`
      ALTER TABLE "categories"
      ADD COLUMN IF NOT EXISTS "main_topic" character varying(120) NOT NULL DEFAULT 'General',
      ADD COLUMN IF NOT EXISTS "cover_image_url" character varying(500)
    `);

    await queryRunner.query(`
      ALTER TABLE "posts"
      ADD COLUMN IF NOT EXISTS "rejection_reason" character varying(40)
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "post_media" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "post_id" uuid NOT NULL,
        "media_url" character varying(500) NOT NULL,
        "display_order" integer NOT NULL DEFAULT 0,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_post_media_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_post_media_post_id" FOREIGN KEY ("post_id")
          REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_post_media_post_id" ON "post_media" ("post_id")
    `);

    await queryRunner.query(`
      ALTER TABLE "comments"
      ADD COLUMN IF NOT EXISTS "parent_id" uuid,
      ADD COLUMN IF NOT EXISTS "rejection_reason" character varying(40)
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'FK_comments_parent_id'
        ) THEN
          ALTER TABLE "comments"
          ADD CONSTRAINT "FK_comments_parent_id" FOREIGN KEY ("parent_id")
          REFERENCES "comments"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "comment_reactions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "comment_id" uuid NOT NULL,
        "device_id" uuid NOT NULL,
        "user_account_id" uuid,
        "type" character varying(20) NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_comment_reactions_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_comment_reactions_comment_device_type" UNIQUE ("comment_id", "device_id", "type"),
        CONSTRAINT "FK_comment_reactions_comment_id" FOREIGN KEY ("comment_id")
          REFERENCES "comments"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT "FK_comment_reactions_device_id" FOREIGN KEY ("device_id")
          REFERENCES "device_sessions"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT "FK_comment_reactions_user_account_id" FOREIGN KEY ("user_account_id")
          REFERENCES "user_accounts"("id") ON DELETE SET NULL ON UPDATE NO ACTION
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "comment_reactions"`);
    await queryRunner.query(`ALTER TABLE "comments" DROP CONSTRAINT IF EXISTS "FK_comments_parent_id"`);
    await queryRunner.query(`
      ALTER TABLE "comments"
      DROP COLUMN IF EXISTS "rejection_reason",
      DROP COLUMN IF EXISTS "parent_id"
    `);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_post_media_post_id"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "post_media"`);
    await queryRunner.query(`ALTER TABLE "posts" DROP COLUMN IF EXISTS "rejection_reason"`);
    await queryRunner.query(`
      ALTER TABLE "categories"
      DROP COLUMN IF EXISTS "cover_image_url",
      DROP COLUMN IF EXISTS "main_topic"
    `);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_actor_connections_receiver"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_actor_connections_requester"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "actor_connections"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "actors"`);
    await queryRunner.query(`
      ALTER TABLE "user_accounts"
      DROP COLUMN IF EXISTS "local_role",
      DROP COLUMN IF EXISTS "external_roles"
    `);
    await queryRunner.query(`
      ALTER TABLE "user_accounts"
      DROP CONSTRAINT IF EXISTS "UQ_user_accounts_external_user_id"
    `);
    await queryRunner.query(`
      ALTER TABLE "user_accounts"
      ALTER COLUMN "external_user_id" TYPE character varying(120)
      USING "external_user_id"::character varying
    `);
    await queryRunner.query(`
      ALTER TABLE "user_accounts"
      ADD CONSTRAINT "UQ_user_accounts_external_user_id" UNIQUE ("external_user_id")
    `);
  }
}
