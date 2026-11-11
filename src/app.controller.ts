import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

@ApiTags('Health')
@Controller()
export class AppController {
  @Get('health')
  @ApiOperation({ summary: 'Target group / NLB health check endpoint' })
  getHealth() {
    return {
      status: 'UP',
      service: 'clouddrop-backend',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('api/health')
  @ApiOperation({ summary: 'API specific health check endpoint' })
  getApiHealth() {
    return {
      status: 'UP',
      service: 'clouddrop-backend',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    };
  }
}

