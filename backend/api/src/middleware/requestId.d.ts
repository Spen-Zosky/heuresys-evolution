/**
 * Request ID middleware
 * Generates unique request ID for tracing
 */
import { Request, Response, NextFunction } from 'express';
declare global {
    namespace Express {
        interface Request {
            requestId: string;
        }
    }
}
export declare function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void;
//# sourceMappingURL=requestId.d.ts.map