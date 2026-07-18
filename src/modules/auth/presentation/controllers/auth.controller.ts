import { LoginPort } from '@modules/auth/application/ports/inbound/login.port';
import { MissingParamError } from '@shared/presentation/errors/missing-param.error';
import { BaseController } from '@shared/presentation/protocols/base-controller';
import { HttpResponse } from '@shared/presentation/protocols/http-response';
import {
  badRequest,
  HttpErrorBody,
  HttpSuccessBody,
} from '@shared/presentation/helpers/http-helper';
import {
  LoginDto,
  LoginResultDto,
} from '@modules/auth/application/dtos/login.dto';

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
    const requiredFields = ['email', 'password'];
    for (const field of requiredFields) {
      if (!request[field as keyof LoginDto]) {
        return badRequest(new MissingParamError(field));
      }
    }

    await this.login.execute(request);

    return {
      statusCode: 200,
      body: {
        data: {
          token: 'valid_token',
        },
      },
    };
  }
}
