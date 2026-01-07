// ===============================
// Sentiment Enum (UI Convenience)
// ===============================
export enum CallSentiment {
  POSITIVE = "Positive",
  NEUTRAL = "Neutral",
  NEGATIVE = "Negative",
}

// ===============================
// Data Shape Returned by Backend
// (For GET /calls and GET /calls/{id})
// ===============================
export interface CallFromAPI {
  call_id: string;
  customer_id?: string;
  sentiment?: string;
  emotion?: string;
  summary?: string;
  transcript?: string;
  tags?: string[];
  analysis?: any;  
  created_at?: string;
  excel_path?: string;
  transcript_path?: string;
  analysis_raw?: string;
}

// ===============================
// Data Returned by POST /process-audio
// (AI Processing Pipeline Output)
// ===============================
export interface APIAnalysisResponse {
  call_id: string;
  customer_id?: string;

  transcript: string;
  summary: string;
  sentiment: string;
  emotion: string;

  intents: string[];

  analysis: {
    call_summary?: string;
    customer_intent?: string;
    key_points?: string[];
    intent_detection?: string[];
    sentiment_emotion?: {
      sentiment: string;
      emotion: string;
    };
    action_items?: string[];
    root_cause?: any;
    [k: string]: any;
  };

  qa?: {
    score: number;
    checks: {
      rule: string;
      passed: boolean;
      note?: string;
    }[];
  };

  analysis_raw?: string;

  // Optional backend fields
  excel_path?: string;
  transcript_path?: string;
  created_at?: string;
}


  export interface CallInteraction {
  id: string;
  customerId?: string;
  customerName?: string;
  agentName: string;
  date: string;
  duration: string;
  sentiment: string;
  tags: string[];
  summary: string;
  transcript: string;
  emotion?: string;
  analysis?: any;
  converted?: boolean;
}

// ===============================
// Analytics View Type
// ===============================
export interface AnalyticsData {
  totalCalls: number;
  connectionRate: number;
  avgDuration: string;
  conversionRate: number;
  volumeData: { name: string; calls: number }[];
}

// ===============================
// View Routing
// ===============================
export type ViewState = "HOME" | "ANALYTICS" | "CALL_DETAIL";
