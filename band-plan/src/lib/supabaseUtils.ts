import { toast } from 'react-hot-toast';

const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second

export async function safeSupabaseRequest<T>(
  requestFn: () => Promise<{ data: T | null; error: any }>,
  errorMessage: string = 'An error occurred'
): Promise<T | null> {
  let retries = 0;
  
  while (retries < MAX_RETRIES) {
    try {
      const { data, error } = await requestFn();
      
      if (error) {
        throw error;
      }
      
      return data;
    } catch (error: any) {
      retries++;
      
      if (retries === MAX_RETRIES) {
        console.error(errorMessage, error);
        toast.error(errorMessage);
        return null;
      }
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * retries));
    }
  }
  
  return null;
}