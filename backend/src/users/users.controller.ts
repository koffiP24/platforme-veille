import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Req, UseGuards } from '@nestjs/common';

import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';
import { UpdateUserRolesDto } from './dto/update-user-roles.dto';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('api/v1/users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('assignable')
  @Roles('ADMIN', 'RESPONSABLE_VEILLE', 'REFERENT_LABORATOIRE')
  findAssignable() {
    return this.usersService.findAssignable();
  }

  @Get()
  @Roles('ADMIN')
  async findAll() {
    const users = await this.usersService.findAll();
    return users.map((u) => ({
      id: u.id,
      firstName: u.firstName,
      lastName: u.lastName,
      email: u.email,
      status: u.status,
      mustChangePassword: Boolean(u.mustChangePassword),
      lastLoginAt: u.lastLoginAt,
      roles: (u.roles ?? []).map((r) => ({ id: r.id, name: r.name, description: r.description })),
    }));
  }

  @Post()
  @Roles('ADMIN')
  async create(
    @Body() dto: CreateUserDto,
    @Req() request: { user: { id: number } },
  ) {
    const { user, temporaryPassword } = await this.usersService.create(dto, request.user.id);
    return {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      status: user.status,
      mustChangePassword: user.mustChangePassword,
      roles: (user.roles ?? []).map((r) => r.name),
      temporaryPassword,
    };
  }

  @Post(':id/temporary-password')
  @Roles('ADMIN')
  async generateTemporaryPassword(
    @Param('id', ParseIntPipe) id: number,
    @Req() request: { user: { id: number } },
  ) {
    return this.usersService.resetToTemporaryPassword(id, request.user.id);
  }

  @Patch(':id/status')
  @Roles('ADMIN')
  setStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateUserStatusDto,
    @Req() request: { user: { id: number } },
  ) {
    return this.usersService.setStatus(id, dto.status, request.user.id);
  }

  @Patch(':id/roles')
  @Roles('ADMIN')
  setRoles(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateUserRolesDto,
    @Req() request: { user: { id: number } },
  ) {
    return this.usersService.setRoles(id, dto.roles, request.user.id);
  }
}
