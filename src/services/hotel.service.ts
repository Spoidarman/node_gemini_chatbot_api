import { RoomAvailability, PriceCalculation, RoomType } from '../types/chat.types';
import { ApiService } from './api.service';

export class HotelService {
  private apiService: ApiService;
  private hotelData: any = null;
  private dataSource: 'api' | 'cache' | 'fallback' = 'fallback';

  constructor() {
    this.apiService = new ApiService();
  }

  async initialize() {
    if (!this.hotelData) {
      const result = await this.apiService.getHotelData();
      this.hotelData = result.data.hotel || result.data;
      this.dataSource = result.source;
    }
  }

  private async ensureDataLoaded() {
    if (!this.hotelData) {
      await this.initialize();
    }
  }

  getDataSource(): string {
    return this.dataSource;
  }

  isUsingFallback(): boolean {
    return this.dataSource === 'fallback';
  }

  async checkRoomAvailability(
    checkIn: string,
    checkOut: string,
    roomType: string
  ): Promise<RoomAvailability> {
    await this.ensureDataLoaded();
    
    const room = this.findRoomByType(roomType);
    
    if (!room) {
      return {
        available: false,
        roomType,
        roomName: 'Unknown',
        pricePerNight: 0,
        totalPriceWithTaxes: 0
      };
    }

    const isAvailable = this.checkDateRangeAvailability(checkIn, checkOut, room);
    const availableCount = this.getAvailableRoomCount(checkIn, room);

    return {
      available: isAvailable,
      roomType,
      roomName: room.room_name,
      pricePerNight: room.pricing.base_price_per_night,
      totalPriceWithTaxes: room.pricing.total_price_estimate,
      availableRooms: availableCount
    };
  }

  async calculateRoomPrice(
    checkIn: string,
    checkOut: string,
    roomType: string
  ): Promise<PriceCalculation> {
    await this.ensureDataLoaded();
    
    const room = this.findRoomByType(roomType);
    
    if (!room) {
      return {
        nights: 0,
        basePrice: 0,
        gst: 0,
        serviceCharge: 0,
        totalPrice: 0,
        checkIn,
        checkOut,
        roomName: 'Unknown'
      };
    }

    const startDate = new Date(checkIn);
    const endDate = new Date(checkOut);
    const nights = Math.ceil(
      (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    const basePrice = room.pricing.base_price_per_night * nights;
    const gstAmount = (basePrice * room.pricing.taxes.gst_percentage) / 100;
    const serviceChargeAmount = (basePrice * room.pricing.taxes.service_charge_percentage) / 100;
    const totalPrice = basePrice + gstAmount + serviceChargeAmount;

    return {
      nights,
      basePrice,
      gst: gstAmount,
      serviceCharge: serviceChargeAmount,
      totalPrice: Math.round(totalPrice),
      checkIn,
      checkOut,
      roomName: room.room_name
    };
  }

  async getHotelInfo() {
    await this.ensureDataLoaded();
    
    return {
      name: this.hotelData.hotel_name,
      address: `${this.hotelData.location.address.line1}, ${this.hotelData.location.address.city}`,
      phone: this.hotelData.contact.phone,
      checkInTime: this.hotelData.checkin_checkout.check_in_time,
      checkOutTime: this.hotelData.checkin_checkout.check_out_time,
      rooms: this.hotelData.rooms.map((r: any) => ({
        name: r.room_name,
        description: r.description,
        price: r.pricing.base_price_per_night
      })),
      dataSource: this.dataSource
    };
  }

 // Update the findRoomByType method in HotelService
private findRoomByType(roomType: string): RoomType | undefined {
  const type = roomType.toLowerCase();
  
  // Map UI room types to data room types
  const roomTypeMapping: Record<string, string> = {
    'executive-view': 'EXEC_VIEW_001',
    'executive-non-view': 'EXEC_NON_002',
    'family-view': 'FAM_VIEW_003',
    'family-non-view': 'FAM_NON_004',
    'junior-view': 'JUNIOR_VIEW_005',
    'junior-non-view': 'JUNIOR_NON_006'
  };
  
  // Check for exact match from UI
  if (roomTypeMapping[roomType]) {
    return this.hotelData.rooms.find((r: any) => r.room_type_id === roomTypeMapping[roomType]);
  }
  
  // Fallback to keyword matching
  if (type.includes('executive') && type.includes('view')) {
    return this.hotelData.rooms.find((r: any) => r.room_type_id === 'EXEC_VIEW_001');
  }
  
  if (type.includes('executive') && type.includes('non')) {
    return this.hotelData.rooms.find((r: any) => r.room_type_id === 'EXEC_NON_002');
  }
  
  if (type.includes('family') && type.includes('view')) {
    return this.hotelData.rooms.find((r: any) => r.room_type_id === 'FAM_VIEW_003');
  }
  
  if (type.includes('family') && type.includes('non')) {
    return this.hotelData.rooms.find((r: any) => r.room_type_id === 'FAM_NON_004');
  }
  
  if (type.includes('junior') && type.includes('view')) {
    return this.hotelData.rooms.find((r: any) => r.room_type_id === 'JUNIOR_VIEW_005');
  }
  
  if (type.includes('junior') && type.includes('non')) {
    return this.hotelData.rooms.find((r: any) => r.room_type_id === 'JUNIOR_NON_006');
  }
  
  if (type.includes('executive')) {
    return this.hotelData.rooms.find((r: any) => r.room_type_id === 'EXEC_VIEW_001');
  }
  
  if (type.includes('family')) {
    return this.hotelData.rooms.find((r: any) => r.room_type_id === 'FAM_NON_004');
  }
  
  if (type.includes('junior')) {
    return this.hotelData.rooms.find((r: any) => r.room_type_id === 'JUNIOR_NON_006');
  }
  
  // Default to first room
  return this.hotelData.rooms[0];
}

  private checkDateRangeAvailability(
    checkIn: string,
    checkOut: string,
    room: RoomType
  ): boolean {
    const startDate = new Date(checkIn);
    const endDate = new Date(checkOut);
    
    for (const avail of room.availability) {
      const availDate = new Date(avail.date);
      if (availDate >= startDate && availDate < endDate) {
        if (avail.available_rooms === 0) {
          return false;
        }
      }
    }
    
    return true;
  }

  private getAvailableRoomCount(checkIn: string, room: RoomType): number {
    const availability = room.availability.find(a => a.date === checkIn);
    return availability ? availability.available_rooms : 5;
  }
}
