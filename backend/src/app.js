const express = require('express');
const cors = require('cors');

const authRouter = require('./routes/auth');
const documentsRouter = require('./routes/documents');
const aiRouter = require('./routes/ai');

const app = express();

app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

app.use('/api/auth', authRouter);
app.use('/api/documents', documentsRouter);
app.use('/api/documents/:id/ai', aiRouter);

// Central error handler
app.use((err, req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

module.exports = app;
