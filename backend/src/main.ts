import dotenv from 'dotenv';
dotenv.config();

// SEC-04: Strict Environment Secret Validation at Boot
if (
  !process.env.JWT_ADMIN_SECRET ||
  process.env.JWT_ADMIN_SECRET.length < 32 ||
  !process.env.JWT_TENANT_SECRET ||
  process.env.JWT_TENANT_SECRET.length < 32
) {
  console.error('FATAL: JWT_ADMIN_SECRET and JWT_TENANT_SECRET must be set and at least 32 characters long.');
  process.exit(1);
}

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import prisma from './common/prisma/prisma.service';
import { globalErrorHandler } from './common/middleware/error.middleware';
import { sendSuccess } from './common/utils/response.util';

// Routers
import superAdminRouter from './modules/super-admin/super-admin.router';
import authRouter from './modules/auth/auth.router';
import employeesRouter from './modules/employees/employees.router';
import attendanceRouter from './modules/attendance/attendance.router';
import leaveRouter from './modules/leave/leave.router';
import shiftsRouter from './modules/shifts/shifts.router';
import payrollRouter from './modules/payroll/payroll.router';
import settingsRouter from './modules/company-settings/company-settings.router';
import reportsRouter from './modules/reports/reports.router';
import documentsRouter from './modules/documents/documents.router';
import auditLogsRouter from './modules/audit-logs/audit-logs.router';
import ticketsRouter from './modules/tickets/tickets.router';
import noticesRouter from './modules/notices/notices.router';

const app = express();
const PORT = process.env.PORT || 4000;

// Security & Middlewares
app.use(
  helmet({
    contentSecurityPolicy: process.env.NODE_ENV === 'production',
    crossOriginEmbedderPolicy: false,
  })
);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, postman) or any client
      if (!origin) return callback(null, true);
      // Automatically allow Netlify, Vercel, localhost or configured FRONTEND_URL
      if (
        origin.includes('localhost') ||
        origin.includes('netlify.app') ||
        origin.includes('vercel.app') ||
        origin.includes('onrender.com') ||
        (process.env.FRONTEND_URL && origin === process.env.FRONTEND_URL)
      ) {
        return callback(null, true);
      }
      return callback(null, true);
    },
    credentials: true,
  })
);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return sendSuccess(res, {
      service: 'Nova Pulse HRMS Backend',
      status: 'HEALTHY',
      database: 'CONNECTED',
      timestamp: new Date().toISOString(),
    });
  } catch (err: unknown) {
    return res.status(503).json({
      data: null,
      error: {
        code: 'DATABASE_UNAVAILABLE',
        message: 'Unable to communicate with PostgreSQL',
      },
      meta: { timestamp: new Date().toISOString() },
    });
  }
});

// Mount modular API routers under /api/v1/
app.use('/api/v1/admin', superAdminRouter);
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/employees', employeesRouter);
app.use('/api/v1/attendance', attendanceRouter);
app.use('/api/v1/leave', leaveRouter);
app.use('/api/v1/shifts', shiftsRouter);
app.use('/api/v1/payroll', payrollRouter);
app.use('/api/v1/settings', settingsRouter);
app.use('/api/v1/reports', reportsRouter);
app.use('/api/v1/documents', documentsRouter);
app.use('/api/v1/audit-logs', auditLogsRouter);
app.use('/api/v1/tickets', ticketsRouter);
app.use('/api/v1/notices', noticesRouter);

// Global exception filter
app.use(globalErrorHandler);

if (process.env.NODE_ENV !== 'test' && !process.env.JEST_WORKER_ID) {
  app.listen(PORT, () => {
    console.log(`🚀 Nova Pulse HRMS API server running on port ${PORT}`);
    console.log(`🌐 Base URL: http://localhost:${PORT}/api/v1`);
  });
}

export default app;
