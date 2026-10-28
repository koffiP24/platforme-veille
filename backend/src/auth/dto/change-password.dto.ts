import { IsNotEmpty, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @IsString()
  @IsNotEmpty({ message: 'Le mot de passe actuel est obligatoire.' })
  currentPassword: string;

  @IsString()
  @MinLength(12, { message: 'Le mot de passe doit comporter au moins 12 caractères.' })
  @MaxLength(72, { message: 'Le mot de passe ne peut pas dépasser 72 caractères.' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/, {
    message:
      'Le mot de passe doit contenir une minuscule, une majuscule, un chiffre et un caractère spécial.',
  })
  newPassword: string;
}

