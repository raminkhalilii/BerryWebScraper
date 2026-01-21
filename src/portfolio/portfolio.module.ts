import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PortfolioCompany, PortfolioCompanySchema } from './schemas/portfolio-company.schema';
import { ScraperService } from './scraper.service';
import { PortfolioController } from './portfolio.controller';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: PortfolioCompany.name, schema: PortfolioCompanySchema }]),
  ],
  controllers: [PortfolioController],
  providers: [ScraperService],
  exports: [ScraperService],
})
export class PortfolioModule {}
