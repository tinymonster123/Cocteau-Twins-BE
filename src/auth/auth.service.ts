import { BadRequestException, Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { users } from '@prisma/client';
import { UsersService } from '../users/users.service';
import { RegisterDto } from './dtos/register.dto';
import { AuthResponseDto, RefreshTokenResponseDto } from './dtos/auth-response.dto';
import { RegisterResponseDto } from './dtos/register-response.dto';
import { RefreshTokenDto } from './dtos/refreshToken.dto';
import { RefreshTokenService } from './refresh-token.service';
import { ApiResponse } from '../common/dto/api-response.dto';
import crypto from 'crypto';

@Injectable()
export class AuthService {
    private readonly logger = new Logger(AuthService.name);

    constructor(
        private usersService: UsersService,
        private jwtService: JwtService,
        private refreshTokenService: RefreshTokenService,
        private configService: ConfigService,
    ) { }

    private safeToISOString(date: Date | null | undefined): string | undefined {
        if (date && date instanceof Date && !isNaN(date.getTime())) {
            return date.toISOString();
        }
        return undefined;
    }

    private safeDateFromTimestamp(timestamp: number): Date {
        const maxTimestamp = this.configService.get<number>('MAX_TIMESTAMP', 8640000000000000);
        const minTimestamp = this.configService.get<number>('MIN_TIMESTAMP', -8640000000000000);
        const now = Date.now();

        if (timestamp > maxTimestamp || timestamp < minTimestamp || timestamp <= now) {
            const reasonText = timestamp <= now ? '早于或等于当前时间' : '超出允许范围';
            const fallbackTtl = this.configService.get<number>('DEFAULT_FALLBACK_TTL_MS', 3600000);
            this.logger.warn(
                `时间戳 ${timestamp} ${reasonText}，将回退为从当前时间起 ${fallbackTtl}ms 的默认过期时间。`
            );
            return new Date(now + fallbackTtl);
        }

        return new Date(timestamp);
    }

    private getTokenExpiresAtIso(token: string): string | undefined {
        const decoded: unknown = this.jwtService.decode(token);
        if (decoded && typeof decoded === 'object' && 'exp' in decoded) {
            const exp = (decoded as { exp?: number }).exp;
            if (typeof exp === 'number' && Number.isFinite(exp)) {
                const expiresAt = new Date(exp * 1000);
                if (!isNaN(expiresAt.getTime())) {
                    return expiresAt.toISOString();
                }
            }
        }
        return undefined;
    }

    async validateUser(email: string, password: string): Promise<users> {
        this.logger.log(`用户登录验证请求: ${email}`);

        const user = await this.usersService.user({ email });
        if (!user) {
            this.logger.warn(`登录失败: 用户 ${email} 不存在`);
            throw new BadRequestException('邮箱或密码错误');
        }

        if (!user.is_active) {
            this.logger.warn(`登录失败: 用户 ${email} 已被禁用`);
            throw new BadRequestException('用户已被禁用');
        }

        const isMatch: boolean = bcrypt.compareSync(password, user.password_hash);
        if (!isMatch) {
            this.logger.warn(`登录失败: 用户 ${email} 密码错误`);
            throw new BadRequestException('邮箱或密码错误');
        }

        this.logger.log(`用户登录验证成功: ${email} (ID: ${user.id})`);
        return user;
    }

    private buildAuthResponse(user: users): AuthResponseDto {
        const payload = { id: user.id, email: user.email, role: user.role };
        const sessionId = crypto.randomUUID();
        const now = Date.now();

        const accessTtlMs = this.configService.get<number>('JWT_ACCESS_TOKEN_TTL_MS', 86400000);
        const refreshTtlMs = this.configService.get<number>('JWT_REFRESH_TOKEN_TTL_MS', 604800000);

        const accessToken = this.jwtService.sign(
            payload,
            { expiresIn: this.configService.get<string>('JWT_ACCESS_TOKEN_EXPIRATION', '1d') }
        );
        const refreshToken = this.jwtService.sign(
            { ...payload, sid: sessionId, type: 'refresh' },
            { expiresIn: this.configService.get<string>('JWT_REFRESH_TOKEN_EXPIRATION', '7d') }
        );

        // 优先使用 JWT exp，失败则回退到安全的 TTL 计算
        const accessTokenExpiresAtIso = this.getTokenExpiresAtIso(accessToken)
            ?? this.safeDateFromTimestamp(now + accessTtlMs).toISOString();
        const refreshTokenExpiresAtIso = this.getTokenExpiresAtIso(refreshToken)
            ?? this.safeDateFromTimestamp(now + refreshTtlMs).toISOString();

        const authData = {
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                role: user.role,
                isActive: user.is_active ?? true,
                createdAt: this.safeToISOString(user.created_at) ?? new Date(now).toISOString(),
                updatedAt: this.safeToISOString(user.updated_at) ?? new Date(now).toISOString(),
                lastLogin: this.safeToISOString(user.last_login),
            },
            tokens: {
                accessToken,
                refreshToken,
                accessTokenExpiresAt: accessTokenExpiresAtIso,
                refreshTokenExpiresAt: refreshTokenExpiresAtIso,
            },
            session: {
                sessionId,
                expiresAt: refreshTokenExpiresAtIso,
            },
        };

        return ApiResponse.success('OK', authData);
    }

    async login(user: users): Promise<AuthResponseDto> {
        this.logger.log(`用户登录: ${user.email} (ID: ${user.id})`);

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

        this.logger.log(`用户登录成功，生成令牌: ${user.email} (会话ID: ${authResponse.data!.session.sessionId})`);
        return authResponse;
    }

    async register(body: RegisterDto): Promise<RegisterResponseDto> {
        const { username, email, password } = body;

        this.logger.log(`用户注册请求: ${email}`);

        // 检查邮箱是否已存在
        const existingUserByEmail = await this.usersService.user({ email });
        if (existingUserByEmail) {
            this.logger.warn(`注册失败: 邮箱 ${email} 已存在`);
            throw new BadRequestException('邮箱已存在');
        }

        // 检查用户名是否已存在
        const existingUserByUsername = await this.usersService.user({ username });
        if (existingUserByUsername) {
            this.logger.warn(`注册失败: 用户名 ${username} 已存在`);
            throw new BadRequestException('用户名已存在');
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const now = new Date();
        const created = await this.usersService.createUser({
            id: crypto.randomUUID(),
            username,
            email,
            password_hash: hashedPassword,
            role: 'user', // 默认角色为普通用户
            is_active: true,
            created_at: now,
            updated_at: now,
        });

        this.logger.log(`用户注册成功: ${created.email} (ID: ${created.id})`);

        const registerData = {
            id: created.id,
            username: created.username,
            email: created.email,
            role: created.role,
            isActive: created.is_active ?? true,
            createdAt: this.safeToISOString(created.created_at) ?? new Date(now).toISOString(),
        };

        return ApiResponse.success('注册成功，请登录', registerData);
    }

    async refreshTokens(refreshTokenDto: RefreshTokenDto): Promise<RefreshTokenResponseDto> {
        const { refreshToken } = refreshTokenDto;

        this.logger.log('令牌刷新请求');

        try {
            // 验证 JWT refresh token
            const decoded = this.jwtService.verify(refreshToken);

            if (decoded.type !== 'refresh') {
                this.logger.warn('令牌刷新失败: 无效的 token 类型');
                throw new UnauthorizedException('无效的 token 类型');
            }

            // 验证数据库中的 refresh token
            const { userId } = await this.refreshTokenService.validateRefreshToken(refreshToken);

            if (userId !== decoded.id) {
                this.logger.warn(`令牌刷新失败: Token 用户不匹配 (JWT用户: ${decoded.id}, DB用户: ${userId})`);
                throw new UnauthorizedException('Token 用户不匹配');
            }

            // 获取用户信息
            const user = await this.usersService.user({ id: userId });
            if (!user || !user.is_active) {
                this.logger.warn(`令牌刷新失败: 用户不存在或已禁用 (用户ID: ${userId})`);
                throw new UnauthorizedException('用户不存在或已禁用');
            }

            // 生成新的 tokens
            const payload = { id: user.id, email: user.email, role: user.role };
            const newSessionId = crypto.randomUUID();
            const now = Date.now();

            const accessTtlMs = this.configService.get<number>('JWT_ACCESS_TOKEN_TTL_MS', 86400000);
            const refreshTtlMs = this.configService.get<number>('JWT_REFRESH_TOKEN_TTL_MS', 604800000);
            const newAccessToken = this.jwtService.sign(
                payload,
                { expiresIn: this.configService.get<string>('JWT_ACCESS_TOKEN_EXPIRATION', '1d') }
            );
            const newRefreshToken = this.jwtService.sign(
                { ...payload, sid: newSessionId, type: 'refresh' },
                { expiresIn: this.configService.get<string>('JWT_REFRESH_TOKEN_EXPIRATION', '7d') }
            );

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
                    accessTokenExpiresAt: this.getTokenExpiresAtIso(newAccessToken)
                        ?? this.safeDateFromTimestamp(now + accessTtlMs).toISOString(),
                    refreshTokenExpiresAt: this.getTokenExpiresAtIso(newRefreshToken)
                        ?? this.safeDateFromTimestamp(now + refreshTtlMs).toISOString(),
                },
                user: {
                    id: user.id,
                    username: user.username,
                    email: user.email,
                    lastActiveAt: new Date(now).toISOString(),
                },
            };

            this.logger.log(`令牌刷新成功: ${user.email} (新会话ID: ${newSessionId})`);
            return ApiResponse.success('Token 刷新成功', refreshData);
        } catch (error) {
            if (error instanceof UnauthorizedException) {
                throw error;
            }
            this.logger.error('令牌刷新失败: 未知错误', error);
            throw new UnauthorizedException('无效的 refresh token');
        }
    }

    async logoutUser(userId: string): Promise<void> {
        this.logger.log(`用户登出: ${userId}`);
        try {
            // 撤销该用户的所有 refresh tokens
            await this.refreshTokenService.revokeAllUserTokens(userId);
            this.logger.log(`用户登出成功: ${userId}`);
        } catch (error) {
            this.logger.error(`用户登出失败: ${userId}`, error);
            throw error;
        }
    }
}
