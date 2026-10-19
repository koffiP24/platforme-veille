import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddActionProgressFields1792700000000 implements MigrationInterface {
  name = 'AddActionProgressFields1792700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "actions" ADD COLUMN "progress_comment" text`);
    await queryRunner.query(`ALTER TABLE "actions" ADD COLUMN "result" text`);
    await queryRunner.query(`ALTER TABLE "actions" ADD COLUMN "started_at" TIMESTAMP WITH TIME ZONE`);
    await queryRunner.query(`ALTER TABLE "actions" ADD COLUMN "completed_at" TIMESTAMP WITH TIME ZONE`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "actions" DROP COLUMN "completed_at"`);
    await queryRunner.query(`ALTER TABLE "actions" DROP COLUMN "started_at"`);
    await queryRunner.query(`ALTER TABLE "actions" DROP COLUMN "result"`);
    await queryRunner.query(`ALTER TABLE "actions" DROP COLUMN "progress_comment"`);
  }
}
