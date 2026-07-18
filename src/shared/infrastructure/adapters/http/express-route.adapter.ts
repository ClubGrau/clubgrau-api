import { Request, Response } from 'express';
import { BaseController } from '@shared/presentation/protocols/base-controller';

export const adaptRoute = <Req, Res>(controller: BaseController<Req, Res>) => {
  return async (req: Request, res: Response) => {
    const request = {
      ...(req.body || {}),
      ...(req.params || {}),
      ...(req.query || {}),
      ...(req.headers || {}),
    };
    const httpResponse = await controller.handle(request);
    res.status(httpResponse.statusCode).json(httpResponse.body);
  };
};
