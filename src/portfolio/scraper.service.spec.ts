import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ScraperService } from './scraper.service';
import { PortfolioCompany, PortfolioCompanyDocument } from './schemas/portfolio-company.schema';

describe('ScraperService', () => {
  let service: ScraperService;
  let model: Model<PortfolioCompanyDocument>;

  const mockPortfolioModel = {
    find: jest.fn().mockReturnValue({
      exec: jest.fn().mockResolvedValue([{ name: 'Company 1' }]),
    }),
    findOneAndUpdate: jest.fn().mockReturnValue({
      exec: jest.fn().mockResolvedValue(true),
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ScraperService,
        {
          provide: getModelToken(PortfolioCompany.name),
          useValue: mockPortfolioModel,
        },
      ],
    }).compile();

    service = module.get<ScraperService>(ScraperService);
    model = module.get(getModelToken(PortfolioCompany.name));
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('saveCompanies', () => {
    it('should call findOneAndUpdate with upsert: true option (Database Logic)', async () => {
      const dummyCompanies: PortfolioCompany[] = [
        {
          name: 'Test Company',
          assetClass: 'Private Equity',
          industry: 'Tech',
          region: 'Americas',
        },
      ];

      await service.saveCompanies(dummyCompanies);

      expect(model.findOneAndUpdate).toHaveBeenCalledWith(
        { name: 'Test Company' },
        dummyCompanies[0],
        expect.objectContaining({ upsert: true }),
      );
    });

    it('should handle saving multiple companies (Scraper Logic)', async () => {
      const dummyCompanies: PortfolioCompany[] = [
        { name: 'Company 1', assetClass: 'Class 1' },
        { name: 'Company 2', assetClass: 'Class 2' },
      ];

      await service.saveCompanies(dummyCompanies);

      expect(model.findOneAndUpdate).toHaveBeenCalledTimes(2);
    });
  });

  describe('findAll', () => {
    it('should return all companies', async () => {
      const result = await service.findAll({});
      expect(model.find).toHaveBeenCalled();
      expect(result).toEqual([{ name: 'Company 1' }]);
    });
  });
});
