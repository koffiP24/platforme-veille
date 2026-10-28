import {
  Body,
  Controller,
  Get,
  Post,
  Request,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request as ExpressRequest, Response } from 'express';

import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ValidateResetTokenDto } from './dto/validate-reset-token.dto';
import { PasswordResetService } from './password-reset.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@Controller('api/v1/auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly passwordResetService: PasswordResetService,
  ) {}

  private setCookies(response: Response, accessToken: string, refreshToken: string) {
    const common = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
    };
    response.cookie('access_token', accessToken, {
      ...common,
      maxAge: this.authService.accessTtlSeconds * 1000,
      path: '/',
    });
    response.cookie('refresh_token', refreshToken, {
      ...common,
      maxAge: this.authService.refreshTtlSeconds * 1000,
      path: '/api/v1/auth',
    });
  }

  private clearCookies(response: Response) {
    const common = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
    };
    response.clearCookie('access_token', { ...common, path: '/' });
    response.clearCookie('refresh_token', { ...common, path: '/api/v1/auth' });
  }

  @Post('login')
  async login(
    @Body()
    dto: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.login(dto);
    this.setCookies(response, result.accessToken, result.refreshToken);
    return { user: result.user };
  }

  @Post('forgot-password')
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.passwordResetService.forgotPassword(dto.email);
  }

  @Post('reset-password')
  resetPassword(@Body() dto: ResetPasswordDto, @Req() request: ExpressRequest) {
    return this.passwordResetService.resetPassword(dto.token, dto.newPassword, request.ip);
  }

  @Post('validate-reset-token')
  validateResetToken(@Body() dto: ValidateResetTokenDto) {
    return this.passwordResetService.validateResetToken(dto.token);
  }

  @UseGuards(JwtAuthGuard)
  @Post('change-password')
  async changePassword(
    @Body() dto: ChangePasswordDto,
    @Req() request: ExpressRequest & { user: { id: number } },
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.changePassword(
      request.user.id,
      dto,
      request.ip,
    );
    this.setCookies(response, result.tokens.accessToken, result.tokens.refreshToken);
    return {
      message: 'Mot de passe modifié avec succès.',
      user: result.user,
    };
  }

  @Post('refresh')
  async refresh(
    @Req() request: ExpressRequest,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.refresh(request.cookies?.refresh_token);
    this.setCookies(response, result.accessToken, result.refreshToken);
    return { message: 'Session renouvelée.' };
  }

  @Post('logout')
  async logout(
    @Req() request: ExpressRequest,
    @Res({ passthrough: true }) response: Response,
  ) {
    try {
      await this.authService.logout(request.cookies?.refresh_token);
    } finally {
      this.clearCookies(response);
    }
    return { message: 'Déconnexion réussie.' };
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@Request() request: any) {
    return request.user;
  }
}
