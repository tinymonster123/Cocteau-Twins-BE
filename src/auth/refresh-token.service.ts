import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { refresh_tokens } from '@prisma/client';
import * as crypto from 'crypto';

@Injectable()
export class RefreshTokenService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly jwtService: JwtService,
        private readonly configService: ConfigService,
    ) { }

    async createRefreshToken(
        userId: string,
        refreshToken: string,
    ): Promise<refresh_tokens> {
        const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');

        let expiresAt: Date;
        const decoded: unknown = this.jwtService.decode(refreshToken);
        const configuredTtl = this.configService.get('JWT_REFRESH_TOKEN_TTL_MS');
        const fallbackTtlMs = Number.isFinite(Number(configuredTtl)) && Number(configuredTtl) > 0
            ? Number(configuredTtl)
            : 604_800_000;
        if (decoded && typeof decoded === 'object' && 'exp' in decoded && typeof (decoded as any).exp === 'number') {
            const exp = (decoded as { exp: number }).exp;
            const ts = exp * 1000;
            const d = new Date(ts);
            expiresAt = isNaN(d.getTime()) ? new Date(Date.now() + fallbackTtlMs) : d;
        } else {
            expiresAt = new Date(Date.now() + fallbackTtlMs);
        }

        const [, created] = await this.prisma.$transaction([
            this.prisma.refresh_tokens.deleteMany({
                where: { user_id: userId },
            }),
            this.prisma.refresh_tokens.create({
                data: {
                    id: crypto.randomUUID(),
                    user_id: userId,
                    token_hash: tokenHash,
                    expires_at: expiresAt,
                    is_revoked: false,
                },
            }),
        ]);

        return created
    }

    async validateRefreshToken(refreshToken: string): Promise<{ userId: string }> {
        const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');

        const storedToken = await this.prisma.refresh_tokens.findUnique({
            where: { token_hash: tokenHash },
        });

        if (!storedToken) {
            throw new UnauthorizedException('无效的 refresh token');
        }

        if (storedToken.is_revoked) {
            throw new UnauthorizedException('Refresh token 已被撤销');
        }

        if (storedToken.expires_at < new Date()) {
            // 删除过期的 token
            await this.prisma.refresh_tokens.delete({
                where: { id: storedToken.id },
            });
            throw new UnauthorizedException('Refresh token 已过期');
        }

        return {
            userId: storedToken.user_id,
        };
    }

    async revokeRefreshToken(refreshToken: string): Promise<void> {
        const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');

        await this.prisma.refresh_tokens.updateMany({
            where: { token_hash: tokenHash },
            data: { is_revoked: true },
        });
    }

    async revokeAllUserTokens(userId: string): Promise<void> {
        await this.prisma.refresh_tokens.updateMany({
            where: { user_id: userId },
            data: { is_revoked: true },
        });
    }


}
