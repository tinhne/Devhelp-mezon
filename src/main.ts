import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { BotGateway } from './bot/events/bot.gateways';
import { Logger } from '@nestjs/common';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  
  try {
    // Enable all log levels for more detailed debugging
    const app = await NestFactory.create(AppModule, {
      logger: ['error', 'warn', 'log', 'debug', 'verbose'],
    });
    
    // Thêm middleware bắt lỗi toàn cục
    app.use((err, req, res, next) => {
      logger.error(`Global error handler: ${err.message}`, err.stack);
      res.status(500).json({
        error: 'Internal server error',
        message: err.message,
      });
    });
    
    const port = process.env.PORT || 4000;
    await app.listen(port);
    logger.log(`Application started on port ${port}`);
    
    // Khởi tạo bot gateway sau khi app đã khởi động xong
    try {
      const bot = app.get(BotGateway);
      await bot.initEvent();
      logger.log('Bot gateway initialization completed');
      
      // Thêm kiểm tra định kỳ để đảm bảo bot vẫn hoạt động
      setInterval(async () => {
        try {
          const botStatus = bot.getBotStatus();
          if (botStatus.state !== 'active') {
            logger.warn(`Bot not active, current state: ${botStatus.state}. Attempting to reset...`);
            await bot.resetBot();
          }
        } catch (error) {
          logger.error(`Error in bot status check: ${error.message}`);
        }
      }, 15 * 60 * 1000); // 15 phút
    } catch (botError) {
      logger.error(`Error initializing bot gateway: ${botError.message}`, botError.stack);
      // Thử lại sau 10 giây nếu khởi tạo thất bại
      setTimeout(async () => {
        try {
          logger.log('Retrying bot gateway initialization...');
          const bot = app.get(BotGateway);
          await bot.initEvent();
          logger.log('Bot gateway initialization succeeded on retry');
        } catch (retryError) {
          logger.error(`Retry failed: ${retryError.message}`);
        }
      }, 10000);
    }
  } catch (error) {
    logger.error(`Error during bootstrap: ${error.message}`, error.stack);
    process.exit(1);
  }
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  const logger = new Logger('UnhandledRejection');
  logger.error(`Unhandled Rejection at: ${promise}, reason: ${reason}`);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  const logger = new Logger('UncaughtException');
  logger.error(`Uncaught Exception: ${error.message}`, error.stack);
  // Không terminate process để tránh restart liên tục
});

bootstrap();