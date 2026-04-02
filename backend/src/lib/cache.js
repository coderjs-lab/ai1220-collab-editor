'use strict';

/**
 * cache_client — Cache Client
 * Integration layer for Redis (sessions, quota counters, transient task state).
 *
 * Status: stub — Redis is not provisioned in the PoC environment.
 * All operations are no-ops; callers behave as if the cache always misses.
 * Replace with a real ioredis/redis client when Redis becomes available.
 */

const cache = {
  /** @returns {Promise<string|null>} */
  async get(/* key */) { return null; },

  /** @returns {Promise<void>} */
  async set(/* key, value, ttlSeconds */) {},

  /** @returns {Promise<void>} */
  async del(/* key */) {},

  /** @returns {Promise<number>} */
  async incr(/* key */) { return 0; },
};

module.exports = cache;
