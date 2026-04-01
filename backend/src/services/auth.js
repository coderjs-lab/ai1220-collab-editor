'use strict';

/**
 * auth_service — Auth Service
 * Token validation, password handling, and session management.
 */

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const userRepo = require('../repositories/users');

const SALT_ROUNDS = 10;

function makeToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
}

function publicUser(user) {
  return { id: user.id, username: user.username, email: user.email };
}

async function register(username, email, password) {
  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const user = userRepo.create(username, email, passwordHash);
  return { user: publicUser(user), token: makeToken(user) };
}

async function login(email, password) {
  const user = userRepo.findByEmail(email);
  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    return null;
  }
  return { user: publicUser(user), token: makeToken(user) };
}

function getMe(userId) {
  const user = userRepo.findById(userId);
  return user ? publicUser(user) : null;
}

module.exports = { register, login, getMe, publicUser };
