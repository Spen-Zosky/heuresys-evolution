/**
 * Request ID middleware
 * Generates unique request ID for tracing
 */
import { v4 as uuidv4 } from 'uuid';
export function requestIdMiddleware(req, res, next) {
    const requestId = req.headers['x-request-id'] || uuidv4();
    req.requestId = requestId;
    res.setHeader('X-Request-ID', requestId);
    next();
}
//# sourceMappingURL=requestId.js.map