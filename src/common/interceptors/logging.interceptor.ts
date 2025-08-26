import {
    Injectable,
    NestInterceptor,
    ExecutionContext,
    CallHandler,
    Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request, Response } from 'express';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
    private readonly logger = new Logger(LoggingInterceptor.name);

    intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
        const ctx = context.switchToHttp();
        const request = ctx.getRequest<Request>();
        const response = ctx.getResponse<Response>();

        const { method, url, body, params, query } = request;
        const userAgent = request.get('User-Agent') || 'Unknown';
        const clientIp = request.ip || request.connection.remoteAddress;

        const startTime = Date.now();
        const requestId = `req_${startTime}_${Math.random().toString(36).substr(2, 9)}`;

        // 记录请求开始
        this.logger.log(
            `[${requestId}] 请求开始 | ${method} ${url} | IP: ${clientIp} | UA: ${userAgent}`
        );

        // 记录请求参数（敏感信息需要过滤）
        if (Object.keys(body || {}).length > 0) {
            const sanitizedBody = this.sanitizeData(body);
            this.logger.debug(`[${requestId}] 请求体: ${JSON.stringify(sanitizedBody)}`);
        }

        if (Object.keys(params || {}).length > 0) {
            this.logger.debug(`[${requestId}] 路径参数: ${JSON.stringify(params)}`);
        }

        if (Object.keys(query || {}).length > 0) {
            this.logger.debug(`[${requestId}] 查询参数: ${JSON.stringify(query)}`);
        }

        return next.handle().pipe(
            tap({
                next: (data) => {
                    const endTime = Date.now();
                    const duration = endTime - startTime;
                    const statusCode = response.statusCode;

                    this.logger.log(
                        `[${requestId}] 请求完成 | ${method} ${url} | 状态码: ${statusCode} | 耗时: ${duration}ms`
                    );

                    // 记录响应数据（可选，生产环境可能需要关闭）
                    if (process.env.NODE_ENV === 'development') {
                        const sanitizedData = this.sanitizeResponseData(data);
                        this.logger.debug(`[${requestId}] 响应数据: ${JSON.stringify(sanitizedData)}`);
                    }
                },
                error: (error) => {
                    const endTime = Date.now();
                    const duration = endTime - startTime;

                    this.logger.error(
                        `[${requestId}] 请求失败 | ${method} ${url} | 耗时: ${duration}ms | 错误: ${error.message}`
                    );
                },
            }),
        );
    }

    private sanitizeData(data: any): any {
        if (!data || typeof data !== 'object') {
            return data;
        }

        const sensitiveFields = ['password', 'token', 'secret', 'key', 'authorization'];
        const sanitized = { ...data };

        for (const field of sensitiveFields) {
            if (sanitized[field]) {
                sanitized[field] = '***';
            }
        }

        return sanitized;
    }

    private sanitizeResponseData(data: any): any {
        if (!data || typeof data !== 'object') {
            return data;
        }

        // 只显示响应的基本结构，不显示完整数据
        if (data.success !== undefined) {
            return {
                success: data.success,
                message: data.message,
                dataKeys: data.data ? Object.keys(data.data) : undefined,
            };
        }

        return data;
    }
}
