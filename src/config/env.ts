// import dotenv from 'dotenv';

// dotenv.config();

// export const config = {
//   openaiApiKey: process.env.OPENAI_API_KEY!,
//   port: process.env.PORT || 3000,
//   nodeEnv: process.env.NODE_ENV || 'development'
// };

// if (!config.openaiApiKey) {
//   throw new Error('OPENAI_API_KEY is required in .env file');
// }


import dotenv from 'dotenv';

dotenv.config();

export const config = {
  geminiApiKey: process.env.GEMINI_API_KEY!,
  port: process.env.PORT || 3000,
  nodeEnv: process.env.NODE_ENV || 'development'
};

if (!config.geminiApiKey) {
  throw new Error('GEMINI_API_KEY is required in .env file');
}
