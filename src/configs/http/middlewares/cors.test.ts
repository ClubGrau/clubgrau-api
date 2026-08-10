import express from 'express';
import request from 'supertest';
import { cors } from './cors';

describe('Cors Middleware', () => {
  it('should set the cors headers', async () => {
    const app = express();
    app.use(cors);
    app.get('/test_cors', (_req, res) => {
      res.send();
    });
    await request(app)
      .get('/test_cors')
      .expect(200)
      .expect('Access-Control-Allow-Origin', '*')
      .expect('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
      .expect('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  });

  it('should answer preflight OPTIONS with 204', async () => {
    const app = express();
    app.use(cors);
    app.post('/auth', (_req, res) => {
      res.send();
    });
    await request(app)
      .options('/auth')
      .expect(204)
      .expect('Access-Control-Allow-Origin', '*')
      .expect('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
      .expect('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  });
});
