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
  Request,
  BadRequestException,
  NotFoundException,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtGuard } from '../auth/guards/jwt.guard';
import { UpdateUserDto, UpdateUserStatusDto } from './dtos/update-user.dto';
import { ApiResponse } from '../common/dto/api-response.dto';
import { users, Prisma } from '@prisma/client';

@Controller('users')
@UseGuards(JwtGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) { }

  @Get('me')
  async getCurrentUser(
    @Request() req: any,
  ): Promise<ApiResponse<Omit<users, 'password_hash'>>> {
    const user = await this.usersService.user({ id: req.user.id });
    if (!user) {
      throw new NotFoundException('用户不存在');
    }
    const { password_hash, ...userProfile } = user;
    return ApiResponse.success('获取用户信息成功', userProfile);
  }

  @Get()
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
    @Request() req: any,
    @Body() updateData: UpdateUserDto,
  ): Promise<ApiResponse<Omit<users, 'password_hash'>>> {
    const { username, email } = updateData;

    if (email) {
      const existingUser = await this.usersService.user({ email });
      if (existingUser && existingUser.id !== req.user.id) {
        throw new BadRequestException('邮箱已被使用');
      }
    }

    if (username) {
      const existingUser = await this.usersService.user({ username });
      if (existingUser && existingUser.id !== req.user.id) {
        throw new BadRequestException('用户名已被使用');
      }
    }

    const updatedUser = await this.usersService.updateUser({
      where: { id: req.user.id },
      data: {
        ...updateData,
        updated_at: new Date(),
      },
    });

    const { password_hash, ...userProfile } = updatedUser;
    return ApiResponse.success('更新用户信息成功', userProfile);
  }

  @Patch(':id')
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
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteUser(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    const user = await this.usersService.user({ id });
    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    await this.usersService.deleteUser({ id });
  }
}
