import express from 'express';
import request from 'supertest';
import { bodyParser } from './body-parser';

describe('BodyParser Middleware', () => {
  it('should parse the body of the request as json format', async () => {
    const app = express();
    app.use(bodyParser);
    app.post('/test_body_parser', (req, res) => {
      res.json(req.body);
    });

    await request(app)
      .post('/test_body_parser')
      .send({ name: 'John Doe' })
      .expect(200)
      .expect({ name: 'John Doe' });
  });
});
