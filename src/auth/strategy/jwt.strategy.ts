import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, ExtractJwt } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { AccessTokenPayload } from '../type/auth.types';
import { RedisService } from '../../redis/redis.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
    constructor(
        private readonly configService: ConfigService,
        private readonly redisService: RedisService,
    ) {
        super({
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
            ignoreExpiration: false,
            secretOrKey: configService.get('JWT_SECRET'),
        });
    }

    async validate(payload: AccessTokenPayload) {
        if (!payload.jti) {
            throw new UnauthorizedException('Token is missing JWT ID (jti)');
        }
        const isBlacklisted = await this.redisService.isBlacklisted(payload.jti);
        if (isBlacklisted) {
            throw new UnauthorizedException('Token has been revoked');
        }
        return payload;
    }
}