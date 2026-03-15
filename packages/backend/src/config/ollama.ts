import axios, { AxiosInstance } from 'axios';
import dotenv from 'dotenv';

dotenv.config();

export const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';

const ALLOWED_OLLAMA_MODELS = [
  'minicpm-v:8b',
  'llava:latest',
  'llava:13b',
  'llama3.2-vision:latest',
];

const configuredModel = process.env.OLLAMA_MODEL || 'minicpm-v:8b';
if (!ALLOWED_OLLAMA_MODELS.includes(configuredModel)) {
  console.error(`OLLAMA_MODEL "${configuredModel}" is not in the allowlist: ${ALLOWED_OLLAMA_MODELS.join(', ')}. Exiting.`);
  process.exit(1);
}
export const OLLAMA_MODEL = configuredModel;

export const ollamaClient: AxiosInstance = axios.create({
  baseURL: OLLAMA_BASE_URL,
  timeout: 120000, // 2 minutes for LLM processing
  headers: {
    'Content-Type': 'application/json',
  },
});

export async function testOllamaConnection(): Promise<boolean> {
  try {
    const response = await ollamaClient.get('/api/tags');
    console.log('✅ Ollama connected');
    console.log('Available models:', response.data.models?.map((m: any) => m.name).join(', '));
    return true;
  } catch (error) {
    console.error('❌ Ollama connection failed:', error);
    return false;
  }
}
