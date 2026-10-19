import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddWatchItemAiAnalyses1792400000000 implements MigrationInterface {
  name = 'AddWatchItemAiAnalyses1792400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE "watch_item_ai_analyses" (
      "id" SERIAL NOT NULL,
      "watch_item_id" integer NOT NULL,
      "supersedes_id" integer,
      "requested_by_id" integer,
      "reviewed_by_id" integer,
      "provider" character varying(30) NOT NULL DEFAULT 'openai',
      "model" character varying(100) NOT NULL,
      "source_fingerprint" character varying(64) NOT NULL,
      "relevance_score" smallint NOT NULL,
      "relevance_reason" text NOT NULL,
      "summary" text,
      "potential_impacts" jsonb NOT NULL DEFAULT '[]'::jsonb,
      "recommended_checks" jsonb NOT NULL DEFAULT '[]'::jsonb,
      "status" character varying(20) NOT NULL DEFAULT 'PROPOSED',
      "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      CONSTRAINT "PK_watch_item_ai_analyses" PRIMARY KEY ("id"),
      CONSTRAINT "FK_watch_item_ai_analyses_watch_item" FOREIGN KEY ("watch_item_id") REFERENCES "watch_items"("id") ON DELETE CASCADE
    )`);
    await queryRunner.query(
      `CREATE INDEX "IDX_watch_item_ai_analyses_item_created" ON "watch_item_ai_analyses" ("watch_item_id", "created_at" DESC)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "IDX_watch_item_ai_analyses_item_created"`,
    );
    await queryRunner.query(`DROP TABLE "watch_item_ai_analyses"`);
  }
}
