import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, ExtractJwt } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { AccessTokenPayload } from '../type/auth.types';
import { RedisService } from '../../redis/redis.service';
import { UsersService } from '../../users/users.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
    constructor(
        private readonly configService: ConfigService,
        private readonly redisService: RedisService,
        private readonly usersService: UsersService,
    ) {
        const secret = configService.get<string>('JWT_SECRET');
        if (!secret) {
            throw new Error('未配置 JWT_SECRET');
        }
        super({
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
            ignoreExpiration: false,
            secretOrKey: secret,
        });
    }

    async validate(payload: AccessTokenPayload): Promise<AccessTokenPayload> {
        if ((payload as any)?.type === 'refresh') {
            throw new UnauthorizedException('不允许使用刷新令牌访问受保护资源');
        }

        if (!payload.jti) {
            throw new UnauthorizedException('令牌缺少 JWT ID (jti)');
        }
        const isBlacklisted = await this.redisService.isBlacklisted(payload.jti);
        if (isBlacklisted) {
            throw new UnauthorizedException('令牌已被撤销');
        }

        const user = await this.usersService.user({ id: payload.id as string });

        if (!user || !user.is_active) {
            throw new UnauthorizedException('用户不存在或已被禁用');
        }

        if (user.role !== payload.role) {
            throw new UnauthorizedException('用户角色已变更，请重新登录');
        }

        return payload;
    }
}
