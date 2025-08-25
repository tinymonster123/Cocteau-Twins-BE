import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { Logger } from '@nestjs/common';

const bootstrap = async () => {
    const logger = new Logger();
    const app = await NestFactory.create(AppModule);
    const config = new DocumentBuilder()
        .setTitle('Cocteau Twins API')
        .setDescription('The Cocteau Twins API description')
        .setVersion('1.0')
        .addTag('cocteau twins')
        .build();
    const documentFactory = () => SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api', app, documentFactory);
    app.enableCors();
    app.useGlobalPipes(new ValidationPipe());
    const port = process.env.PORT || 3000;
    await app.listen(port);
    logger.log(`Application listening on port ${port}`);
};
bootstrap();
