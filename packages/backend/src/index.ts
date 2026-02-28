import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { testConnection as testDbConnection } from './config/database.js';
import { testOllamaConnection } from './config/ollama.js';
import { errorHandler } from './middleware/error-handler.js';
import { requireAuth } from './middleware/auth.middleware.js';
import authRoutes from './routes/auth.routes.js';
import queueRoutes from './routes/queue.routes.js';
import uploadRoutes from './routes/upload.routes.js';
import customerRoutes from './routes/customer.routes.js';
import salesInvoiceRoutes from './routes/sales-invoice.routes.js';
import productRoutes from './routes/product.routes.js';
import usersRoutes from './routes/users.routes.js';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Trust proxy (required when behind nginx)
app.set('trust proxy', 1);

// Middleware
app.use(cors({
  origin: true, // Allow all origins in development
  credentials: true,
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Request logging
app.use((req, _res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Health check endpoint
app.get('/health', async (_req: Request, res: Response) => {
  const dbConnected = await testDbConnection();
  const ollamaConnected = await testOllamaConnection();

  const status = dbConnected && ollamaConnected ? 'healthy' : 'unhealthy';
  const statusCode = status === 'healthy' ? 200 : 503;

  res.status(statusCode).json({
    status,
    timestamp: new Date().toISOString(),
    services: {
      database: dbConnected ? 'connected' : 'disconnected',
      ollama: ollamaConnected ? 'connected' : 'disconnected',
    },
  });
});

// Auth routes (public — must be before requireAuth middleware)
app.use('/api/auth', authRoutes);

// Protect all subsequent /api/* routes
app.use('/api', requireAuth);

// Protected API Routes
app.use('/api/queue', queueRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/sales-invoices', salesInvoiceRoutes);
app.use('/api/products', productRoutes);
app.use('/api/users', usersRoutes);

// Root endpoint
app.get('/', (_req: Request, res: Response) => {
  res.json({
    name: 'WizQueue API',
    version: '1.0.0',
    description: '3D Printing Queue Generator API',
    endpoints: {
      health: '/health',
      queue: '/api/queue',
      upload: '/api/upload',
    },
  });
});

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: 'Not found',
    message: `Cannot ${req.method} ${req.path}`,
  });
});

// Error handler (must be last)
app.use(errorHandler);

// Start server
async function startServer() {
  try {
    console.log('\n🚀 Starting WizQueue Backend Server...\n');

    // Test database connection
    console.log('📊 Testing database connection...');
    const dbConnected = await testDbConnection();
    if (!dbConnected) {
      console.error('❌ Database connection failed. Please check your configuration.');
      process.exit(1);
    }

    // Test Ollama connection
    console.log('🤖 Testing Ollama connection...');
    const ollamaConnected = await testOllamaConnection();
    if (!ollamaConnected) {
      console.warn('⚠️  Ollama connection failed. PDF extraction will not work.');
      console.warn('   Please ensure Ollama is running: ollama serve');
      console.warn(`   And the model is installed: ollama pull ${process.env.OLLAMA_MODEL || 'llava'}`);
    }

    // Start Express server
    app.listen(PORT, () => {
      console.log(`\n✅ Server running on port ${PORT}`);
      console.log(`📍 API: http://localhost:${PORT}/api`);
      console.log(`🏥 Health: http://localhost:${PORT}/health\n`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
