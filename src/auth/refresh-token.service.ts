import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { refresh_tokens } from '@prisma/client';
import * as crypto from 'crypto';

@Injectable()
export class RefreshTokenService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly jwtService: JwtService,
    ) { }

    async createRefreshToken(
        userId: string,
        sessionId: string,
        refreshToken: string,
    ): Promise<refresh_tokens> {
        const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

        // 删除用户的旧 refresh token（可选：保留多个会话）
        await this.prisma.refresh_tokens.deleteMany({
            where: { user_id: userId },
        });

        return this.prisma.refresh_tokens.create({
            data: {
                id: crypto.randomUUID(),
                user_id: userId,
                token_hash: tokenHash,
                session_id: sessionId,
                expires_at: expiresAt,
                is_revoked: false,
            },
        });
    }

    async validateRefreshToken(refreshToken: string): Promise<{ userId: string; sessionId: string }> {
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
            sessionId: storedToken.session_id,
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
