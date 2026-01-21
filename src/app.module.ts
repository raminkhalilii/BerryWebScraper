import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './database/database.module';
import { PortfolioModule } from './portfolio/portfolio.module';
import { CommonModule } from './common/common.module';

@Module({
  imports: [DatabaseModule, PortfolioModule, CommonModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
