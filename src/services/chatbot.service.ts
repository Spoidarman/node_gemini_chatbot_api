import { GoogleGenerativeAI, SchemaType, Tool } from "@google/generative-ai";
import { config } from "../config/env";
import { HotelService } from "./hotel.service";
import { ChatMessage } from "../types/chat.types";

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
                description: "Type of room: deluxe, executive, or suite",
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
                description: "Type of room: deluxe, executive, or suite",
              },
            },
            required: ["checkIn", "checkOut", "roomType"],
          },
        },
      ],
    },
  ];

  async chat(message: string, conversationHistory: ChatMessage[] = []) {
    try {
      const model = this.genAI.getGenerativeModel({
        model: "gemini-2.5-flash-lite",
        tools: this.tools,
      });
      const hotelInfo = await this.hotelService.getHotelInfo();
      const isUsingFallback = this.hotelService.isUsingFallback();
      const dataWarning = isUsingFallback
        ? "\n\nIMPORTANT: You are currently using static/cached data. Inform the user that room availability and pricing information might not be up-to-date. Suggest they call the hotel directly to confirm current availability."
        : "";

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
                  (r: any) => `- ${r.name}: ${r.description} (₹${r.price}/night base price)`
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
              args["roomType"] as string
            );
          } else if (functionName === "calculate_room_price") {
            functionResult = await this.hotelService.calculateRoomPrice(
              args["checkIn"] as string,
              args["checkOut"] as string,
              args["roomType"] as string
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
        dataSource: hotelInfo.dataSource, // Include data source in response
      };
    } catch (error: any) {
      console.error("Gemini API Error:", error);
      throw new Error(`Gemini API Error: ${error.message}`);
    }
  }
}
