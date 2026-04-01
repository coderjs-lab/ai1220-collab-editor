'use strict';

const express = require('express');
const cors = require('cors');

const authRouter    = require('./routes/auth');
const documentsRouter = require('./routes/documents');
const accessRouter  = require('./routes/access');
const sessionsRouter = require('./routes/sessions');
const aiRouter      = require('./routes/ai');

const app = express();

// Allow the frontend dev server and any configured production origin.
const allowedOrigins = (process.env.CORS_ORIGIN ?? 'http://localhost:5173')
  .split(',')
  .map(o => o.trim());

app.use(cors({
  origin: allowedOrigins,
  credentials: true,
}));

app.use(express.json());

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

app.use('/api/auth',                    authRouter);
app.use('/api/documents',               documentsRouter);
app.use('/api/documents/:id/share',     accessRouter);
app.use('/api/documents/:id/session',   sessionsRouter);
app.use('/api/documents/:id/ai',        aiRouter);

// Central error handler
app.use((err, req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

module.exports = app;
