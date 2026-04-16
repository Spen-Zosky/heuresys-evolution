/**
 * Application configuration
 */
export declare const config: {
    readonly port: number;
    readonly nodeEnv: "development" | "production" | "test";
    readonly baseUrl: string;
    readonly frontendUrl: string;
    readonly database: {
        readonly host: string;
        readonly port: number;
        readonly user: string;
        readonly password: string;
        readonly name: string;
    };
    readonly jwt: {
        readonly secret: string;
        readonly refreshSecret: string;
        readonly accessTokenExpiry: string;
        readonly refreshTokenExpiry: string;
    };
    readonly cors: {
        readonly origin: string | string[];
        readonly credentials: true;
    };
    readonly rateLimit: {
        readonly windowMs: number;
        readonly max: 100;
    };
    readonly redis: {
        readonly host: string;
        readonly port: number;
        readonly password: string | undefined;
    };
    readonly logging: {
        readonly level: string;
        readonly format: string;
    };
};
export type Config = typeof config;
//# sourceMappingURL=index.d.ts.map