// Auto-generated types from Supabase schema.
// Regenerate with: npx supabase gen types typescript --project-id YOUR_PROJECT_ID > lib/database.types.ts

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      app_version_policy: {
        Relationships: [];
        Row: {
          platform: 'ios' | 'android';
          minimum_version: string;
          latest_version: string;
          minimum_build_number: number;
          latest_build_number: number;
          message: string;
          store_url: string;
          updated_at: string;
        };
        Insert: {
          platform: 'ios' | 'android';
          minimum_version: string;
          latest_version: string;
          minimum_build_number: number;
          latest_build_number: number;
          message?: string;
          store_url: string;
          updated_at?: string;
        };
        Update: {
          minimum_version?: string;
          latest_version?: string;
          minimum_build_number?: number;
          latest_build_number?: number;
          message?: string;
          store_url?: string;
          updated_at?: string;
        };
      };
      store_release_observations: {
        Relationships: [];
        Row: {
          platform: 'ios' | 'android';
          candidate_version: string | null;
          candidate_build_number: number | null;
          first_observed_at: string | null;
          last_observed_at: string | null;
          observation_count: number;
          enforced_at: string | null;
          checked_at: string | null;
          last_error: string | null;
          last_alerted_at: string | null;
          consecutive_error_count: number;
        };
        Insert: {
          platform: 'ios' | 'android';
          candidate_version?: string | null;
          candidate_build_number?: number | null;
          first_observed_at?: string | null;
          last_observed_at?: string | null;
          observation_count?: number;
          enforced_at?: string | null;
          checked_at?: string | null;
          last_error?: string | null;
          last_alerted_at?: string | null;
          consecutive_error_count?: number;
        };
        Update: {
          candidate_version?: string | null;
          candidate_build_number?: number | null;
          first_observed_at?: string | null;
          last_observed_at?: string | null;
          observation_count?: number;
          enforced_at?: string | null;
          checked_at?: string | null;
          last_error?: string | null;
          last_alerted_at?: string | null;
          consecutive_error_count?: number;
        };
      };
      eu_uk_order_ledger: {
        Relationships: [];
        Row: {
          id: string;
          stripe_payment_intent_id: string;
          stripe_tax_transaction_id: string | null;
          user_id: string | null;
          billing_country: string;
          destination_country: string;
          currency: string;
          base_amount_cents: number;
          tax_amount_cents: number;
          gross_amount_cents: number;
          livemode: boolean;
          paid_at: string;
          order_date: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          stripe_payment_intent_id: string;
          stripe_tax_transaction_id?: string | null;
          user_id?: string | null;
          billing_country: string;
          destination_country: string;
          currency: string;
          base_amount_cents: number;
          tax_amount_cents: number;
          gross_amount_cents: number;
          livemode: boolean;
          paid_at: string;
          order_date: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          stripe_tax_transaction_id?: string | null;
          user_id?: string | null;
          billing_country?: string;
          destination_country?: string;
          currency?: string;
          base_amount_cents?: number;
          tax_amount_cents?: number;
          gross_amount_cents?: number;
          livemode?: boolean;
          paid_at?: string;
          order_date?: string;
          updated_at?: string;
        };
      };
      eu_uk_order_refunds: {
        Relationships: [];
        Row: {
          stripe_refund_id: string;
          stripe_payment_intent_id: string;
          amount_cents: number;
          currency: string;
          status: string;
          livemode: boolean;
          refunded_at: string;
          refund_date: string;
          created_at: string;
        };
        Insert: {
          stripe_refund_id: string;
          stripe_payment_intent_id: string;
          amount_cents: number;
          currency: string;
          status: string;
          livemode: boolean;
          refunded_at: string;
          refund_date: string;
          created_at?: string;
        };
        Update: {
          amount_cents?: number;
          currency?: string;
          status?: string;
          livemode?: boolean;
          refunded_at?: string;
          refund_date?: string;
        };
      };
      profiles: {
        Relationships: [];
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
        Relationships: [];
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
        Relationships: [];
        Row: {
          id: string;
          user_id: string;
          message: string;
          frame: string;
          filter: string;
          location: string | null;
          from_address_id: string | null;
          to_address_id: string | null;
          recipient_snapshot: Json;
          status: 'pending' | 'paid' | 'submitted' | 'mailed' | 'in_transit' | 'processed_for_delivery' | 'delivered' | 'failed';
          lob_id: string | null;
          lob_front_url: string | null;
          lob_back_url: string | null;
          stripe_payment_intent_id: string | null;
          price_cents: number;
          created_at: string;
          mailed_at: string | null;
          delivered_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          message?: string;
          frame?: string;
          filter?: string;
          location?: string | null;
          from_address_id?: string | null;
          to_address_id?: string | null;
          recipient_snapshot?: Json;
          status?: 'pending' | 'paid' | 'submitted' | 'mailed' | 'in_transit' | 'processed_for_delivery' | 'delivered' | 'failed';
          lob_id?: string | null;
          lob_front_url?: string | null;
          lob_back_url?: string | null;
          stripe_payment_intent_id?: string | null;
          price_cents?: number;
          created_at?: string;
          mailed_at?: string | null;
          delivered_at?: string | null;
        };
        Update: {
          status?: 'pending' | 'paid' | 'submitted' | 'mailed' | 'in_transit' | 'processed_for_delivery' | 'delivered' | 'failed';
          lob_id?: string | null;
          stripe_payment_intent_id?: string | null;
          mailed_at?: string | null;
          delivered_at?: string | null;
        };
      };
      orders: {
        Relationships: [];
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
    Views: {
      eu_uk_orders_by_country_date: {
        Relationships: [];
        Row: {
          billing_country: string | null;
          order_date: string | null;
          order_count: number | null;
          base_amount_cents: number | null;
          tax_amount_cents: number | null;
          gross_amount_cents: number | null;
          refunded_amount_cents: number | null;
          net_amount_cents: number | null;
        };
      };
    };
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

// Convenience row types
export type Profile = Database['public']['Tables']['profiles']['Row'];
export type AppVersionPolicy = Database['public']['Tables']['app_version_policy']['Row'];
export type EuUkOrderLedger = Database['public']['Tables']['eu_uk_order_ledger']['Row'];
export type EuUkOrderRefund = Database['public']['Tables']['eu_uk_order_refunds']['Row'];
export type Address = Database['public']['Tables']['addresses']['Row'];
export type Postcard = Database['public']['Tables']['postcards']['Row'];
export type Order = Database['public']['Tables']['orders']['Row'];
