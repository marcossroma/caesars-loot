import { CallHandler, ExecutionContext, Injectable, type NestInterceptor } from '@nestjs/common';
import { delay, type Observable } from 'rxjs';

@Injectable()
export class DevDelayInterceptor implements NestInterceptor {
  intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const configuredDelay = Number(process.env['DEV_API_DELAY_MS'] ?? 0);
    if (process.env['NODE_ENV'] === 'production' || !Number.isFinite(configuredDelay)) {
      return next.handle();
    }
    return next.handle().pipe(delay(Math.min(Math.max(configuredDelay, 0), 5000)));
  }
}
