// TypeScript types for Supabase database
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string
          full_name: string | null
          avatar_url: string | null
          company: string | null
          industry: string | null
          oauth_provider: string | null
          oauth_provider_id: string | null
          is_active: boolean | null
          deleted_at: string | null
          deletion_scheduled_at: string | null
          chargebee_customer_id: string | null
          chargebee_customer_synced_at: string | null
          created_at: string | null
          updated_at: string | null
        }
      }
      security_events: {
        Row: {
          id: string
          event_type: string
          severity: string
          user_id: string | null
          ip_address: string | null
          user_agent: string | null
          details: Json | null
          created_at: string | null
        }
      }
    }
  }
}

export type Profile = Database['public']['Tables']['profiles']['Row']
export type SecurityEvent = Database['public']['Tables']['security_events']['Row']
