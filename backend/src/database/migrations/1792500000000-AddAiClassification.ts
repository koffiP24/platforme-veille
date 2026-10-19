import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAiClassification1792500000000 implements MigrationInterface {
  name = 'AddAiClassification1792500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "watch_item_ai_analyses" ADD COLUMN "classification" jsonb NOT NULL DEFAULT '{}'::jsonb`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "watch_item_ai_analyses" DROP COLUMN "classification"`);
  }
}
