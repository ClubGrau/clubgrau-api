import { RequestPasswordResetPort } from '@modules/auth/application/ports/inbound/request-password-reset.port';
import { RequestPasswordResetResultDto } from '@modules/auth/application/dtos/request-password-reset.dto';
import { RequestPasswordResetRequest } from '@modules/auth/presentation/http/request-password-reset.request';
import { MissingParamError } from '@shared/presentation/errors/missing-param.error';
import {
  badRequest,
  HttpErrorBody,
  HttpSuccessBody,
  ok,
  serverError,
} from '@shared/presentation/helpers/http-helper';
import { BaseController } from '@shared/presentation/protocols/base-controller';
import { HttpResponse } from '@shared/presentation/protocols/http-response';

export class RequestPasswordResetController extends BaseController<
  RequestPasswordResetRequest,
  HttpErrorBody | HttpSuccessBody<RequestPasswordResetResultDto>
> {
  constructor(private readonly requestPasswordReset: RequestPasswordResetPort) {
    super();
  }

  async handle(
    request: RequestPasswordResetRequest,
  ): Promise<
    HttpResponse<HttpErrorBody | HttpSuccessBody<RequestPasswordResetResultDto>>
  > {
    try {
      if (!request.email) {
        return badRequest(new MissingParamError('email'));
      }

      const result = await this.requestPasswordReset.execute({
        email: request.email,
      });

      return ok(result);
    } catch (error) {
      return serverError(error as Error);
    }
  }
}
