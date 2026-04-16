/**
 * Security Middleware Configuration
 * Provides comprehensive security headers for the API Gateway
 */
/**
 * Helmet configuration with all security headers
 */
export declare const helmetConfig: {
    contentSecurityPolicy: {
        directives: {
            defaultSrc: string[];
            scriptSrc: string[];
            styleSrc: string[];
            imgSrc: string[];
            connectSrc: string[];
            fontSrc: string[];
            objectSrc: string[];
            mediaSrc: string[];
            frameSrc: string[];
            baseUri: string[];
            formAction: string[];
            frameAncestors: string[];
            upgradeInsecureRequests: never[] | null;
        };
        reportOnly: boolean;
    };
    crossOriginEmbedderPolicy: boolean;
    crossOriginOpenerPolicy: {
        policy: "same-origin";
    };
    crossOriginResourcePolicy: {
        policy: "same-origin";
    };
    dnsPrefetchControl: {
        allow: boolean;
    };
    ieNoOpen: boolean;
    frameguard: {
        action: "deny";
    };
    hsts: boolean | {
        maxAge: number;
        includeSubDomains: boolean;
        preload: boolean;
    };
    noSniff: boolean;
    originAgentCluster: boolean;
    permittedCrossDomainPolicies: {
        permittedPolicies: "none";
    };
    referrerPolicy: {
        policy: "strict-origin-when-cross-origin";
    };
    xssFilter: boolean;
};
/**
 * Security middleware with full configuration
 */
export declare const securityMiddleware: (req: import("http").IncomingMessage, res: import("http").ServerResponse, next: (err?: unknown) => void) => void;
/**
 * Additional security response headers
 * Applied after helmet for any custom headers
 */
export declare function additionalSecurityHeaders(_req: import('express').Request, res: import('express').Response, next: import('express').NextFunction): void;
/**
 * Export combined security middleware
 */
declare const _default: (typeof additionalSecurityHeaders)[];
export default _default;
//# sourceMappingURL=security.d.ts.map