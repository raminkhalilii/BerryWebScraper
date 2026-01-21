# Berry Code Challenge - KKR Portfolio Scraper

## Project Overview
A production-ready NestJS application that scrapes portfolio data from KKR, persists it to MongoDB, and serves it via a REST API.

## Features Checklist
- [x] **Automated Scraper (Puppeteer)**: Robust scraping engine for extracting portfolio data.
- [x] **Data Persistence (MongoDB with Upsert)**: Reliable storage with efficient upsert logic to prevent duplicates.
- [x] **REST API with Filtering (Advanced Solution)**: Flexible API endpoints for data retrieval and on-demand scraping.
- [x] **Dockerized Environment**: Ready for deployment with Docker and Docker Compose.
- [x] **Swagger Documentation**: Interactive API documentation for easy exploration.
- [x] **Unit Tests**: Comprehensive testing suite for core logic.

## Quick Start

### Option A: Docker (Recommended)
1.  **Create `.env` file**: Copy the template from `.env.example`.
    ```bash
    cp .env.example .env
    ```
2.  **Run with Docker Compose**:
    ```bash
    docker-compose up --build
    ```
3.  **Access API**: The API will be available at [http://localhost:3000/api](http://localhost:3000/api).

### Option B: Local Development
1.  **Install dependencies**:
    ```bash
    npm install
    ```
2.  **Ensure MongoDB is running**: Make sure you have a local instance of MongoDB or update the `.env` file with your connection string.
3.  **Start the application**:
    ```bash
    npm run start:dev
    ```

## API Documentation
The API is fully documented using Swagger. Visit [http://localhost:3000/api](http://localhost:3000/api) to interact with the endpoints.

### Endpoints:
- `POST /portfolio/scrape`: Triggers the scraping engine.
- `GET /portfolio`: Retrieves data (supports `?region=` and `?industry=` filters).

## Architecture & Design Decisions
The project follows a modular NestJS architecture. The `ScraperService` encapsulates the scraping logic and is decoupled from the `PortfolioController`. Data is modeled using Mongoose schemas with strict typing.

To ensure high code quality and consistency, the project is configured with:
- **ESLint & Prettier**: For automated code formatting and linting.
- **Husky & lint-staged**: To run linting checks before every commit.

## Testing
To run the unit tests, use the following command:
```bash
npm run test
```
