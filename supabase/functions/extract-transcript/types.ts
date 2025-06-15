
export interface CaptionTrack {
  baseUrl: string;
  languageCode: string;
  name: string;
  kind: string;
}

export interface TranscriptResult {
  success: boolean;
  videoTitle?: string;
  transcript?: string;
  captionsAvailable?: boolean;
  transcriptionMethod?: string;
  error?: string;
  suggestion?: string;
}

export const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

export const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
