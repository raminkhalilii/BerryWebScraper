import { Controller, Get, Redirect } from '@nestjs/common';
import { ApiExcludeEndpoint } from '@nestjs/swagger';

@Controller()
export class AppController {
  // Root endpoint: redirect users to Swagger UI and provide a friendly message when invoked directly
  @ApiExcludeEndpoint()
  @Get()
  @Redirect('/api')
  root(): { message: string } {
    return {
      message:
        'Welcome to the Berry KKR Scraper API. Please visit /api to view the Swagger documentation and interact with the endpoints.',
    };
  }
}
