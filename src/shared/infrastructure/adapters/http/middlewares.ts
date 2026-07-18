import { bodyParser, contentType, cors } from '@configs/http/middlewares';
import { Express } from 'express';

export default (app: Express) => {
  const middlewares = [bodyParser, contentType, cors];
  middlewares.forEach((middleware) => app.use(middleware));
};
