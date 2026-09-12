import { CompletePasswordResetPort } from '@modules/auth/application/ports/inbound/complete-password-reset.port';
import { CompletePasswordResetResultDto } from '@modules/auth/application/dtos/complete-password-reset.dto';
import {
  InvalidOrExpiredTokenError,
  PasswordResetedNotMatchError,
} from '@modules/auth/domain/errors/auth.errors';
import { CompletePasswordResetRequest } from '@modules/auth/presentation/http/complete-password-reset.request';
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

export class CompletePasswordResetController extends BaseController<
  CompletePasswordResetRequest,
  HttpErrorBody | HttpSuccessBody<CompletePasswordResetResultDto>
> {
  constructor(
    private readonly completePasswordReset: CompletePasswordResetPort,
  ) {
    super();
  }

  async handle(
    request: CompletePasswordResetRequest,
  ): Promise<
    HttpResponse<
      HttpErrorBody | HttpSuccessBody<CompletePasswordResetResultDto>
    >
  > {
    try {
      const missingField = this.validationRequiredFields(request, [
        'token',
        'password',
        'passwordConfirmation',
      ]);
      if (missingField) {
        return badRequest(new MissingParamError(missingField));
      }

      const result = await this.completePasswordReset.execute({
        token: String(request.token),
        password: String(request.password),
        passwordConfirmation: String(request.passwordConfirmation),
      });

      return ok(result);
    } catch (error) {
      if (
        error instanceof PasswordResetedNotMatchError ||
        error instanceof InvalidOrExpiredTokenError
      ) {
        return badRequest(error);
      }

      return serverError(error as Error);
    }
  }
}
