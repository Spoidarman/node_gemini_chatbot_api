import app from './app';
import { config } from './config/env';
import cron from 'node-cron';
import { ApiService } from './services/api.service';

const PORT = config.port;
const apiService = new ApiService();

// Schedule cache refresh every day at 2 AM
cron.schedule('0 2 * * *', async () => {
  console.log('Running scheduled hotel data refresh...');
  try {
    await apiService.refreshCache();
    console.log('Scheduled refresh completed');
  } catch (error) {
    console.error('Scheduled refresh failed:', error);
  }
});

const server = app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📍 API endpoint: http://localhost:${PORT}/api/chat`);
  console.log(`🏥 Health check: http://localhost:${PORT}/health`);
  console.log(`🔄 Auto-refresh: Daily at 2:00 AM`);
});
