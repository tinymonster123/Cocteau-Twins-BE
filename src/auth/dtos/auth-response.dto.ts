export class AuthResponseDto {
    success: boolean;
    message: string;
    data?: {
        user: {
            id: string;
            username: string;
            email: string;
            isActive: boolean;
            createdAt: string;
            updatedAt: string;
            lastLogin?: string;
        };
        tokens: {
            accessToken: string;
            refreshToken: string;
            accessTokenExpiresAt: string;
            refreshTokenExpiresAt: string;
        };
        session: {
            sessionId: string;
            expiresAt: string;
        };
    };
    timestamp: string;
}

export class RefreshTokenResponseDto {
    success: boolean;
    message: string;
    data?: {
        tokens: {
            accessToken: string;
            refreshToken: string;
            accessTokenExpiresAt: string;
            refreshTokenExpiresAt: string;
        };
        user: {
            id: string;
            username: string;
            email: string;
            lastActiveAt: string;
        };
    };
    timestamp: string;
}
