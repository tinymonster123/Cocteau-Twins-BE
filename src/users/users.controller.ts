import {
  Controller,
  Get,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  BadRequestException,
  NotFoundException,
  ParseUUIDPipe,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtGuard } from '../auth/guards/jwt.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles, Role } from '../auth/decorators/roles.decorator';
import { UpdateUserDto, UpdateUserStatusDto } from './dtos/update-user.dto';
import { ApiResponse } from '../common/dto/api-response.dto';
import { users, Prisma } from '@prisma/client';
import { User } from './decorators/user.decorator';
import type { AccessTokenPayload } from '../auth/type/auth.types';

@Controller('users')
@UseGuards(JwtGuard, RolesGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) { }

  @Get('me')
  async getCurrentUser(
    @User() user: AccessTokenPayload,
  ): Promise<ApiResponse<Omit<users, 'password_hash'>>> {
    const userProfile = await this.usersService.user({ id: user.id });
    if (!userProfile) {
      throw new NotFoundException('用户不存在');
    }
    const { password_hash, ...result } = userProfile;
    return ApiResponse.success('获取用户信息成功', result);
  }

  @Get()
  @Roles(Role.ADMIN)
  async getUsers(
    @Query('search') search?: string,
  ): Promise<ApiResponse<{ users: Omit<users, 'password_hash'>[] }>> {
    const where: Prisma.usersWhereInput = search
      ? {
        OR: [
          { username: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
        ],
      }
      : {};

    const users = await this.usersService.users({
      where,
      orderBy: { created_at: 'desc' },
    });

    const usersWithoutPassword = users.map(
      ({ password_hash, ...user }) => user,
    );

    return ApiResponse.success('获取用户列表成功', {
      users: usersWithoutPassword,
    });
  }

  @Get(':id')
  @Roles(Role.ADMIN)
  async getUserById(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiResponse<Omit<users, 'password_hash'>>> {
    const user = await this.usersService.user({ id });
    if (!user) {
      throw new NotFoundException('用户不存在');
    }
    const { password_hash, ...userProfile } = user;
    return ApiResponse.success('获取用户信息成功', userProfile);
  }

  @Put('me')
  async updateCurrentUser(
    @User() user: AccessTokenPayload,
    @Body() updateData: UpdateUserDto,
  ): Promise<ApiResponse<Omit<users, 'password_hash'>>> {
    const { username, email } = updateData;

    if (email) {
      const existingUser = await this.usersService.user({ email });
      if (existingUser && existingUser.id !== user.id) {
        throw new BadRequestException('邮箱已被使用');
      }
    }

    if (username) {
      const existingUser = await this.usersService.user({ username });
      if (existingUser && existingUser.id !== user.id) {
        throw new BadRequestException('用户名已被使用');
      }
    }

    const updatedUser = await this.usersService.updateUser({
      where: { id: user.id },
      data: {
        ...updateData,
        updated_at: new Date(),
      },
    });

    const { password_hash, ...userProfile } = updatedUser;
    return ApiResponse.success('更新用户信息成功', userProfile);
  }

  @Patch(':id')
  @Roles(Role.ADMIN)
  async updateUser(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateData: Partial<UpdateUserDto & UpdateUserStatusDto>,
  ): Promise<ApiResponse<Omit<users, 'password_hash'>>> {
    const user = await this.usersService.user({ id });
    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    // 检查邮箱和用户名唯一性
    if (updateData.email) {
      const existingUser = await this.usersService.user({
        email: updateData.email,
      });
      if (existingUser && existingUser.id !== id) {
        throw new BadRequestException('邮箱已被使用');
      }
    }

    if (updateData.username) {
      const existingUser = await this.usersService.user({
        username: updateData.username,
      });
      if (existingUser && existingUser.id !== id) {
        throw new BadRequestException('用户名已被使用');
      }
    }

    const updatedUser = await this.usersService.updateUser({
      where: { id },
      data: {
        ...updateData,
        updated_at: new Date(),
      },
    });

    const { password_hash, ...userProfile } = updatedUser;
    return ApiResponse.success('更新用户信息成功', userProfile);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  async deleteUser(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiResponse<{ message: string }>> {
    const user = await this.usersService.user({ id });
    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    await this.usersService.deleteUser({ id });
    return ApiResponse.success('用户删除成功', { message: '用户删除成功' });
  }
}
