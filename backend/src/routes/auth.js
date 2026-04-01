'use strict';

/**
 * auth_api — Auth Controller
 * Routes: register, login, me
 */

const express = require('express');
const authService = require('../services/auth');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// POST /api/auth/register
// Body: { username, email, password }
router.post('/register', async (req, res) => {
  const { username, email, password } = req.body;
  if (!username || !email || !password) {
    return res.status(400).json({ error: 'username, email, and password are required' });
  }
  try {
    const result = await authService.register(username, email, password);
    res.status(201).json(result);
  } catch (err) {
    if (err.message?.includes('UNIQUE')) {
      return res.status(409).json({ error: 'Username or email already taken' });
    }
    throw err;
  }
});

// POST /api/auth/login
// Body: { email, password }
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'email and password are required' });
  }
  const result = await authService.login(email, password);
  if (!result) return res.status(401).json({ error: 'Invalid credentials' });
  res.json(result);
});

// GET /api/auth/me
router.get('/me', requireAuth, (req, res) => {
  const user = authService.getMe(req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ user });
});

module.exports = router;
