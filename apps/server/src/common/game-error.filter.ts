import {
  ArgumentsHost,
  Catch,
  HttpException,
  HttpStatus,
  Logger,
  type ExceptionFilter,
} from '@nestjs/common';
import type { Response } from 'express';
import { GameDomainError } from './game-domain.error.js';

@Catch()
export class GameErrorFilter implements ExceptionFilter {
  private readonly logger = new Logger(GameErrorFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    if (exception instanceof GameDomainError) {
      response.status(exception.status).json({ code: exception.code, message: exception.message });
      return;
    }
    if (exception instanceof HttpException) {
      response.status(exception.getStatus()).json(exception.getResponse());
      return;
    }
    if (this.isDatabaseFailure(exception)) {
      this.logger.error('database error; request returned service unavailable');
      response.status(HttpStatus.SERVICE_UNAVAILABLE).json({
        code: 'DATABASE_UNAVAILABLE',
        message: 'Game server temporarily unavailable.',
      });
      return;
    }
    this.logger.error('unexpected server error');
    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      code: 'INTERNAL_ERROR',
      message: 'Unexpected server error.',
    });
  }

  private isDatabaseFailure(exception: unknown): boolean {
    if (!exception || typeof exception !== 'object') return false;
    const underlying = 'cause' in exception && exception.cause ? exception.cause : exception;
    if (!underlying || typeof underlying !== 'object' || !('code' in underlying)) return false;
    const code = String(underlying.code);
    return (
      code.startsWith('08') ||
      ['ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', '57P01', '57P02', '57P03'].includes(code)
    );
  }
}
