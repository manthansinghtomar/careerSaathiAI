require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const connectDB = require('./config/db');
const { notFound, errorHandler } = require('./middleware/errorMiddleware');

const app = express();

// CORS Configuration
const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';
app.use(
  cors({
    origin: clientUrl,
    credentials: true,
  })
);

// Body Parser Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health Check Endpoint
app.get('/api/health', (req, res) => {
  const dbState = mongoose.connection.readyState;
  const dbStatusMap = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting',
  };

  const isDbHealthy = dbState === 1;

  res.status(isDbHealthy ? 200 : 503).json({
    success: isDbHealthy,
    status: isDbHealthy ? 'healthy' : 'degraded',
    service: 'CareerSaathi AI Backend',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    database: {
      status: dbStatusMap[dbState] || 'unknown',
      name: mongoose.connection.name || 'careersaathi',
      host: mongoose.connection.host || '127.0.0.1',
    },
  });
});

// Mount Routes
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const questionRoutes = require('./routes/questionRoutes');
const assessmentRoutes = require('./routes/assessmentRoutes');
const progressRoutes = require('./routes/progressRoutes');
const trainerRoutes = require('./routes/trainerRoutes');
const adminRoutes = require('./routes/adminRoutes');

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/questions', questionRoutes);
app.use('/api/assessments', assessmentRoutes);
app.use('/api/progress', progressRoutes);
app.use('/api/trainer', trainerRoutes);
app.use('/api/admin', adminRoutes);

// 404 and Centralized Error Handling Middleware
app.use(notFound);
app.use(errorHandler);

// Start Server after connecting to MongoDB
const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    await connectDB();
    const server = app.listen(PORT, () => {
      console.log(
        `CareerSaathi AI backend running on port ${PORT} [${
          process.env.NODE_ENV || 'development'
        }]`
      );
    });
    return server;
  } catch (error) {
    console.error('Failed to start server:', error.message);
    process.exit(1);
  }
};

if (process.env.NODE_ENV !== 'test') {
  startServer();
}

module.exports = app;
