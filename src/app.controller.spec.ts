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

  describe('health check endpoints', () => {
    it('getHealth() should return UP status for NLB target group', () => {
      const response = appController.getHealth();
      expect(response.status).toBe('UP');
      expect(response.service).toBe('clouddrop-backend');
      expect(response.timestamp).toBeDefined();
    });

    it('getApiHealth() should return API health with uptime', () => {
      const response = appController.getApiHealth();
      expect(response.status).toBe('UP');
      expect(response.service).toBe('clouddrop-backend');
      expect(response.uptime).toBeGreaterThanOrEqual(0);
    });
  });
});

