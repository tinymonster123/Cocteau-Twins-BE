import { UUID } from 'crypto';

export interface AccessToken {
    access_token: string;
}

export interface AccessTokenPayload {
    userId: UUID;
    email: string;
};