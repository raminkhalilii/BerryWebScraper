import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('should return a friendly message for the homepage', () => {
      const result = appController.root();
      expect(result).toEqual({
        message:
          'Welcome to the Berry KKR Scraper API. Please visit /api to view the Swagger documentation and interact with the endpoints.',
      });
    });
  });
});
