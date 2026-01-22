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
    console.log('Using executable path: ' + (process.env.PUPPETEER_EXECUTABLE_PATH || 'bundled'));
    const browser = await puppeteer.launch({
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--no-first-run',
        '--no-zygote',
      ],
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

        const rowHandles = await page.$$(rowSelector);
        let scrapedOnThisPage = 0;

        for (const rowHandle of rowHandles) {
          try {
            // Extract basic info from the row first
            const basicInfo = await page.evaluate((row) => {
              const cells = Array.from(row.querySelectorAll('td'));
              if (cells.length < 4) return null;

              const name = cells[0]?.textContent?.trim() || '';
              const assetClass = cells[1]?.textContent?.trim() || '';
              const industry = cells[2]?.textContent?.trim() || '';
              const region = cells[3]?.textContent?.trim() || '';

              if (name.toLowerCase() === 'company' || name.toLowerCase() === 'name' || !name)
                return null;

              const extraData: Record<string, string> = {};
              if (cells.length > 4) {
                cells.slice(4).forEach((cell, index) => {
                  const text = cell.textContent?.trim();
                  if (text) {
                    extraData[`column_${index + 5}`] = text;
                  }
                });
              }

              return {
                name,
                assetClass: assetClass || 'N/A',
                industry,
                region,
                extraData: Object.keys(extraData).length > 0 ? extraData : undefined,
              };
            }, rowHandle);

            if (!basicInfo) continue;

            // Step A (Click): Click the current row to open flyout
            await page.evaluate((el) => (el as HTMLElement).click(), rowHandle);

            // Step B (Wait for Flyout)
            await page.waitForSelector('.cmp-portfolio-filter__flyout.show', {
              timeout: 3000,
            });

            // Step C (Extract Details)
            const flyoutDetails = await page.evaluate(() => {
              const flyout = document.querySelector('.cmp-portfolio-filter__flyout.show');
              if (!flyout) return null;

              // Description: Select .cmp-portfolio-filter__portfolio-description p and get its innerText
              const descriptionEl = flyout.querySelector(
                '.cmp-portfolio-filter__portfolio-description p',
              );
              const description = descriptionEl
                ? (descriptionEl as HTMLElement).innerText.trim()
                : '';

              // General Details (Website)
              let website = '';
              const generalDetailsDivs = Array.from(
                flyout.querySelectorAll('.cmp-portfolio-filter__general-details > div'),
              );

              generalDetailsDivs.forEach((div) => {
                // Website: Check if the div contains an <a> tag with an href
                const anchor = div.querySelector('a[href]');
                if (anchor) {
                  website = (anchor as HTMLAnchorElement).href;
                }
              });

              // Headquarters: Look for specific selector .cmp-portfolio-filter__flyout-body .sub-desc
              const hqEl = flyout.querySelector('.cmp-portfolio-filter__flyout-body .sub-desc');
              let headquarters = hqEl ? (hqEl as HTMLElement).innerText.trim() : '';

              if (headquarters) {
                // Remove labels like "Headquarters:" or "HQ:"
                headquarters = headquarters.replace(/^(Headquarters|HQ):?\s*/i, '').trim();
              }

              return { headquarters, website, description };
            });

            const finalCompany: PortfolioCompany = {
              ...basicInfo,
              ...(flyoutDetails || {}),
            };

            allCompanies.push(finalCompany);
            scrapedOnThisPage++;

            // Step D (Close Flyout)
            await page.keyboard.press('Escape');
            // Wait for Close
            await page.waitForSelector('cmp-portfolio-filter__flyout-body', {
              hidden: true,
              timeout: 3000,
            });

            // Wait for Table: Optional safety step
            await page
              .waitForSelector('tr[data-search-page-index]', {
                timeout: 1000,
              })
              .catch(() => {});
          } catch (err) {
            const companyName = await rowHandle
              .$eval('td:first-child', (el) => el.textContent?.trim())
              .catch(() => 'Unknown');
            this.logger.warn(
              `Skipping details for ${companyName}: ${
                err instanceof Error ? err.message : String(err)
              }`,
            );

            // Try to close flyout just in case it's stuck open
            await page.keyboard.press('Escape').catch(() => {});
            // Small delay to allow UI to settle
            await new Promise((resolve) => setTimeout(resolve, 500));
          }
        }

        this.logger.log(`Scraped Page ${currentPageIndex} (${scrapedOnThisPage} companies)`);

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
