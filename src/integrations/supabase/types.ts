export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      api_keys: {
        Row: {
          created_at: string
          id: string
          key_hash: string
          key_prefix: string
          last_used_at: string | null
          name: string
          revoked_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          key_hash: string
          key_prefix: string
          last_used_at?: string | null
          name: string
          revoked_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          key_hash?: string
          key_prefix?: string
          last_used_at?: string | null
          name?: string
          revoked_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      credit_ledger: {
        Row: {
          balance_after: number | null
          created_at: string
          delta: number
          id: string
          reason: string
          stripe_event_id: string | null
          user_id: string
        }
        Insert: {
          balance_after?: number | null
          created_at?: string
          delta: number
          id?: string
          reason: string
          stripe_event_id?: string | null
          user_id: string
        }
        Update: {
          balance_after?: number | null
          created_at?: string
          delta?: number
          id?: string
          reason?: string
          stripe_event_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      entitlements: {
        Row: {
          cancel_at_period_end: boolean
          created_at: string
          credits_balance: number
          current_period_end: string | null
          current_period_start: string | null
          featured_slots: number
          monthly_run_quota: number
          price_id: string | null
          private_skills: boolean
          starter_credits_granted: boolean
          status: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          tier: string
          updated_at: string
          user_id: string
        }
        Insert: {
          cancel_at_period_end?: boolean
          created_at?: string
          credits_balance?: number
          current_period_end?: string | null
          current_period_start?: string | null
          featured_slots?: number
          monthly_run_quota?: number
          price_id?: string | null
          private_skills?: boolean
          starter_credits_granted?: boolean
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          tier?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          cancel_at_period_end?: boolean
          created_at?: string
          credits_balance?: number
          current_period_end?: string | null
          current_period_start?: string | null
          featured_slots?: number
          monthly_run_quota?: number
          price_id?: string | null
          private_skills?: boolean
          starter_credits_granted?: boolean
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          tier?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      footer_link_events: {
        Row: {
          created_at: string
          href: string
          id: string
          label: string
          path: string | null
          section: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          href: string
          id?: string
          label: string
          path?: string | null
          section?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          href?: string
          id?: string
          label?: string
          path?: string | null
          section?: string
          user_id?: string | null
        }
        Relationships: []
      }
      invoices: {
        Row: {
          amount_due: number
          amount_paid: number
          created_at: string
          currency: string
          hosted_invoice_url: string | null
          id: string
          invoice_pdf: string | null
          number: string | null
          period_end: string | null
          period_start: string | null
          status: string
          stripe_invoice_id: string
          user_id: string
        }
        Insert: {
          amount_due?: number
          amount_paid?: number
          created_at?: string
          currency?: string
          hosted_invoice_url?: string | null
          id?: string
          invoice_pdf?: string | null
          number?: string | null
          period_end?: string | null
          period_start?: string | null
          status?: string
          stripe_invoice_id: string
          user_id: string
        }
        Update: {
          amount_due?: number
          amount_paid?: number
          created_at?: string
          currency?: string
          hosted_invoice_url?: string | null
          id?: string
          invoice_pdf?: string | null
          number?: string | null
          period_end?: string | null
          period_start?: string | null
          status?: string
          stripe_invoice_id?: string
          user_id?: string
        }
        Relationships: []
      }
      mcp_runs: {
        Row: {
          api_key_id: string | null
          created_at: string
          credits_used: number
          duration_ms: number
          error: string | null
          id: string
          mode: string
          skill_slug: string
          status: string
          tool_call: string | null
          user_id: string | null
        }
        Insert: {
          api_key_id?: string | null
          created_at?: string
          credits_used?: number
          duration_ms?: number
          error?: string | null
          id?: string
          mode?: string
          skill_slug: string
          status?: string
          tool_call?: string | null
          user_id?: string | null
        }
        Update: {
          api_key_id?: string | null
          created_at?: string
          credits_used?: number
          duration_ms?: number
          error?: string | null
          id?: string
          mode?: string
          skill_slug?: string
          status?: string
          tool_call?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mcp_runs_api_key_id_fkey"
            columns: ["api_key_id"]
            isOneToOne: false
            referencedRelation: "api_keys"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_events: {
        Row: {
          created_at: string
          environment: string
          id: string
          stripe_event_id: string
          type: string
        }
        Insert: {
          created_at?: string
          environment?: string
          id?: string
          stripe_event_id: string
          type: string
        }
        Update: {
          created_at?: string
          environment?: string
          id?: string
          stripe_event_id?: string
          type?: string
        }
        Relationships: []
      }
      publisher_verifications: {
        Row: {
          badge: string
          contact_email: string
          created_at: string
          evidence_url: string | null
          id: string
          notes: string | null
          org: string
          reviewed_at: string | null
          reviewed_by: string | null
          reviewer_notes: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          badge?: string
          contact_email: string
          created_at?: string
          evidence_url?: string | null
          id?: string
          notes?: string | null
          org: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          reviewer_notes?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          badge?: string
          contact_email?: string
          created_at?: string
          evidence_url?: string | null
          id?: string
          notes?: string | null
          org?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          reviewer_notes?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      registry_sources: {
        Row: {
          auto_sync_enabled: boolean
          branch: string
          created_at: string
          created_by: string | null
          id: string
          last_sync_summary: string | null
          last_synced_at: string | null
          last_webhook_at: string | null
          path_prefix: string
          repo: string
          sync_interval_minutes: number
          updated_at: string
        }
        Insert: {
          auto_sync_enabled?: boolean
          branch?: string
          created_at?: string
          created_by?: string | null
          id?: string
          last_sync_summary?: string | null
          last_synced_at?: string | null
          last_webhook_at?: string | null
          path_prefix?: string
          repo: string
          sync_interval_minutes?: number
          updated_at?: string
        }
        Update: {
          auto_sync_enabled?: boolean
          branch?: string
          created_at?: string
          created_by?: string | null
          id?: string
          last_sync_summary?: string | null
          last_synced_at?: string | null
          last_webhook_at?: string | null
          path_prefix?: string
          repo?: string
          sync_interval_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      skill_submissions: {
        Row: {
          ai_triage: Json | null
          ai_triaged_at: string | null
          category: string
          created_at: string
          description: string
          id: string
          kind: string
          license: string
          mcp_endpoint: string | null
          name: string
          org: string
          repo: string
          reviewed_at: string | null
          reviewed_by: string | null
          reviewer_notes: string | null
          runtime: string
          skill_md: string | null
          slug: string
          source: string
          source_path: string | null
          source_repo: string | null
          source_sha: string | null
          status: string
          submitter_id: string
          summary: string
          tags: string[]
          technique: string
          tool_call: string
          verified_badge: string
          version: string
        }
        Insert: {
          ai_triage?: Json | null
          ai_triaged_at?: string | null
          category: string
          created_at?: string
          description: string
          id?: string
          kind: string
          license: string
          mcp_endpoint?: string | null
          name: string
          org: string
          repo: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          reviewer_notes?: string | null
          runtime: string
          skill_md?: string | null
          slug: string
          source?: string
          source_path?: string | null
          source_repo?: string | null
          source_sha?: string | null
          status?: string
          submitter_id: string
          summary: string
          tags?: string[]
          technique: string
          tool_call: string
          verified_badge?: string
          version: string
        }
        Update: {
          ai_triage?: Json | null
          ai_triaged_at?: string | null
          category?: string
          created_at?: string
          description?: string
          id?: string
          kind?: string
          license?: string
          mcp_endpoint?: string | null
          name?: string
          org?: string
          repo?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          reviewer_notes?: string | null
          runtime?: string
          skill_md?: string | null
          slug?: string
          source?: string
          source_path?: string | null
          source_repo?: string | null
          source_sha?: string | null
          status?: string
          submitter_id?: string
          summary?: string
          tags?: string[]
          technique?: string
          tool_call?: string
          verified_badge?: string
          version?: string
        }
        Relationships: []
      }
      skill_versions: {
        Row: {
          change_summary: string | null
          changed_fields: string[]
          created_at: string
          created_by: string | null
          id: string
          origin: string
          skill_md: string | null
          skill_slug: string
          snapshot: Json
          source_repo: string | null
          source_sha: string | null
          submission_id: string | null
          version: string
        }
        Insert: {
          change_summary?: string | null
          changed_fields?: string[]
          created_at?: string
          created_by?: string | null
          id?: string
          origin?: string
          skill_md?: string | null
          skill_slug: string
          snapshot: Json
          source_repo?: string | null
          source_sha?: string | null
          submission_id?: string | null
          version: string
        }
        Update: {
          change_summary?: string | null
          changed_fields?: string[]
          created_at?: string
          created_by?: string | null
          id?: string
          origin?: string
          skill_md?: string | null
          skill_slug?: string
          snapshot?: Json
          source_repo?: string | null
          source_sha?: string | null
          submission_id?: string | null
          version?: string
        }
        Relationships: []
      }
      skills: {
        Row: {
          ai_quality: Json | null
          ai_quality_at: string | null
          category: string
          created_at: string
          description: string
          downloads: number
          id: string
          kind: string
          license: string
          mcp_endpoint: string | null
          name: string
          org: string
          published_at: string
          repo: string
          runtime: string
          skill_md: string | null
          slug: string
          stars: number
          submitted_by: string | null
          summary: string
          tags: string[]
          technique: string
          tool_call: string
          updated_at: string | null
          verified_at: string | null
          verified_badge: string
          version: string
        }
        Insert: {
          ai_quality?: Json | null
          ai_quality_at?: string | null
          category: string
          created_at?: string
          description: string
          downloads?: number
          id?: string
          kind: string
          license: string
          mcp_endpoint?: string | null
          name: string
          org: string
          published_at?: string
          repo: string
          runtime: string
          skill_md?: string | null
          slug: string
          stars?: number
          submitted_by?: string | null
          summary: string
          tags?: string[]
          technique: string
          tool_call: string
          updated_at?: string | null
          verified_at?: string | null
          verified_badge?: string
          version: string
        }
        Update: {
          ai_quality?: Json | null
          ai_quality_at?: string | null
          category?: string
          created_at?: string
          description?: string
          downloads?: number
          id?: string
          kind?: string
          license?: string
          mcp_endpoint?: string | null
          name?: string
          org?: string
          published_at?: string
          repo?: string
          runtime?: string
          skill_md?: string | null
          slug?: string
          stars?: number
          submitted_by?: string | null
          summary?: string
          tags?: string[]
          technique?: string
          tool_call?: string
          updated_at?: string | null
          verified_at?: string | null
          verified_badge?: string
          version?: string
        }
        Relationships: []
      }
      submission_reviews: {
        Row: {
          action: string
          created_at: string
          id: string
          notes: string | null
          reviewer_email: string | null
          reviewer_id: string
          submission_id: string
          submission_name: string
          submission_slug: string
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          notes?: string | null
          reviewer_email?: string | null
          reviewer_id: string
          submission_id: string
          submission_name: string
          submission_slug: string
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          notes?: string | null
          reviewer_email?: string | null
          reviewer_id?: string
          submission_id?: string
          submission_name?: string
          submission_slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "submission_reviews_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "skill_submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      webhook_deliveries: {
        Row: {
          created_at: string
          delivery_id: string | null
          event: string | null
          id: string
          message: string | null
          provider: string
          ref: string | null
          repo: string | null
          status: string
        }
        Insert: {
          created_at?: string
          delivery_id?: string | null
          event?: string | null
          id?: string
          message?: string | null
          provider?: string
          ref?: string | null
          repo?: string | null
          status: string
        }
        Update: {
          created_at?: string
          delivery_id?: string | null
          event?: string | null
          id?: string
          message?: string | null
          provider?: string
          ref?: string | null
          repo?: string | null
          status?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      app_role: "admin" | "user"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "user"],
    },
  },
} as const
