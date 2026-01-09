import { Router } from 'express';
import { handleChat, refreshHotelData } from '../controllers/chat.controller';

const router = Router();

router.post('/chat', handleChat);
router.post('/refresh-hotel-data', refreshHotelData);

router.get('/chat', (req, res) => {
  res.json({ 
    message: 'Chat endpoint is working. Use POST method to send messages.',
    example: {
      method: 'POST',
      url: '/api/chat',
      body: { message: 'Hello' }
    }
  });
});

export default router;
