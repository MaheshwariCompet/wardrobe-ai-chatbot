export interface OutfitCard {
  record_id?: string;
  top?: string | null;
  bottom?: string | null;
  shoes?: string | null;
  layer?: string | null;
  season?: string | null;
  overall_score?: number | string | null;
  comfort_rating?: number | string | null;
  heat_score?: number | string | null;
  ac_score?: number | string | null;
  rain_score?: number | string | null;
  primary_cause?: string | null;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  engine: string;
  text: string;
  cards?: OutfitCard[];
  bullets?: string[];
}