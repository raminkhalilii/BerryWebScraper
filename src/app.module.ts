import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import * as Joi from 'joi';
import { AppController } from './app.controller';
import { DatabaseModule } from './database/database.module';
import { PortfolioModule } from './portfolio/portfolio.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: Joi.object({
        NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
        PORT: Joi.number().default(3000),
        MONGO_URI: Joi.string().required(),
      }),
    }),
    DatabaseModule,
    PortfolioModule,
  ],
  controllers: [AppController],
  providers: [],
})
export class AppModule {}
