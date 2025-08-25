import { UUID } from 'crypto';

export interface AccessToken {
    access_token: string;
}

export interface AccessTokenPayload {
    id: UUID;
    email: string;
};