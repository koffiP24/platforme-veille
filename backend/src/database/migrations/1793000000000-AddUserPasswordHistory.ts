import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserPasswordHistory1793000000000 implements MigrationInterface {
  name = 'AddUserPasswordHistory1793000000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE "user_password_history" (
      "id" SERIAL NOT NULL,
      "user_id" integer NOT NULL,
      "password_hash" text NOT NULL,
      "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      CONSTRAINT "PK_user_password_history" PRIMARY KEY ("id"),
      CONSTRAINT "FK_user_password_history_user" FOREIGN KEY ("user_id")
        REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION
    )`);
    await queryRunner.query(`CREATE INDEX "IDX_user_password_history_user_created"
      ON "user_password_history" ("user_id", "created_at")`);
    await queryRunner.query(`INSERT INTO "user_password_history" ("user_id", "password_hash")
      SELECT "id", "password_hash" FROM "users"`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE "user_password_history"');
  }
}
