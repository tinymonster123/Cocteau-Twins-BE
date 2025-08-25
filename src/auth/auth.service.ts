import { BadRequestException, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { users } from '@prisma/client';
import { UsersService } from 'src/users/users.service';
import { RegisterDto } from './dto/register.dto';
import { AuthResponseDto } from './dto/authResponse.dto';
import crypto from 'crypto';

@Injectable()
export class AuthService {
    constructor(
        private usersService: UsersService,
        private jwtService: JwtService,
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
        const accessTtlMs = 15 * 60 * 1000; // 15m
        const refreshTtlMs = 7 * 24 * 60 * 60 * 1000; // 7d

        const accessToken = this.jwtService.sign(payload);
        const refreshToken = this.jwtService.sign({ ...payload, sid: sessionId, type: 'refresh' });

        return {
            success: true,
            message: 'OK',
            data: {
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
            },
            timestamp: new Date(now).toISOString(),
        };
    }

    async login(user: users): Promise<AuthResponseDto> {
        return this.buildAuthResponse(user);
    }

    async register(body: RegisterDto): Promise<AuthResponseDto> {
        const { username, email, password } = body;
        const existingUser = await this.usersService.user({ email });
        if (existingUser) {
            throw new BadRequestException('Email already exists');
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
        return this.buildAuthResponse(created);
    }
}