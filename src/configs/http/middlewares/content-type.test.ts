import express, { Express } from 'express';
import request from 'supertest';
import { contentType } from './content-type';

describe('ContentType Middleware', () => {
  let app: Express;
  beforeEach(() => {
    app = express();
    app.use(contentType);
  });

  it('should set the content type of the response to json by default', async () => {
    app.get('/test_content_type', (_req, res) => {
      res.send('');
    });
    await request(app)
      .get('/test_content_type')
      .expect(200)
      .expect('Content-Type', /json/);
  });

  it('shoul return xml content-type when forced', async () => {
    app.get('/test_content_type', (_req, res) => {
      res.type('xml');
      res.send('');
    });
    await request(app)
      .get('/test_content_type')
      .expect(200)
      .expect('Content-Type', /xml/);
  });
});
