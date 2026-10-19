import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAiKeywordWeights1792600000000 implements MigrationInterface {
  name = 'AddAiKeywordWeights1792600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`UPDATE "watch_item_ai_analyses" SET "classification" = jsonb_set("classification", '{keywordWeights}', '[]'::jsonb, true) WHERE NOT ("classification" ? 'keywordWeights')`);
  }

  public async down(): Promise<void> {}
}
