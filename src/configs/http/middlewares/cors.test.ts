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
      .expect('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE')
      .expect('Access-Control-Allow-Headers', 'Content-Type');
  });
});
