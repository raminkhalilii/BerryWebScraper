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
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
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
      let currentPageIndex = 1;

      while (true) {
        // Step 1: Wait for the specific page index to appear
        this.logger.log(`Waiting for rows with data-search-page-index="${currentPageIndex}"...`);
        try {
          await page.waitForSelector(`tr[data-search-page-index="${currentPageIndex}"]`, {
            timeout: 10000,
          });
        } catch {
          this.logger.warn(
            `Timeout waiting for page index ${currentPageIndex}. Assuming end of pagination.`,
          );
          break;
        }

        // Step 2: Scrape only rows for the current page index
        this.logger.log(`Extracting company data for page ${currentPageIndex}...`);
        const rowSelector = `tr[data-search-page-index="${currentPageIndex}"]`;
        const currentBatch = await page.evaluate((selector) => {
          const results: {
            name: string;
            assetClass: string;
            industry: string;
            region: string;
            extraData?: Record<string, string>;
          }[] = [];

          const rows = Array.from(document.querySelectorAll(selector));

          rows.forEach((row) => {
            const cells = Array.from(row.querySelectorAll('td'));

            if (cells.length < 4) return;

            const name = cells[0]?.textContent?.trim() || '';
            const assetClass = cells[1]?.textContent?.trim() || '';
            const industry = cells[2]?.textContent?.trim() || '';
            const region = cells[3]?.textContent?.trim() || '';

            if (name.toLowerCase() === 'company' || name.toLowerCase() === 'name') return;
            if (!name) return;

            const extraData: Record<string, string> = {};
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
        }, rowSelector);

        allCompanies.push(...(currentBatch as PortfolioCompany[]));
        this.logger.log(`Scraped Page ${currentPageIndex} (${currentBatch.length} companies)`);

        // Step 3: Click parent <span> of the SVG next arrow
        const nextArrowSvg = await page.$('[aria-label="pagination arrow right"]');
        if (!nextArrowSvg) {
          this.logger.log('Next arrow SVG not found. Reached the last page or no pagination.');
          break;
        }

        this.logger.log('Clicking next page via parent <span>...');
        try {
          await page.evaluate((el) => {
            if (el && el.parentElement && el.parentElement instanceof HTMLElement) {
              el.parentElement.click();
            }
          }, nextArrowSvg);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          this.logger.warn(`Failed to click next page parent span: ${msg}`);
          break;
        }

        // No waiting here; next loop waits for the new page index
        currentPageIndex++;
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
