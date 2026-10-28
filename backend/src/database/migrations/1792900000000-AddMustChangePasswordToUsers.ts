import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMustChangePasswordToUsers1792900000000 implements MigrationInterface {
  name = 'AddMustChangePasswordToUsers1792900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN "must_change_password" boolean NOT NULL DEFAULT false`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "must_change_password"`);
  }
}

