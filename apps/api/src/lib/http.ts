import type { NextFunction, Request, Response } from 'express';

/** Application error with an HTTP status and machine-readable code. */
export class ApiError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
    this.name = 'ApiError';
  }
  static badRequest(msg = 'Invalid request') {
    return new ApiError(400, 'BAD_REQUEST', msg);
  }
  static unauthorized(msg = 'Authentication required') {
    return new ApiError(401, 'UNAUTHORIZED', msg);
  }
  static forbidden(msg = 'Not allowed') {
    return new ApiError(403, 'FORBIDDEN', msg);
  }
  static notFound(msg = 'Not found') {
    return new ApiError(404, 'NOT_FOUND', msg);
  }
  static conflict(msg = 'Conflict') {
    return new ApiError(409, 'CONFLICT', msg);
  }
}

/** Wrap an async route handler so rejected promises reach the error middleware. */
export function asyncHandler<T extends Request>(
  fn: (req: T, res: Response, next: NextFunction) => Promise<unknown>,
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req as T, res, next)).catch(next);
  };
}
