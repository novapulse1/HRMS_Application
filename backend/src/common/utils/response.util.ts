import { Response } from 'express';
import { ApiResponse, ApiResponseMeta } from '../types';

export function sendSuccess<T>(
  res: Response,
  data: T,
  statusCode = 200,
  meta: Partial<ApiResponseMeta> = {}
): Response {
  const responsePayload: ApiResponse<T> = {
    data,
    error: null,
    meta: {
      timestamp: new Date().toISOString(),
      ...meta,
    },
  };
  return res.status(statusCode).json(responsePayload);
}

export function sendError(
  res: Response,
  statusCode = 400,
  code: string,
  message: string,
  details?: unknown
): Response {
  const responsePayload: ApiResponse<null> = {
    data: null,
    error: {
      code,
      message,
      details,
    },
    meta: {
      timestamp: new Date().toISOString(),
    },
  };
  return res.status(statusCode).json(responsePayload);
}
