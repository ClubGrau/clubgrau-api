import { MissingParamError } from '@shared/presentation/errors/missing-param.error';
import {
  badRequest,
  HttpErrorBody,
  HttpSuccessBody,
} from '@shared/presentation/helpers/http-helper';
import { BaseController } from '@shared/presentation/protocols/base-controller';
import { HttpResponse } from '@shared/presentation/protocols/http-response';

interface LoginDto {
  email: string;
  password: string;
}

interface LoginResultDto {
  token: string;
}

export class AuthController extends BaseController<
  LoginDto,
  HttpErrorBody | HttpSuccessBody<LoginResultDto>
> {
  async handle(
    request: LoginDto,
  ): Promise<HttpResponse<HttpErrorBody | HttpSuccessBody<LoginResultDto>>> {
    const requiredFields = ['email', 'password'];
    for (const field of requiredFields) {
      if (!request[field as keyof LoginDto]) {
        return badRequest(new MissingParamError(field));
      }
    }

    return {
      statusCode: 200,
      body: {
        data: {
          token: 'any_token',
        },
      },
    };
  }
}
