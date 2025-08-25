declare module 'passport-jwt' {
    import { Request } from 'express';
    import { Strategy as PassportStrategy } from 'passport-strategy';

    export interface StrategyOptions {
        jwtFromRequest: (req: Request) => string | null;
        secretOrKey?: string | Buffer;
        secretOrKeyProvider?: (
            req: Request,
            rawJwtToken: string,
            done: (err: any, secret: string | Buffer) => void,
        ) => void;
        issuer?: string;
        audience?: string;
        algorithms?: string[];
        ignoreExpiration?: boolean;
        passReqToCallback?: boolean;
        jsonWebTokenOptions?: any;
    }

    export interface VerifiedCallback {
        (error: any, user?: any, info?: any): void;
    }

    export type VerifyFunction = (payload: any, done: VerifiedCallback) => void;
    export type VerifyFunctionWithRequest = (
        req: Request,
        payload: any,
        done: VerifiedCallback,
    ) => void;

    export class Strategy extends PassportStrategy {
        constructor(
            options: StrategyOptions,
            verify: VerifyFunction | VerifyFunctionWithRequest,
        );
    }

    export const ExtractJwt: {
        fromAuthHeaderAsBearerToken(): (req: Request) => string | null;
        fromHeader(header_name: string): (req: Request) => string | null;
        fromBodyField(field_name: string): (req: Request) => string | null;
        fromUrlQueryParameter(param_name: string): (req: Request) => string | null;
        fromAuthHeaderWithScheme(auth_scheme: string): (req: Request) => string | null;
        fromExtractors(extractors: Array<(req: Request) => string | null>): (req: Request) => string | null;
        versionOneCompatibility(options: any): (req: Request) => string | null;
    };
}   