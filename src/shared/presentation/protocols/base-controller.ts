import { HttpResponse } from './http-response';

export abstract class BaseController<Req, Res> {
  abstract handle(request: Req): Promise<HttpResponse<Res>>;

  protected validationRequiredFields(
    request: object,
    requiredFields: string[],
  ): string | null {
    const fields = request as Record<string, unknown>;
    for (const field of requiredFields) {
      if (!fields[field]) {
        return field;
      }
    }
    return null;
  }
}
