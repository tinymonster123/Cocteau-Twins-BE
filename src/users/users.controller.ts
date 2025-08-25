import {
    Controller,
    Get,
    Put,
    Delete,
    Body,
    Param,
    Query,
    UseGuards,
    Request,
    BadRequestException,
    NotFoundException
} from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtGuard } from '../auth/guards/jwt.guard';
import { users, Prisma } from '@prisma/client';


@Controller('users')
@UseGuards(JwtGuard)
export class UsersController {
    constructor(
        private readonly usersService: UsersService,
    ) { }

    @Get('profile')
    async getProfile(@Request() req: any): Promise<Omit<users, 'password_hash'>> {
        const user = await this.usersService.user({ id: req.user.id });
        if (!user) {
            throw new NotFoundException('用户不存在');
        }
        const { password_hash, ...userProfile } = user;
        return userProfile;
    }

    @Get()
    async getUsers(
        @Query('search') search?: string,
    ): Promise<{ users: Omit<users, 'password_hash'>[] }> {
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

        const usersWithoutPassword = users.map(({ password_hash, ...user }) => user);

        return {
            users: usersWithoutPassword,
        };
    }

    @Get(':id')
    async getUserById(@Param('id') id: string): Promise<Omit<users, 'password_hash'>> {
        const user = await this.usersService.user({ id });
        if (!user) {
            throw new NotFoundException('用户不存在');
        }
        const { password_hash, ...userProfile } = user;
        return userProfile;
    }

    @Put('profile')
    async updateProfile(
        @Request() req: any,
        @Body() updateData: { username?: string; email?: string },
    ): Promise<Omit<users, 'password_hash'>> {
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
        return userProfile;
    }

    @Put(':id/status')
    async updateUserStatus(
        @Param('id') id: string,
        @Body() statusData: { is_active: boolean },
    ): Promise<Omit<users, 'password_hash'>> {
        const user = await this.usersService.user({ id });
        if (!user) {
            throw new NotFoundException('用户不存在');
        }

        const updatedUser = await this.usersService.updateUser({
            where: { id },
            data: {
                is_active: statusData.is_active,
                updated_at: new Date(),
            },
        });

        const { password_hash, ...userProfile } = updatedUser;
        return userProfile;
    }

    @Delete(':id')
    async deleteUser(@Param('id') id: string): Promise<{ message: string }> {
        const user = await this.usersService.user({ id });
        if (!user) {
            throw new NotFoundException('用户不存在');
        }

        await this.usersService.deleteUser({ id });
        return { message: '用户删除成功' };
    }


}
