
import { UUID } from 'crypto';

export interface AuthUser {
    id: string;
    username: string;
    email: string;
    role: string;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
    lastLogin?: string;
}

export interface AuthTokens {
    accessToken: string;
    refreshToken: string;
    accessTokenExpiresAt: string;
    refreshTokenExpiresAt: string;
}

export interface AuthSession {
    sessionId: string;
    expiresAt: string;
}

export interface AuthData {
    user: AuthUser;
    tokens: AuthTokens;
    session: AuthSession;
}

export interface RefreshTokenData {
    tokens: AuthTokens;
    user: {
        id: string;
        username: string;
        email: string;
        lastActiveAt: string;
    };
}

export interface AccessToken {
    access_token: string;
};

export interface AccessTokenPayload {
    id: UUID;
    email: string;
    role: string;
    iat: number;
    exp: number;
    jti: string;
};