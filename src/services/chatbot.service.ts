import { GoogleGenerativeAI, SchemaType, Tool } from "@google/generative-ai";
import { config } from "../config/env";
import { HotelService } from "./hotel.service";
import { ChatMessage, ChatResponse } from "../types/chat.types";

export class ChatbotService {
  private genAI: GoogleGenerativeAI;
  private hotelService: HotelService;

  constructor() {
    this.genAI = new GoogleGenerativeAI(config.geminiApiKey);
    this.hotelService = new HotelService();
  }
  private tools: Tool[] = [
    {
      functionDeclarations: [
        {
          name: "check_room_availability",
          description:
            "Check if hotel rooms are available between check-in and check-out dates",
          parameters: {
            type: SchemaType.OBJECT,
            properties: {
              checkIn: {
                type: SchemaType.STRING,
                description: "Check-in date in YYYY-MM-DD format",
              },
              checkOut: {
                type: SchemaType.STRING,
                description: "Check-out date in YYYY-MM-DD format",
              },
              roomType: {
                type: SchemaType.STRING,
                description:
                  "Type of room: executive-view, executive-non-view, family-view, family-non-view, junior-view, or junior-non-view",
              },
            },
            required: ["checkIn", "checkOut", "roomType"],
          },
        },
        {
          name: "calculate_room_price",
          description:
            "Calculate total price for room booking based on dates and room type",
          parameters: {
            type: SchemaType.OBJECT,
            properties: {
              checkIn: {
                type: SchemaType.STRING,
                description: "Check-in date in YYYY-MM-DD format",
              },
              checkOut: {
                type: SchemaType.STRING,
                description: "Check-out date in YYYY-MM-DD format",
              },
              roomType: {
                type: SchemaType.STRING,
                description:
                  "Type of room: executive-view, executive-non-view, family-view, family-non-view, junior-view, or junior-non-view",
              },
            },
            required: ["checkIn", "checkOut", "roomType"],
          },
        },
      ],
    },
  ];

  async chat(message: string, conversationHistory: ChatMessage[] = []): Promise<ChatResponse> {
    try {
        const model = this.genAI.getGenerativeModel({
            model: "gemini-2.5-flash-lite",
            tools: this.tools,
        });
        
        await this.hotelService.initialize();
        const hotelInfo = await this.hotelService.getHotelInfo();
        const isUsingFallback = this.hotelService.isUsingFallback();
        const dataWarning = isUsingFallback
            ? "\n\nIMPORTANT: You are currently using static/cached data. Inform the user that room availability and pricing information might not be up-to-date. Suggest they call the hotel directly to confirm current availability."
            : "";

        // Check if this is a booking-related query WITHOUT dates
        const shouldShowDatePicker = this.shouldTriggerDatePicker(message);
        
        if (shouldShowDatePicker) {
            // User is asking about booking but didn't provide dates
            return {
                reply: "I'd be happy to help you check room availability and prices! \n\n Please provide the Check in check Out date below for accurate information",
                conversationHistory: [
                    ...conversationHistory,
                    { role: "user" as const, content: message },
                    { role: "assistant" as const, content: "I'd be happy to help you check room availability and prices! Please use the date selector below to choose your check-in and check-out dates." }
                ],
                dataSource: hotelInfo.dataSource,
                showDatePicker: true
            };
        }

        // User either provided dates or it's not a booking query
        return await this.processNormalChat(message, conversationHistory, hotelInfo, isUsingFallback, dataWarning, model);

    } catch (error: any) {
        console.error("Gemini API Error:", error);
        throw new Error(`Gemini API Error: ${error.message}`);
    }
}

  private async processNormalChat(
    message: string,
    conversationHistory: ChatMessage[],
    hotelInfo: any,
    isUsingFallback: boolean,
    dataWarning: string,
    model: any,
  ): Promise<ChatResponse> {
    const systemMessage = {
      role: "user" as const,
      parts: [
        {
          text: `You are a helpful booking assistant for ${hotelInfo.name}.           
            Hotel Details:
            - Name: ${hotelInfo.name}
            - Address: ${hotelInfo.address}
            - Phone: ${hotelInfo.phone}
            - Check-in: ${hotelInfo.checkInTime}, Check-out: ${hotelInfo.checkOutTime}
            Available Rooms:
            ${hotelInfo.rooms
              .map(
                (r: any) =>
                  `- ${r.name}: ${r.description} (₹${r.price}/night base price)`,
              )
              .join("\n")}
            Help users check room availability and calculate total prices including GST and service charges. Always ask for check-in date, check-out date, and room type before checking availability or calculating prices. Use YYYY-MM-DD format for dates.${dataWarning}`,
        },
      ],
    };

    const systemResponse = {
      role: "model" as const,
      parts: [
        {
          text: isUsingFallback
            ? `Understood. I will help guests book rooms at ${hotelInfo.name}. Note: I'm currently using cached data, so I'll inform guests that availability and pricing might not be current and suggest they contact the hotel directly at ${hotelInfo.phone} to confirm.`
            : `Understood. I will help guests book rooms at ${hotelInfo.name}, check availability, and provide accurate pricing with all taxes included.`,
        },
      ],
    };

    const history = [
      systemMessage,
      systemResponse,
      ...conversationHistory
        .filter((msg) => msg.role !== "tool" && msg.role !== "system")
        .map((msg) => ({
          role: msg.role === "assistant" ? "model" : "user",
          parts: [{ text: msg.content }],
        })),
    ];

    const chat = model.startChat({
      history,
    });

    let result = await chat.sendMessage(message);
    let response = result.response;

    const functionCalls = response.functionCalls();

    if (functionCalls && functionCalls.length > 0) {
      const functionResponses = [];

      for (const functionCall of functionCalls) {
        const functionName = functionCall.name;
        const args = functionCall.args as Record<string, any>;

        let functionResult: any;

        if (functionName === "check_room_availability") {
          functionResult = await this.hotelService.checkRoomAvailability(
            args["checkIn"] as string,
            args["checkOut"] as string,
            args["roomType"] as string,
          );
        } else if (functionName === "calculate_room_price") {
          functionResult = await this.hotelService.calculateRoomPrice(
            args["checkIn"] as string,
            args["checkOut"] as string,
            args["roomType"] as string,
          );
        }

        functionResponses.push({
          functionResponse: {
            name: functionName,
            response: functionResult,
          },
        });
      }

      result = await chat.sendMessage(functionResponses);
      response = result.response;
    }

    return {
      reply: response.text() || "Sorry, I could not generate a response.",
      conversationHistory: [
        ...conversationHistory,
        { role: "user" as const, content: message },
        { role: "assistant" as const, content: response.text() },
      ],
      dataSource: hotelInfo.dataSource,
    };
  }

  private async processWithDates(
    message: string,
    conversationHistory: ChatMessage[],
    hotelInfo: any,
    isUsingFallback: boolean,
    dataWarning: string,
    model: any,
  ): Promise<ChatResponse> {
    // Extract dates and room type from message
    const dates = this.extractDatesFromMessage(message);
    const roomType = this.extractRoomTypeFromMessage(message);

    // Create a system message that includes the extracted dates
    const systemMessage = {
      role: "user" as const,
      parts: [
        {
          text: `You are a helpful booking assistant for ${hotelInfo.name}.           
            User wants to book from ${dates?.[0] || "check-in date"} to ${dates?.[1] || "check-out date"}.
            Hotel Details:
            - Name: ${hotelInfo.name}
            - Address: ${hotelInfo.address}
            - Phone: ${hotelInfo.phone}
            - Check-in: ${hotelInfo.checkInTime}, Check-out: ${hotelInfo.checkOutTime}
            Available Rooms:
            ${hotelInfo.rooms
              .map(
                (r: any) =>
                  `- ${r.name}: ${r.description} (₹${r.price}/night base price)`,
              )
              .join("\n")}
            ${dataWarning}
            The user has already provided dates. Process their request directly.`,
        },
      ],
    };

    const systemResponse = {
      role: "model" as const,
      parts: [
        {
          text: isUsingFallback
            ? `Understood. I will check availability and pricing for the specified dates. Note: I'm using cached data.`
            : `Understood. I will check availability and pricing for the specified dates.`,
        },
      ],
    };

    const history = [
      systemMessage,
      systemResponse,
      ...conversationHistory
        .filter((msg) => msg.role !== "tool" && msg.role !== "system")
        .map((msg) => ({
          role: msg.role === "assistant" ? "model" : "user",
          parts: [{ text: msg.content }],
        })),
    ];

    const chat = model.startChat({
      history,
    });

    let result = await chat.sendMessage(message);
    let response = result.response;

    const functionCalls = response.functionCalls();

    if (functionCalls && functionCalls.length > 0) {
      const functionResponses = [];

      for (const functionCall of functionCalls) {
        const functionName = functionCall.name;
        const args = functionCall.args as Record<string, any>;

        let functionResult: any;

        if (functionName === "check_room_availability") {
          functionResult = await this.hotelService.checkRoomAvailability(
            args["checkIn"] as string,
            args["checkOut"] as string,
            args["roomType"] as string,
          );
        } else if (functionName === "calculate_room_price") {
          functionResult = await this.hotelService.calculateRoomPrice(
            args["checkIn"] as string,
            args["checkOut"] as string,
            args["roomType"] as string,
          );
        }

        functionResponses.push({
          functionResponse: {
            name: functionName,
            response: functionResult,
          },
        });
      }

      result = await chat.sendMessage(functionResponses);
      response = result.response;
    }

    return {
      reply: response.text() || "Sorry, I could not generate a response.",
      conversationHistory: [
        ...conversationHistory,
        { role: "user" as const, content: message },
        { role: "assistant" as const, content: response.text() },
      ],
      dataSource: hotelInfo.dataSource,
    };
  }

  private shouldTriggerDatePicker(message: string): boolean {
    const lowerMessage = message.toLowerCase();
    
    // First check if dates are already in the message
    if (this.hasDatesInMessage(message)) {
        return false; // Don't show date picker if dates are already provided
    }
    
    const bookingTriggers = [
        'available', 'availability', 'book', 'booking', 'reserve', 'reservation',
        'room price', 'check room', 'room rate', 'cost', 'price for',
        'looking for room', 'need a room', 'want to book', 'planning to stay',
        'stay at', 'accommodation', 'room availability', 'is there room',
        'can i book', 'how much for', 'rates for', 'pricing for'
    ];
    
    // Check if message contains booking-related keywords
    return bookingTriggers.some(trigger => lowerMessage.includes(trigger));
}

private hasDatesInMessage(message: string): boolean {
    const datePattern = /\d{4}-\d{2}-\d{2}/g;
    const dates = message.match(datePattern);
    return dates !== null && dates.length >= 2;
}

  private extractDatesFromMessage(message: string): string[] | null {
    const datePattern = /\d{4}-\d{2}-\d{2}/g;
    const dates = message.match(datePattern);
    return dates;
  }

  // Update the extractRoomTypeFromMessage method
  private extractRoomTypeFromMessage(message: string): string {
    const lowerMessage = message.toLowerCase();

    if (lowerMessage.includes("executive") && lowerMessage.includes("view")) {
      return "executive-view";
    } else if (
      lowerMessage.includes("executive") &&
      lowerMessage.includes("non")
    ) {
      return "executive-non-view";
    } else if (
      lowerMessage.includes("family") &&
      lowerMessage.includes("view")
    ) {
      return "family-view";
    } else if (
      lowerMessage.includes("family") &&
      lowerMessage.includes("non")
    ) {
      return "family-non-view";
    } else if (
      lowerMessage.includes("junior") &&
      lowerMessage.includes("view")
    ) {
      return "junior-view";
    } else if (
      lowerMessage.includes("junior") &&
      lowerMessage.includes("non")
    ) {
      return "junior-non-view";
    } else if (lowerMessage.includes("executive")) {
      return "executive-view"; // Default for executive
    } else if (lowerMessage.includes("family")) {
      return "family-view"; // Default for family
    } else if (lowerMessage.includes("junior")) {
      return "junior-view"; // Default for junior
    } else {
      return "executive-view"; // Default
    }
  }
}
