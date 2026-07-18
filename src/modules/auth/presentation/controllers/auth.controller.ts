import { LoginPort } from '@modules/auth/application/ports/inbound/login.port';
import {
  LoginDto,
  LoginResultDto,
} from '@modules/auth/application/dtos/login.dto';
import { AuthenticationError } from '@modules/auth/domain/errors/auth.errors';
import { MissingParamError } from '@shared/presentation/errors/missing-param.error';
import {
  badRequest,
  HttpErrorBody,
  HttpSuccessBody,
  ok,
  serverError,
  unauthorized,
} from '@shared/presentation/helpers/http-helper';
import { BaseController } from '@shared/presentation/protocols/base-controller';
import { HttpResponse } from '@shared/presentation/protocols/http-response';

export class AuthController extends BaseController<
  LoginDto,
  HttpErrorBody | HttpSuccessBody<LoginResultDto>
> {
  constructor(private readonly login: LoginPort) {
    super();
  }

  async handle(
    request: LoginDto,
  ): Promise<HttpResponse<HttpErrorBody | HttpSuccessBody<LoginResultDto>>> {
    try {
      const requiredFields = ['email', 'password'];
      for (const field of requiredFields) {
        if (!request[field as keyof LoginDto]) {
          return badRequest(new MissingParamError(field));
        }
      }

      const { token } = await this.login.execute(request);

      return ok({ token });
    } catch (error) {
      if (error instanceof AuthenticationError) {
        return unauthorized(error);
      }
      return serverError(error as Error);
    }
  }
}
