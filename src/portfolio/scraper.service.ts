import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as puppeteer from 'puppeteer';
import { PortfolioCompany, PortfolioCompanyDocument } from './schemas/portfolio-company.schema';

@Injectable()
export class ScraperService {
  private readonly logger = new Logger(ScraperService.name);

  constructor(
    @InjectModel(PortfolioCompany.name)
    private readonly companyModel: Model<PortfolioCompanyDocument>,
  ) {}

  async findAll(filter: Record<string, unknown>): Promise<PortfolioCompany[]> {
    return this.companyModel.find(filter).exec();
  }

  async scrapeKKR(): Promise<PortfolioCompany[]> {
    this.logger.log('Launching browser...');
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    try {
      const page = await browser.newPage();
      this.logger.log('Navigating to https://www.kkr.com/invest/portfolio...');
      await page.goto('https://www.kkr.com/invest/portfolio', {
        waitUntil: 'networkidle2',
        timeout: 60000,
      });

      const allCompanies: PortfolioCompany[] = [];
      let pageNumber = 1;

      while (true) {
        this.logger.log(`Waiting for portfolio data to load on page ${pageNumber}...`);
        // Wait for table rows to appear
        await page.waitForSelector('table tr td', { timeout: 30000 });

        this.logger.log(`Extracting company data from page ${pageNumber}...`);
        const currentBatch = await page.evaluate(() => {
          const results: {
            name: string;
            assetClass: string;
            industry: string;
            region: string;
            extraData?: Record<string, string>;
          }[] = [];

          // Select all table rows
          const rows = Array.from(document.querySelectorAll('table tr'));

          rows.forEach((row) => {
            const cells = Array.from(row.querySelectorAll('td'));

            // Skip if not enough cells or if it's a header row (often uses <th> but sometimes <td>)
            if (cells.length < 4) return;

            const name = cells[0]?.textContent?.trim() || '';
            const assetClass = cells[1]?.textContent?.trim() || '';
            const industry = cells[2]?.textContent?.trim() || '';
            const region = cells[3]?.textContent?.trim() || '';

            // Skip header row by checking content
            if (name.toLowerCase() === 'company' || name.toLowerCase() === 'name') return;
            if (!name) return;

            const extraData: Record<string, string> = {};
            // Collect any additional columns beyond the 4th
            if (cells.length > 4) {
              cells.slice(4).forEach((cell, index) => {
                const text = cell.textContent?.trim();
                if (text) {
                  extraData[`column_${index + 5}`] = text;
                }
              });
            }

            results.push({
              name,
              assetClass: assetClass || 'N/A',
              industry,
              region,
              extraData: Object.keys(extraData).length > 0 ? extraData : undefined,
            });
          });

          return results;
        });

        allCompanies.push(...(currentBatch as PortfolioCompany[]));
        this.logger.log(`Scraping page ${pageNumber} - Found ${currentBatch.length} companies`);

        // Handle Pagination
        const nextButtonSelector = '[aria-label="pagination arrow right"]';
        const nextButton = await page.$(nextButtonSelector);

        if (nextButton) {
          const isDisabled = await page.evaluate((el) => {
            return el.hasAttribute('disabled') || el.classList.contains('disabled');
          }, nextButton);

          if (!isDisabled) {
            this.logger.log('Clicking next page...');
            await nextButton.click();

            // Wait for Load
            try {
              await page.waitForNetworkIdle({ timeout: 5000 });
            } catch {
              this.logger.warn('Wait for network idle timed out, using fallback timeout');
              await new Promise((resolve) => setTimeout(resolve, 2000));
            }

            pageNumber++;
          } else {
            this.logger.log('Next button is disabled. Reached the last page.');
            break;
          }
        } else {
          this.logger.log('Next button not found. Reached the last page or no pagination.');
          break;
        }
      }

      this.logger.log(`Found a total of ${allCompanies.length} companies.`);

      // Save companies to database
      await this.saveCompanies(allCompanies);

      this.logger.log('Scraping complete.');
      return allCompanies;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error during scraping: ${errorMessage}`);
      throw error;
    } finally {
      await browser.close();
    }
  }

  public async saveCompanies(companies: PortfolioCompany[]): Promise<void> {
    this.logger.log(`Saving ${companies.length} companies to database...`);
    try {
      for (const company of companies) {
        await this.companyModel
          .findOneAndUpdate({ name: company.name }, company, {
            upsert: true,
            new: true,
            setDefaultsOnInsert: true,
          })
          .exec();
      }
      this.logger.log('Database update complete.');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to save companies to database: ${errorMessage}`);
    }
  }
}
