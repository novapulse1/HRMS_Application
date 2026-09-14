import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { sendError } from '../utils/response.util';

export class AppError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
    public details?: unknown
  ) {
    super(message);
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export function globalErrorHandler(
  err: Error | AppError,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  next: NextFunction
): Response {
  if (err instanceof AppError) {
    return sendError(res, err.statusCode, err.code, err.message, err.details);
  }

  if (err instanceof ZodError) {
    return sendError(
      res,
      422,
      'VALIDATION_ERROR',
      'Request input validation failed',
      err.errors.map((e) => ({
        path: e.path.join('.'),
        message: e.message,
      }))
    );
  }

  // Handle Prisma Known Request Errors (e.g., P2002 Unique Constraint)
  if ((err as any).code === 'P2002') {
    const target = Array.isArray((err as any).meta?.target)
      ? (err as any).meta.target.join(', ')
      : (err as any).meta?.target || 'field';
    return sendError(
      res,
      409,
      'DUPLICATE_ENTRY',
      `A record with this ${target} already exists.`,
      (err as any).meta
    );
  }

  console.error('[Unhandled Error]', err);
  return sendError(
    res,
    500,
    'INTERNAL_SERVER_ERROR',
    process.env.NODE_ENV === 'production'
      ? 'An unexpected error occurred'
      : err.message
  );
}
