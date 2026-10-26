import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateFaqKnowledge1761430300000 implements MigrationInterface {
  name = 'CreateFaqKnowledge1761430300000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "faq_knowledge" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "question" character varying(300) NOT NULL,
        "answer" text NOT NULL,
        "category" character varying(60) NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_faq_knowledge_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "IDX_faq_knowledge_category" ON "faq_knowledge" ("category")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_faq_knowledge_category"`);
    await queryRunner.query(`DROP TABLE "faq_knowledge"`);
  }
}
