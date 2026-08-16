import express from 'express';
import request from 'supertest';
import { morgan } from './morgan';

describe('Morgan Middleware', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should be defined', () => {
    expect(morgan).toBeDefined();
    expect(typeof morgan).toBe('function');
  });

  it('should log the request and call next', async () => {
    const writeSpy = jest
      .spyOn(process.stdout, 'write')
      .mockImplementation(() => true);

    const app = express();
    app.use(morgan);
    app.get('/test_morgan', (_req, res) => {
      res.status(200).send('ok');
    });

    await request(app).get('/test_morgan').expect(200).expect('ok');

    expect(writeSpy).toHaveBeenCalled();
    const logged = writeSpy.mock.calls.map((call) => String(call[0])).join('');
    expect(logged).toMatch(/GET\s+\/test_morgan/);
  });
});
