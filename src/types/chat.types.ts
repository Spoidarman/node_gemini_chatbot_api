export interface ChatMessage {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  tool_call_id?: string;
  tool_calls?: any[];
}

export interface ChatRequest {
  message: string;
  conversationHistory?: ChatMessage[];
}

export interface ChatResponse {
  reply: string;
  conversationHistory: ChatMessage[];
}

export interface RoomAvailability {
  available: boolean;
  roomType: string;
  roomName: string;
  pricePerNight: number;
  totalPriceWithTaxes: number;
  availableRooms?: number;
}

export interface PriceCalculation {
  nights: number;
  basePrice: number;
  gst: number;
  serviceCharge: number;
  totalPrice: number;
  checkIn: string;
  checkOut: string;
  roomName: string;
}

export interface RoomType {
  room_type_id: string;
  room_name: string;
  description: string;
  bed_type: string;
  max_occupancy: {
    adults: number;
    children: number;
  };
  room_size_sqft: number;
  amenities: string[];
  pricing: {
    currency: string;
    base_price_per_night: number;
    taxes: {
      gst_percentage: number;
      service_charge_percentage: number;
    };
    total_price_estimate: number;
  };
  availability: Array<{
    date: string;
    available_rooms: number;
    status: string;
  }>;
}

export interface ChatResponse {
  reply: string;
  conversationHistory: ChatMessage[];
  dataSource?: 'api' | 'cache' | 'fallback';
}
