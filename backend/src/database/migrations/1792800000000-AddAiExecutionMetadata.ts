import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAiExecutionMetadata1792800000000 implements MigrationInterface {
  name = 'AddAiExecutionMetadata1792800000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "watch_item_ai_analyses" ADD "attempts" smallint NOT NULL DEFAULT 1`);
    await queryRunner.query(`ALTER TABLE "watch_item_ai_analyses" ADD "duration_ms" integer`);
    await queryRunner.query(`ALTER TABLE "watch_item_ai_analyses" ADD "fallback_reason" text`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "watch_item_ai_analyses" DROP COLUMN "fallback_reason"`);
    await queryRunner.query(`ALTER TABLE "watch_item_ai_analyses" DROP COLUMN "duration_ms"`);
    await queryRunner.query(`ALTER TABLE "watch_item_ai_analyses" DROP COLUMN "attempts"`);
  }
}
