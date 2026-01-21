import { Test, TestingModule } from '@nestjs/testing';
import { PortfolioController } from './portfolio.controller';
import { ScraperService } from './scraper.service';

describe('PortfolioController', () => {
  let controller: PortfolioController;
  let service: ScraperService;

  const mockScraperService = {
    scrapeKKR: jest.fn().mockResolvedValue([{ name: 'Company 1' }]),
    findAll: jest.fn().mockResolvedValue([{ name: 'Company 1' }]),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PortfolioController],
      providers: [
        {
          provide: ScraperService,
          useValue: mockScraperService,
        },
      ],
    }).compile();

    controller = module.get<PortfolioController>(PortfolioController);
    service = module.get<ScraperService>(ScraperService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('scrape', () => {
    it('should call service.scrapeKKR and return success message', async () => {
      const result = await controller.scrape();
      expect(service.scrapeKKR).toHaveBeenCalled();
      expect(result).toEqual({
        message: 'Scraping completed successfully',
        count: 1,
      });
    });
  });

  describe('getCompanies', () => {
    it('should call service.findAll with correct arguments', async () => {
      const query = { region: 'Americas', industry: 'Technology' };
      const result = await controller.getCompanies(query.region, query.industry);
      expect(service.findAll).toHaveBeenCalledWith(query);
      expect(result).toEqual([{ name: 'Company 1' }]);
    });
  });
});
