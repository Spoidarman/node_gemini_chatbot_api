import { Request, Response } from 'express';
import { ChatbotService } from '../services/chatbot.service';
import { ApiService } from '../services/api.service';
import { ChatRequest } from '../types/chat.types';

const chatbotService = new ChatbotService();
const apiService = new ApiService();

export const handleChat = async (req: Request, res: Response) => {
  try {
    const { message, conversationHistory = [] }: ChatRequest = req.body;

    if (!message || message.trim() === '') {
      return res.status(400).json({
        error: 'Message is required'
      });
    }

    const result = await chatbotService.chat(message, conversationHistory);

    res.json(result);
  } catch (error: any) {
    console.error('Chat error:', error);
    res.status(500).json({
      error: 'Failed to process chat message',
      details: error.message
    });
  }
};

export const refreshHotelData = async (req: Request, res: Response) => {
  try {
    await apiService.refreshCache();
    res.json({ message: 'Hotel data refreshed successfully' });
  } catch (error: any) {
    console.error('Refresh error:', error);
    res.status(500).json({
      error: 'Failed to refresh hotel data',
      details: error.message
    });
  }
};
