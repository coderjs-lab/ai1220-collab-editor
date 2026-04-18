'use strict';

/**
 * Integration test for the collaborative editor backend.
 *
 * Covers the full PoC flow:
 *   register → login → create doc → update doc (version snapshot) →
 *   share doc → access as collaborator → AI suggest stub → AI history
 *
 * Uses an in-memory SQLite database so every test run starts clean.
 * No external services or fixtures required.
 */

const { test, before, after, describe } = require('node:test');
const assert = require('node:assert/strict');

// Must be set before any module that touches the DB or JWT is loaded.
process.env.JWT_SECRET = 'integration-test-secret';
process.env.DB_PATH = ':memory:';

const app = require('../src/app');

// ─── Helpers ──────────────────────────────────────────────────────────────────

let server;
let BASE;

function url(path) {
  return `${BASE}${path}`;
}

async function req(method, path, { body, token } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(url(path), {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, body: json };
}

// ─── Lifecycle ────────────────────────────────────────────────────────────────

before(async () => {
  await new Promise(resolve => {
    server = app.listen(0, resolve);
  });
  BASE = `http://localhost:${server.address().port}`;
});

after(() => server.close());

// ─── Health ───────────────────────────────────────────────────────────────────

test('GET /api/health returns ok', async () => {
  const { status, body } = await req('GET', '/api/health');
  assert.equal(status, 200);
  assert.equal(body.status, 'ok');
});

// ─── Auth ─────────────────────────────────────────────────────────────────────

describe('Auth', () => {
  let aliceToken;
  let bobToken;

  test('register alice', async () => {
    const { status, body } = await req('POST', '/api/auth/register', {
      body: { username: 'alice', email: 'alice@test.com', password: 'pass123' },
    });
    assert.equal(status, 201);
    assert.equal(body.user.username, 'alice');
    assert.ok(body.token, 'token should be present');
    aliceToken = body.token;
  });

  test('duplicate registration is rejected', async () => {
    const { status } = await req('POST', '/api/auth/register', {
      body: { username: 'alice', email: 'alice@test.com', password: 'pass123' },
    });
    assert.equal(status, 409);
  });

  test('register bob', async () => {
    const { status, body } = await req('POST', '/api/auth/register', {
      body: { username: 'bob', email: 'bob@test.com', password: 'pass456' },
    });
    assert.equal(status, 201);
    bobToken = body.token;
  });

  test('login with correct credentials', async () => {
    const { status, body } = await req('POST', '/api/auth/login', {
      body: { email: 'alice@test.com', password: 'pass123' },
    });
    assert.equal(status, 200);
    assert.ok(body.token);
    aliceToken = body.token; // refresh
  });

  test('login with wrong password is rejected', async () => {
    const { status } = await req('POST', '/api/auth/login', {
      body: { email: 'alice@test.com', password: 'wrong' },
    });
    assert.equal(status, 401);
  });

  test('GET /api/auth/me returns current user', async () => {
    const { status, body } = await req('GET', '/api/auth/me', { token: aliceToken });
    assert.equal(status, 200);
    assert.equal(body.user.email, 'alice@test.com');
  });

  test('unauthenticated request is rejected', async () => {
    const { status } = await req('GET', '/api/auth/me');
    assert.equal(status, 401);
  });

  // Expose tokens for subsequent describe blocks via a shared state object.
  // Node test runner runs describe blocks in order so this is safe.
  after(() => {
    shared.aliceToken = aliceToken;
    shared.bobToken = bobToken;
  });
});

// Shared state passed between describe blocks.
const shared = {};

// ─── Documents ────────────────────────────────────────────────────────────────

describe('Documents', () => {
  let docId;

  test('create a document', async () => {
    const { status, body } = await req('POST', '/api/documents', {
      token: shared.aliceToken,
      body: { title: 'Meeting Notes', content: 'Initial content' },
    });
    assert.equal(status, 201);
    assert.equal(body.document.title, 'Meeting Notes');
    assert.equal(body.document.content, 'Initial content');
    docId = body.document.id;
    shared.docId = docId;
  });

  test('list documents returns owned doc', async () => {
    const { status, body } = await req('GET', '/api/documents', {
      token: shared.aliceToken,
    });
    assert.equal(status, 200);
    assert.ok(body.documents.some(d => d.id === docId));
  });

  test('get document by id', async () => {
    const { status, body } = await req('GET', `/api/documents/${docId}`, {
      token: shared.aliceToken,
    });
    assert.equal(status, 200);
    assert.equal(body.document.id, docId);
    assert.deepEqual(body.collaborators, []);
  });

  test('update document content snapshots previous version', async () => {
    const { status, body } = await req('PUT', `/api/documents/${docId}`, {
      token: shared.aliceToken,
      body: { content: 'Updated content' },
    });
    assert.equal(status, 200);
    assert.equal(body.document.content, 'Updated content');

    // Check version history
    const { body: vBody } = await req('GET', `/api/documents/${docId}/versions?full=1`, {
      token: shared.aliceToken,
    });
    assert.equal(vBody.versions.length, 1);
    assert.equal(vBody.versions[0].content, 'Initial content');
  });

  test('non-collaborator cannot read document', async () => {
    const { status } = await req('GET', `/api/documents/${docId}`, {
      token: shared.bobToken,
    });
    assert.equal(status, 403);
  });

  test('non-collaborator cannot update document', async () => {
    const { status } = await req('PUT', `/api/documents/${docId}`, {
      token: shared.bobToken,
      body: { content: 'Malicious edit' },
    });
    assert.equal(status, 403);
  });
});

// ─── Sharing ──────────────────────────────────────────────────────────────────

describe('Sharing', () => {
  test('owner can share document with another user', async () => {
    const { status, body } = await req(
      'POST', `/api/documents/${shared.docId}/share`,
      { token: shared.aliceToken, body: { email: 'bob@test.com', role: 'editor' } }
    );
    assert.equal(status, 201);
    assert.equal(body.permission.user.email, 'bob@test.com');
    assert.equal(body.permission.role, 'editor');
  });

  test('collaborator can now read the document', async () => {
    const { status, body } = await req('GET', `/api/documents/${shared.docId}`, {
      token: shared.bobToken,
    });
    assert.equal(status, 200);
    assert.equal(body.collaborators.length, 1);
    assert.equal(body.collaborators[0].email, 'bob@test.com');
  });

  test('collaborator with editor role can update document', async () => {
    const { status } = await req('PUT', `/api/documents/${shared.docId}`, {
      token: shared.bobToken,
      body: { content: "Bob's edit" },
    });
    assert.equal(status, 200);
  });

  test('document appears in collaborator document list', async () => {
    const { body } = await req('GET', '/api/documents', { token: shared.bobToken });
    assert.ok(body.documents.some(d => d.id === shared.docId));
  });

  test('owner can revoke access', async () => {
    // Need bob's user id — get it from the collaborators list
    const { body: docBody } = await req('GET', `/api/documents/${shared.docId}`, {
      token: shared.aliceToken,
    });
    const bobId = docBody.collaborators.find(c => c.email === 'bob@test.com').id;

    const { status } = await req(
      'DELETE', `/api/documents/${shared.docId}/share/${bobId}`,
      { token: shared.aliceToken }
    );
    assert.equal(status, 200);

    // Bob can no longer access
    const { status: afterStatus } = await req('GET', `/api/documents/${shared.docId}`, {
      token: shared.bobToken,
    });
    assert.equal(afterStatus, 403);
  });
});

// ─── AI integration ───────────────────────────────────────────────────────────

describe('AI suggest integration', () => {
  test('POST /ai/suggest forwards document_context to the AI service and logs interaction', async () => {
    const aiServiceBase = 'http://mock-ai-service.test';
    const originalFetch = global.fetch;
    const originalAiServiceUrl = process.env.AI_SERVICE_URL;
    let capturedPayload = null;

    process.env.AI_SERVICE_URL = aiServiceBase;
    global.fetch = async (input, init = {}) => {
      const url =
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url;

      if (url === `${aiServiceBase}/complete`) {
        capturedPayload = JSON.parse(String(init.body ?? '{}'));
        return new Response(
          JSON.stringify({ suggestion: '[mock-ai] concise summary' }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      return originalFetch(input, init);
    };

    try {
      const { status: docStatus, body: docBody } = await req(
        'GET',
        `/api/documents/${shared.docId}`,
        { token: shared.aliceToken }
      );
      assert.equal(docStatus, 200);
      const expectedDocumentContext = docBody.document.content;

      const { status, body } = await req(
        'POST', `/api/documents/${shared.docId}/ai/suggest`,
        { token: shared.aliceToken, body: { prompt: 'Summarize this document.' } }
      );
      assert.equal(status, 200);
      assert.equal(body.suggestion, '[mock-ai] concise summary');

      assert.ok(capturedPayload, 'AI service payload should be captured');
      assert.equal(capturedPayload.prompt, 'Summarize this document.');
      assert.equal(capturedPayload.scope, 'document');
      assert.equal(capturedPayload.document_context, expectedDocumentContext);
    } finally {
      global.fetch = originalFetch;
      if (originalAiServiceUrl === undefined) {
        delete process.env.AI_SERVICE_URL;
      } else {
        process.env.AI_SERVICE_URL = originalAiServiceUrl;
      }
    }
  });

  test('GET /ai/history returns logged interactions', async () => {
    const { status, body } = await req(
      'GET', `/api/documents/${shared.docId}/ai/history`,
      { token: shared.aliceToken }
    );
    assert.equal(status, 200);
    assert.ok(body.history.length >= 1);
    assert.equal(body.history[0].prompt, 'Summarize this document.');
  });

  test('non-collaborator cannot access AI endpoints', async () => {
    const suggest = await req(
      'POST', `/api/documents/${shared.docId}/ai/suggest`,
      { token: shared.bobToken, body: { prompt: 'Try to access private doc' } }
    );
    assert.equal(suggest.status, 403);

    const history = await req(
      'GET', `/api/documents/${shared.docId}/ai/history`,
      { token: shared.bobToken }
    );
    assert.equal(history.status, 403);
  });
});

// ─── Delete ───────────────────────────────────────────────────────────────────

describe('Delete', () => {
  test('non-owner cannot delete document', async () => {
    // Re-share first so bob has access, then try delete
    await req('POST', `/api/documents/${shared.docId}/share`, {
      token: shared.aliceToken,
      body: { email: 'bob@test.com', role: 'editor' },
    });
    const { status } = await req('DELETE', `/api/documents/${shared.docId}`, {
      token: shared.bobToken,
    });
    assert.equal(status, 403);
  });

  test('owner can delete document', async () => {
    const { status } = await req('DELETE', `/api/documents/${shared.docId}`, {
      token: shared.aliceToken,
    });
    assert.equal(status, 200);

    const { status: getStatus } = await req('GET', `/api/documents/${shared.docId}`, {
      token: shared.aliceToken,
    });
    assert.equal(getStatus, 404);
  });
});
