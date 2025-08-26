import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { users } from '@prisma/client';
import { UsersService } from 'src/users/users.service';
import { RegisterDto } from './dtos/register.dto';
import { AuthResponseDto, RefreshTokenResponseDto } from './dtos/auth-response.dto';
import { RefreshTokenDto } from './dtos/refreshToken.dto';
import { RefreshTokenService } from './refresh-token.service';
import { ApiResponse } from '../common/dto/api-response.dto';
import crypto from 'crypto';

@Injectable()
export class AuthService {
    constructor(
        private usersService: UsersService,
        private jwtService: JwtService,
        private refreshTokenService: RefreshTokenService,
    ) { }

    async validateUser(email: string, password: string): Promise<users> {
        const user = await this.usersService.user({ email });
        if (!user) {
            throw new BadRequestException('User not found');
        }
        const isMatch: boolean = bcrypt.compareSync(password, user.password_hash);
        if (!isMatch) {
            throw new BadRequestException('Password does not match');
        }
        return user;
    }

    private buildAuthResponse(user: users): AuthResponseDto {
        const payload = { id: user.id, email: user.email };
        const sessionId = crypto.randomUUID();
        const now = Date.now();
        const accessTtlMs = 15 * 60 * 1000;
        const refreshTtlMs = 7 * 24 * 60 * 60 * 1000;

        const accessToken = this.jwtService.sign(payload);
        const refreshToken = this.jwtService.sign({ ...payload, sid: sessionId, type: 'refresh' });

        const authData = {
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                isActive: user.is_active ?? true,
                createdAt: (user.created_at ?? new Date(now)).toISOString(),
                updatedAt: (user.updated_at ?? new Date(now)).toISOString(),
                lastLogin: user.last_login ? user.last_login.toISOString() : undefined,
            },
            tokens: {
                accessToken,
                refreshToken,
                accessTokenExpiresAt: new Date(now + accessTtlMs).toISOString(),
                refreshTokenExpiresAt: new Date(now + refreshTtlMs).toISOString(),
            },
            session: {
                sessionId,
                expiresAt: new Date(now + refreshTtlMs).toISOString(),
            },
        };

        return ApiResponse.success('OK', authData);
    }

    async login(user: users): Promise<AuthResponseDto> {
        // 更新最后登录时间
        await this.usersService.updateUser({
            where: { id: user.id },
            data: { last_login: new Date() },
        });

        const authResponse = await this.buildAuthResponse(user);

        // 存储 refresh token
        await this.refreshTokenService.createRefreshToken(
            user.id,
            authResponse.data!.session.sessionId,
            authResponse.data!.tokens.refreshToken,
        );

        return authResponse;
    }

    async register(body: RegisterDto): Promise<AuthResponseDto> {
        const { username, email, password } = body;
        
        // 检查邮箱是否已存在
        const existingUserByEmail = await this.usersService.user({ email });
        if (existingUserByEmail) {
            throw new BadRequestException('邮箱已存在');
        }
        
        // 检查用户名是否已存在
        const existingUserByUsername = await this.usersService.user({ username });
        if (existingUserByUsername) {
            throw new BadRequestException('用户名已存在');
        }
        const hashedPassword = await bcrypt.hash(password, 10);
        const now = new Date();
        const created = await this.usersService.createUser({
            id: crypto.randomUUID(),
            username,
            email,
            password_hash: hashedPassword,
            is_active: true,
            created_at: now,
            updated_at: now,
        });

        const authResponse = await this.buildAuthResponse(created);

        // 存储 refresh token
        await this.refreshTokenService.createRefreshToken(
            created.id,
            authResponse.data!.session.sessionId,
            authResponse.data!.tokens.refreshToken,
        );

        return authResponse;
    }

    async refreshTokens(refreshTokenDto: RefreshTokenDto): Promise<RefreshTokenResponseDto> {
        const { refreshToken } = refreshTokenDto;

        try {
            // 验证 JWT refresh token
            const decoded = this.jwtService.verify(refreshToken);

            if (decoded.type !== 'refresh') {
                throw new UnauthorizedException('无效的 token 类型');
            }

            // 验证数据库中的 refresh token
            const { userId, sessionId } = await this.refreshTokenService.validateRefreshToken(refreshToken);

            if (userId !== decoded.id) {
                throw new UnauthorizedException('Token 用户不匹配');
            }

            // 获取用户信息
            const user = await this.usersService.user({ id: userId });
            if (!user || !user.is_active) {
                throw new UnauthorizedException('用户不存在或已禁用');
            }

            // 生成新的 tokens
            const payload = { id: user.id, email: user.email };
            const newSessionId = crypto.randomUUID();
            const now = Date.now();
            const accessTtlMs = 15 * 60 * 1000; // 15m
            const refreshTtlMs = 7 * 24 * 60 * 60 * 1000; // 7d

            const newAccessToken = this.jwtService.sign(payload);
            const newRefreshToken = this.jwtService.sign({
                ...payload,
                sid: newSessionId,
                type: 'refresh'
            });

            // 撤销旧的 refresh token 并创建新的
            await this.refreshTokenService.revokeRefreshToken(refreshToken);
            await this.refreshTokenService.createRefreshToken(
                user.id,
                newSessionId,
                newRefreshToken,
            );

            const refreshData = {
                tokens: {
                    accessToken: newAccessToken,
                    refreshToken: newRefreshToken,
                    accessTokenExpiresAt: new Date(now + accessTtlMs).toISOString(),
                    refreshTokenExpiresAt: new Date(now + refreshTtlMs).toISOString(),
                },
                user: {
                    id: user.id,
                    username: user.username,
                    email: user.email,
                    lastActiveAt: new Date(now).toISOString(),
                },
            };

            return ApiResponse.success('Token 刷新成功', refreshData);
        } catch (error) {
            if (error instanceof UnauthorizedException) {
                throw error;
            }
            throw new UnauthorizedException('无效的 refresh token');
        }
    }

    async logout(refreshToken: string): Promise<{ message: string }> {
        try {
            await this.refreshTokenService.revokeRefreshToken(refreshToken);
            return { message: '登出成功' };
        } catch (error) {
            // 即使 token 无效也算登出成功
            return { message: '登出成功' };
        }
    }

    async logoutUser(userId: string): Promise<void> {
        // 撤销该用户的所有 refresh tokens
        await this.refreshTokenService.revokeAllUserTokens(userId);
    }


}