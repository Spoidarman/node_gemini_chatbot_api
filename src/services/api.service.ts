import axios from 'axios';
import fs from 'fs/promises';
import path from 'path';

export class ApiService {
  private apiUrl: string;
  private cacheFilePath: string;
  private fallbackFilePath: string;
  private cacheDuration: number = 24 * 60 * 60 * 1000;

  constructor() {
    this.apiUrl = process.env.HOTEL_API_URL || 'https://api.example.com/hotel-data';
    this.cacheFilePath = path.join(__dirname, '../data/hotel-data-cache.json');
    this.fallbackFilePath = path.join(__dirname, '../data/hotel-data-fallback.json');
  }

  async getHotelData(): Promise<{ data: any; source: 'api' | 'cache' | 'fallback' }> {
    try {
      // Try to get cached data first
      const cachedData = await this.getCachedData();
      if (cachedData) {
        console.log('✓ Using cached hotel data');
        return { data: cachedData, source: 'cache' };
      }

      // Try to fetch from API
      console.log('→ Fetching fresh hotel data from API...');
      const freshData = await this.fetchFromApi();
      await this.saveCacheData(freshData);
      console.log('✓ Fresh data fetched from API');
      return { data: freshData, source: 'api' };
      
    } catch (error: any) {
      console.error('✗ Error fetching hotel data:', error.message);
      
      // Try expired cache as fallback
      const expiredCache = await this.getCachedData(true);
      if (expiredCache) {
        console.log('⚠ Using expired cache as fallback');
        return { data: expiredCache, source: 'cache' };
      }
      
      // Last resort: use static fallback
      console.log('⚠ Using static fallback data');
      const fallbackData = await this.getFallbackData();
      return { data: fallbackData, source: 'fallback' };
    }
  }

  private async fetchFromApi() {
    const response = await axios.get(this.apiUrl, {
      timeout: 10000,
      headers: {
        'Authorization': `Bearer ${process.env.API_TOKEN || ''}`,
        'Content-Type': 'application/json'
      }
    });
    
    return response.data;
  }

  private async getCachedData(ignoreExpiry: boolean = false): Promise<any | null> {
    try {
      const stats = await fs.stat(this.cacheFilePath);
      const now = Date.now();
      const fileAge = now - stats.mtimeMs;

      if (!ignoreExpiry && fileAge > this.cacheDuration) {
        console.log('⏰ Cache expired');
        return null;
      }

      const data = await fs.readFile(this.cacheFilePath, 'utf-8');
      const parsed = JSON.parse(data);
      return parsed.data;
    } catch (error) {
      return null;
    }
  }

  private async getFallbackData(): Promise<any> {
    try {
      const data = await fs.readFile(this.fallbackFilePath, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      throw new Error('Static fallback data not found. Please ensure hotel-data-fallback.json exists.');
    }
  }

  private async saveCacheData(data: any) {
    const dir = path.dirname(this.cacheFilePath);
    await fs.mkdir(dir, { recursive: true });
    
    const cacheData = {
      timestamp: Date.now(),
      data
    };
    
    await fs.writeFile(
      this.cacheFilePath,
      JSON.stringify(cacheData, null, 2),
      'utf-8'
    );
    
    console.log('✓ Hotel data cached successfully');
  }

  async refreshCache() {
    console.log('🔄 Force refreshing hotel data...');
    try {
      const freshData = await this.fetchFromApi();
      await this.saveCacheData(freshData);
      console.log('✓ Cache refreshed successfully');
      return { data: freshData, source: 'api' as const };
    } catch (error: any) {
      console.error('✗ Refresh failed:', error.message);
      console.log('⚠ Using static fallback');
      const fallbackData = await this.getFallbackData();
      return { data: fallbackData, source: 'fallback' as const };
    }
  }
}
