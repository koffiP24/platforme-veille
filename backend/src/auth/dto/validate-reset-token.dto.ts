import { IsString, Matches } from 'class-validator';

export class ValidateResetTokenDto {
  @IsString()
  @Matches(/^[a-f0-9]{64}$/i, { message: 'Lien de réinitialisation invalide.' })
  token: string;
}
