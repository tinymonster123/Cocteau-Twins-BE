declare module 'passport-local' {
    import { Request } from 'express';
    import { Strategy as PassportStrategy } from 'passport-strategy';

    export interface StrategyOptions {
        usernameField?: string;
        passwordField?: string;
        passReqToCallback?: boolean;
        session?: boolean;
    }

    export interface VerifyFunction {
        (username: string, password: string, done: (error: any, user?: any, options?: any) => void): void;
    }

    export interface VerifyFunctionWithRequest {
        (req: Request, username: string, password: string, done: (error: any, user?: any, options?: any) => void): void;
    }

    export class Strategy extends PassportStrategy {
        constructor(
            options: StrategyOptions,
            verify: VerifyFunction | VerifyFunctionWithRequest
        );

        authenticate(req: Request, options?: any): any;
    }

    export default Strategy;
}
