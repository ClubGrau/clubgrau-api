import {
  bodyParser,
  contentType,
  cors,
  morgan,
} from '@configs/http/middlewares';
import { Express } from 'express';

export default (app: Express) => {
  const middlewares = [morgan, bodyParser, contentType, cors];
  middlewares.forEach((middleware) => app.use(middleware));
};
