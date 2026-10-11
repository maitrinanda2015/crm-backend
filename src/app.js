const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');

const ApiError = require('./utils/ApiError');
const errorHandler = require('./middleware/errorHandler');

// Route files
const authRoutes = require('./routes/auth.routes');
const userRoutes = require('./routes/user.routes');
const leadRoutes = require('./routes/lead.routes');
const customerRoutes = require('./routes/customer.routes');
const dealRoutes = require('./routes/deal.routes');
const activityRoutes = require('./routes/activity.routes');
const dashboardRoutes = require('./routes/dashboard.routes');
const settingsRoutes = require('./routes/settings.routes');

const app = express();
app.set('trust proxy', 1); // needed behind Render's proxy (rate limit + secure cookies)

// ---------- Security & parsing ----------
app.use(helmet()); // security headers
app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(express.json({ limit: '10kb' })); // limit body size
app.use(cookieParser());
if (process.env.NODE_ENV === 'development') app.use(morgan('dev'));

// General rate limit: 200 requests / 15 min per IP
app.use(
  '/api',
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 200,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { success: false, message: 'Too many requests, please try again later.' },
  })
);

// ---------- Routes ----------
// Welcome routes (so the deployed link shows something useful)
const welcome = (req, res) => {
  res.json({
    success: true,
    message: 'CRM Sales Management API is running',
    version: '1.0.0',
    baseUrl: '/api',
    endpoints: {
      health: 'GET /api/health',
      auth: '/api/auth (register, login, refresh, logout, me)',
      users: '/api/users',
      leads: '/api/leads',
      customers: '/api/customers',
      deals: '/api/deals',
      activities: '/api/activities',
      settings: '/api/settings',
      dashboard: '/api/dashboard (stats, pipeline, team-performance)',
    },
    docs: 'See README.md and the Postman collection in the GitHub repository',
  });
};
app.get('/', welcome);
app.get('/api', welcome);
app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'CRM API is running' });
});

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/leads', leadRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/deals', dealRoutes);
app.use('/api/activities', activityRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/settings', settingsRoutes);

// ---------- 404 for unknown routes ----------
app.use((req, res, next) => {
  next(ApiError.notFound(`Route ${req.method} ${req.originalUrl} not found`));
});

// ---------- Central error handler (must be last) ----------
app.use(errorHandler);

module.exports = app;