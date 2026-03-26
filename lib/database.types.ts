// Auto-generated types from Supabase schema.
// Regenerate with: npx supabase gen types typescript --project-id YOUR_PROJECT_ID > lib/database.types.ts

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          full_name: string;
          email: string;
          personal_address_id: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          full_name?: string;
          email?: string;
          personal_address_id?: string | null;
          created_at?: string;
        };
        Update: {
          full_name?: string;
          email?: string;
          personal_address_id?: string | null;
        };
      };
      addresses: {
        Row: {
          id: string;
          user_id: string;
          label: string;
          full_name: string;
          line1: string;
          line2: string | null;
          city: string;
          state: string;
          zip: string;
          country: string;
          lob_verified: boolean;
          is_personal: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          label?: string;
          full_name: string;
          line1: string;
          line2?: string | null;
          city: string;
          state: string;
          zip: string;
          country?: string;
          lob_verified?: boolean;
          is_personal?: boolean;
          created_at?: string;
        };
        Update: {
          label?: string;
          full_name?: string;
          line1?: string;
          line2?: string | null;
          city?: string;
          state?: string;
          zip?: string;
          country?: string;
          lob_verified?: boolean;
          is_personal?: boolean;
        };
      };
      postcards: {
        Row: {
          id: string;
          user_id: string;
          message: string;
          frame: string;
          filter: string;
          from_address_id: string | null;
          to_address_id: string | null;
          recipient_snapshot: Json;
          status: 'pending' | 'paid' | 'submitted' | 'mailed' | 'failed';
          lob_id: string | null;
          stripe_payment_intent_id: string | null;
          price_cents: number;
          created_at: string;
          mailed_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          message?: string;
          frame?: string;
          filter?: string;
          from_address_id?: string | null;
          to_address_id?: string | null;
          recipient_snapshot?: Json;
          status?: 'pending' | 'paid' | 'submitted' | 'mailed' | 'failed';
          lob_id?: string | null;
          stripe_payment_intent_id?: string | null;
          price_cents?: number;
          created_at?: string;
          mailed_at?: string | null;
        };
        Update: {
          status?: 'pending' | 'paid' | 'submitted' | 'mailed' | 'failed';
          lob_id?: string | null;
          stripe_payment_intent_id?: string | null;
          mailed_at?: string | null;
        };
      };
      orders: {
        Row: {
          id: string;
          user_id: string;
          postcard_id: string;
          stripe_payment_intent_id: string;
          amount_cents: number;
          status: 'pending' | 'succeeded' | 'failed';
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          postcard_id: string;
          stripe_payment_intent_id: string;
          amount_cents: number;
          status?: 'pending' | 'succeeded' | 'failed';
          created_at?: string;
        };
        Update: {
          status?: 'pending' | 'succeeded' | 'failed';
        };
      };
    };
  };
}

// Convenience row types
export type Profile = Database['public']['Tables']['profiles']['Row'];
export type Address = Database['public']['Tables']['addresses']['Row'];
export type Postcard = Database['public']['Tables']['postcards']['Row'];
export type Order = Database['public']['Tables']['orders']['Row'];
