import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
  BadRequestException,
  UnauthorizedException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ApiResponse } from '../dto/api-response.dto';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status: number;
    let message: string;
    let errorCode: string;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const responseObj = exceptionResponse as any;
        message = responseObj.message || responseObj.error || exception.message;
        // 如果是验证错误，处理数组形式的错误消息
        if (Array.isArray(responseObj.message)) {
          message = responseObj.message.join('; ');
        }
      } else {
        message = exception.message;
      }

      // 设置错误代码
      errorCode = this.getErrorCode(exception);
    } else {
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      message = '服务器内部错误';
      errorCode = 'INTERNAL_SERVER_ERROR';

      // 记录详细错误信息
      this.logger.error('未处理的异常:', exception);
      if (exception instanceof Error) {
        this.logger.error('错误堆栈:', exception.stack);
      }
    }

    // 构建统一的错误响应格式
    const errorResponse = ApiResponse.error(message, {
      errorCode,
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      requestId: this.generateRequestId(),
    });

    // 记录不同级别的日志
    const logMessage = `${request.method} ${request.url} - ${status} - ${message}`;
    const clientIp = request.ip || request.connection.remoteAddress;
    const userAgent = request.get('User-Agent') || 'Unknown';

    if (status >= 500) {
      this.logger.error(`${logMessage} | IP: ${clientIp} | UA: ${userAgent}`);
    } else if (status >= 400) {
      this.logger.warn(`${logMessage} | IP: ${clientIp}`);
    } else {
      this.logger.log(logMessage);
    }

    response.status(status).json(errorResponse);
  }

  private getErrorCode(exception: HttpException): string {
    if (exception instanceof BadRequestException) {
      return 'BAD_REQUEST';
    } else if (exception instanceof UnauthorizedException) {
      return 'UNAUTHORIZED';
    } else if (exception instanceof ForbiddenException) {
      return 'FORBIDDEN';
    } else if (exception instanceof NotFoundException) {
      return 'NOT_FOUND';
    } else {
      return 'HTTP_EXCEPTION';
    }
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}