import { Controller, Get, Post, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { ScraperService } from './scraper.service';
import { PortfolioCompany } from './schemas/portfolio-company.schema';

@ApiTags('Portfolio')
@Controller('portfolio')
export class PortfolioController {
  constructor(private readonly scraperService: ScraperService) {}

  @ApiOperation({ summary: 'Trigger the scraping process' })
  @ApiResponse({ status: 201, description: 'Scraping completed successfully.' })
  @Post('scrape')
  async scrape(): Promise<{ message: string; count: number }> {
    const results = await this.scraperService.scrapeKKR();
    return {
      message: 'Scraping completed successfully',
      count: results.length,
    };
  }

  @ApiOperation({ summary: 'Retrieve portfolio companies' })
  @ApiQuery({ name: 'region', required: false })
  @ApiQuery({ name: 'industry', required: false })
  @ApiResponse({
    status: 200,
    description: 'List of companies retrieved successfully.',
    type: [PortfolioCompany],
  })
  @Get()
  async getCompanies(
    @Query('region') region?: string,
    @Query('industry') industry?: string,
  ): Promise<PortfolioCompany[]> {
    const filter: { region?: string; industry?: string } = {};

    if (region) {
      filter.region = region;
    }

    if (industry) {
      filter.industry = industry;
    }

    return this.scraperService.findAll(filter);
  }
}
