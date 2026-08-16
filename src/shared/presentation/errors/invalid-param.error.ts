import { PresentationError } from './presentation.error';

export class InvalidParamError extends PresentationError {
  constructor(paramName: string) {
    super(`Invalid param ${paramName}`);
  }
}
