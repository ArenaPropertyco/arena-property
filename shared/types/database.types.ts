export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      allocations: {
        Row: {
          calendar_id: string
          confirmed_at: string | null
          confirmed_by: string | null
          created_at: string
          fraction_id: string
          id: string
          kind: string
          release_reason: string | null
          released_at: string | null
          released_by: string | null
          selected_at: string
          selected_by: string | null
          week_id: string
        }
        Insert: {
          calendar_id: string
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          fraction_id: string
          id?: string
          kind?: string
          release_reason?: string | null
          released_at?: string | null
          released_by?: string | null
          selected_at?: string
          selected_by?: string | null
          week_id: string
        }
        Update: {
          calendar_id?: string
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          fraction_id?: string
          id?: string
          kind?: string
          release_reason?: string | null
          released_at?: string | null
          released_by?: string | null
          selected_at?: string
          selected_by?: string | null
          week_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "allocations_calendar_id_fkey"
            columns: ["calendar_id"]
            isOneToOne: false
            referencedRelation: "season_calendars"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "allocations_fraction_id_fkey"
            columns: ["fraction_id"]
            isOneToOne: false
            referencedRelation: "fractions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "allocations_week_id_fkey"
            columns: ["week_id"]
            isOneToOne: false
            referencedRelation: "calendar_weeks"
            referencedColumns: ["id"]
          },
        ]
      }
      ambassador_commissions: {
        Row: {
          ambassador_id: string
          assigned_at: string
          assigned_by: string | null
          commission_type_id: string
        }
        Insert: {
          ambassador_id: string
          assigned_at?: string
          assigned_by?: string | null
          commission_type_id: string
        }
        Update: {
          ambassador_id?: string
          assigned_at?: string
          assigned_by?: string | null
          commission_type_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ambassador_commissions_ambassador_id_fkey"
            columns: ["ambassador_id"]
            isOneToOne: true
            referencedRelation: "ambassadors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ambassador_commissions_ambassador_id_fkey"
            columns: ["ambassador_id"]
            isOneToOne: true
            referencedRelation: "wallet_balances"
            referencedColumns: ["ambassador_id"]
          },
          {
            foreignKeyName: "ambassador_commissions_commission_type_id_fkey"
            columns: ["commission_type_id"]
            isOneToOne: false
            referencedRelation: "commission_types"
            referencedColumns: ["id"]
          },
        ]
      }
      ambassadors: {
        Row: {
          account_kind: string
          account_number: string
          approved_at: string | null
          approved_by: string | null
          bank: string
          created_at: string
          holder: string
          id: string
          rejection_reason: string | null
          status: Database["public"]["Enums"]["ambassador_status"]
          terms_accepted_at: string
          terms_version: string
          updated_at: string
          user_id: string
        }
        Insert: {
          account_kind: string
          account_number: string
          approved_at?: string | null
          approved_by?: string | null
          bank: string
          created_at?: string
          holder: string
          id?: string
          rejection_reason?: string | null
          status?: Database["public"]["Enums"]["ambassador_status"]
          terms_accepted_at?: string
          terms_version: string
          updated_at?: string
          user_id: string
        }
        Update: {
          account_kind?: string
          account_number?: string
          approved_at?: string | null
          approved_by?: string | null
          bank?: string
          created_at?: string
          holder?: string
          id?: string
          rejection_reason?: string | null
          status?: Database["public"]["Enums"]["ambassador_status"]
          terms_accepted_at?: string
          terms_version?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      announcements: {
        Row: {
          active: boolean
          body: string
          created_at: string
          created_by: string | null
          fraction_id: string | null
          id: string
          property_id: string
          resolved_at: string | null
          resolved_by: string | null
          status: string | null
          title: string
          urgency: Database["public"]["Enums"]["announcement_urgency"]
        }
        Insert: {
          active?: boolean
          body: string
          created_at?: string
          created_by?: string | null
          fraction_id?: string | null
          id?: string
          property_id: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string | null
          title: string
          urgency: Database["public"]["Enums"]["announcement_urgency"]
        }
        Update: {
          active?: boolean
          body?: string
          created_at?: string
          created_by?: string | null
          fraction_id?: string | null
          id?: string
          property_id?: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string | null
          title?: string
          urgency?: Database["public"]["Enums"]["announcement_urgency"]
        }
        Relationships: [
          {
            foreignKeyName: "announcements_fraction_id_fkey"
            columns: ["fraction_id"]
            isOneToOne: false
            referencedRelation: "fractions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "announcements_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "announcements_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "property_overview"
            referencedColumns: ["id"]
          },
        ]
      }
      attributions: {
        Row: {
          ambassador_id: string
          clicked_at: string
          code: string
          commissioned_purchase_id: string | null
          created_at: string
          id: string
          prospect_email: string
          prospect_id: string
          registered_at: string
          stage: Database["public"]["Enums"]["referral_stage"]
          updated_at: string
        }
        Insert: {
          ambassador_id: string
          clicked_at: string
          code: string
          commissioned_purchase_id?: string | null
          created_at?: string
          id?: string
          prospect_email: string
          prospect_id: string
          registered_at?: string
          stage?: Database["public"]["Enums"]["referral_stage"]
          updated_at?: string
        }
        Update: {
          ambassador_id?: string
          clicked_at?: string
          code?: string
          commissioned_purchase_id?: string | null
          created_at?: string
          id?: string
          prospect_email?: string
          prospect_id?: string
          registered_at?: string
          stage?: Database["public"]["Enums"]["referral_stage"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "attributions_ambassador_id_fkey"
            columns: ["ambassador_id"]
            isOneToOne: false
            referencedRelation: "ambassadors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attributions_ambassador_id_fkey"
            columns: ["ambassador_id"]
            isOneToOne: false
            referencedRelation: "wallet_balances"
            referencedColumns: ["ambassador_id"]
          },
          {
            foreignKeyName: "attributions_commissioned_purchase_id_fkey"
            columns: ["commissioned_purchase_id"]
            isOneToOne: true
            referencedRelation: "payment_plan_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attributions_commissioned_purchase_id_fkey"
            columns: ["commissioned_purchase_id"]
            isOneToOne: true
            referencedRelation: "payment_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          actor_role: string
          entity_id: string | null
          entity_type: string
          id: string
          next_state: Json | null
          occurred_at: string
          previous_state: Json | null
          property_id: string | null
          reason: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_role: string
          entity_id?: string | null
          entity_type: string
          id?: string
          next_state?: Json | null
          occurred_at?: string
          previous_state?: Json | null
          property_id?: string | null
          reason?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_role?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          next_state?: Json | null
          occurred_at?: string
          previous_state?: Json | null
          property_id?: string | null
          reason?: string | null
        }
        Relationships: []
      }
      audit_reason_required: {
        Row: {
          action: string
          created_at: string
          source: string
        }
        Insert: {
          action: string
          created_at?: string
          source: string
        }
        Update: {
          action?: string
          created_at?: string
          source?: string
        }
        Relationships: []
      }
      broadcasts: {
        Row: {
          body: string
          created_at: string
          created_by: string | null
          id: string
          recipient_count: number
          segment_kind: string
          segment_property_id: string | null
          segment_roles: Database["public"]["Enums"]["app_role"][] | null
          title: string
        }
        Insert: {
          body: string
          created_at?: string
          created_by?: string | null
          id?: string
          recipient_count?: number
          segment_kind: string
          segment_property_id?: string | null
          segment_roles?: Database["public"]["Enums"]["app_role"][] | null
          title: string
        }
        Update: {
          body?: string
          created_at?: string
          created_by?: string | null
          id?: string
          recipient_count?: number
          segment_kind?: string
          segment_property_id?: string | null
          segment_roles?: Database["public"]["Enums"]["app_role"][] | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "broadcasts_segment_property_id_fkey"
            columns: ["segment_property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "broadcasts_segment_property_id_fkey"
            columns: ["segment_property_id"]
            isOneToOne: false
            referencedRelation: "property_overview"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_conflicts: {
        Row: {
          allocation_id: string
          block_id: string | null
          created_at: string
          fraction_id: string
          id: string
          property_id: string
          resolved_at: string | null
          status: string
          week_id: string
        }
        Insert: {
          allocation_id: string
          block_id?: string | null
          created_at?: string
          fraction_id: string
          id?: string
          property_id: string
          resolved_at?: string | null
          status?: string
          week_id: string
        }
        Update: {
          allocation_id?: string
          block_id?: string | null
          created_at?: string
          fraction_id?: string
          id?: string
          property_id?: string
          resolved_at?: string | null
          status?: string
          week_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_conflicts_allocation_id_fkey"
            columns: ["allocation_id"]
            isOneToOne: false
            referencedRelation: "allocations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_conflicts_block_id_fkey"
            columns: ["block_id"]
            isOneToOne: false
            referencedRelation: "week_blocks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_conflicts_fraction_id_fkey"
            columns: ["fraction_id"]
            isOneToOne: false
            referencedRelation: "fractions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_conflicts_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_conflicts_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "property_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_conflicts_week_id_fkey"
            columns: ["week_id"]
            isOneToOne: false
            referencedRelation: "calendar_weeks"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_weeks: {
        Row: {
          calendar_id: string
          created_at: string
          ends_on: string
          id: string
          index: number
          peak_block: string | null
          season: string
          starts_on: string
        }
        Insert: {
          calendar_id: string
          created_at?: string
          ends_on: string
          id?: string
          index: number
          peak_block?: string | null
          season: string
          starts_on: string
        }
        Update: {
          calendar_id?: string
          created_at?: string
          ends_on?: string
          id?: string
          index?: number
          peak_block?: string | null
          season?: string
          starts_on?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_weeks_calendar_id_fkey"
            columns: ["calendar_id"]
            isOneToOne: false
            referencedRelation: "season_calendars"
            referencedColumns: ["id"]
          },
        ]
      }
      commission_types: {
        Row: {
          active: boolean
          amount: number | null
          basis_points: number | null
          created_at: string
          created_by: string | null
          id: string
          is_default: boolean
          kind: Database["public"]["Enums"]["commission_kind"]
          name: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          amount?: number | null
          basis_points?: number | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_default?: boolean
          kind: Database["public"]["Enums"]["commission_kind"]
          name: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          amount?: number | null
          basis_points?: number | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_default?: boolean
          kind?: Database["public"]["Enums"]["commission_kind"]
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      commissions: {
        Row: {
          agreed_price: number
          ambassador_id: string
          amount: number
          attribution_id: string
          available_on: string | null
          commission_type_id: string
          completed_on: string | null
          created_at: string
          fraction_number: number
          grace_ends_on: string | null
          id: string
          loss_assumed_at: string | null
          plan_id: string
          property_id: string
          provisioned_on: string
          resolved_at: string | null
          resolved_reason: string | null
          reversal_reason: string | null
          reversed_at: string | null
          status: Database["public"]["Enums"]["commission_status"]
          updated_at: string
          withdrawn_amount: number
        }
        Insert: {
          agreed_price: number
          ambassador_id: string
          amount: number
          attribution_id: string
          available_on?: string | null
          commission_type_id: string
          completed_on?: string | null
          created_at?: string
          fraction_number: number
          grace_ends_on?: string | null
          id?: string
          loss_assumed_at?: string | null
          plan_id: string
          property_id: string
          provisioned_on?: string
          resolved_at?: string | null
          resolved_reason?: string | null
          reversal_reason?: string | null
          reversed_at?: string | null
          status?: Database["public"]["Enums"]["commission_status"]
          updated_at?: string
          withdrawn_amount?: number
        }
        Update: {
          agreed_price?: number
          ambassador_id?: string
          amount?: number
          attribution_id?: string
          available_on?: string | null
          commission_type_id?: string
          completed_on?: string | null
          created_at?: string
          fraction_number?: number
          grace_ends_on?: string | null
          id?: string
          loss_assumed_at?: string | null
          plan_id?: string
          property_id?: string
          provisioned_on?: string
          resolved_at?: string | null
          resolved_reason?: string | null
          reversal_reason?: string | null
          reversed_at?: string | null
          status?: Database["public"]["Enums"]["commission_status"]
          updated_at?: string
          withdrawn_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "commissions_ambassador_id_fkey"
            columns: ["ambassador_id"]
            isOneToOne: false
            referencedRelation: "ambassadors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commissions_ambassador_id_fkey"
            columns: ["ambassador_id"]
            isOneToOne: false
            referencedRelation: "wallet_balances"
            referencedColumns: ["ambassador_id"]
          },
          {
            foreignKeyName: "commissions_attribution_id_fkey"
            columns: ["attribution_id"]
            isOneToOne: false
            referencedRelation: "attributions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commissions_attribution_id_fkey"
            columns: ["attribution_id"]
            isOneToOne: false
            referencedRelation: "referral_listing"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commissions_commission_type_id_fkey"
            columns: ["commission_type_id"]
            isOneToOne: false
            referencedRelation: "commission_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commissions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "payment_plan_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commissions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "payment_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commissions_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commissions_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "property_overview"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_requests: {
        Row: {
          created_at: string
          email: string
          email_sent_at: string | null
          first_name: string
          id: string
          income_range: string | null
          intent: string
          ip_hash: string | null
          last_name: string
          locale: string
          message: string
          phone: string
          property_id: string | null
          property_type: string | null
          referral_code: string | null
        }
        Insert: {
          created_at?: string
          email: string
          email_sent_at?: string | null
          first_name: string
          id?: string
          income_range?: string | null
          intent: string
          ip_hash?: string | null
          last_name: string
          locale?: string
          message: string
          phone: string
          property_id?: string | null
          property_type?: string | null
          referral_code?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          email_sent_at?: string | null
          first_name?: string
          id?: string
          income_range?: string | null
          intent?: string
          ip_hash?: string | null
          last_name?: string
          locale?: string
          message?: string
          phone?: string
          property_id?: string | null
          property_type?: string | null
          referral_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contact_requests_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_requests_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "property_overview"
            referencedColumns: ["id"]
          },
        ]
      }
      expense_categories: {
        Row: {
          active: boolean
          created_at: string
          created_by: string | null
          id: string
          kind: Database["public"]["Enums"]["movement_kind"]
          name: string
          scope: Database["public"]["Enums"]["category_scope"]
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          kind: Database["public"]["Enums"]["movement_kind"]
          name: string
          scope?: Database["public"]["Enums"]["category_scope"]
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["movement_kind"]
          name?: string
          scope?: Database["public"]["Enums"]["category_scope"]
          updated_at?: string
        }
        Relationships: []
      }
      fraction_windows: {
        Row: {
          calendar_id: string
          closed_at: string | null
          closes_at: string
          created_at: string
          created_by: string | null
          fraction_id: string
          id: string
          opens_at: string
          property_id: string
          year: number
        }
        Insert: {
          calendar_id: string
          closed_at?: string | null
          closes_at: string
          created_at?: string
          created_by?: string | null
          fraction_id: string
          id?: string
          opens_at?: string
          property_id: string
          year: number
        }
        Update: {
          calendar_id?: string
          closed_at?: string | null
          closes_at?: string
          created_at?: string
          created_by?: string | null
          fraction_id?: string
          id?: string
          opens_at?: string
          property_id?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "fraction_windows_calendar_id_fkey"
            columns: ["calendar_id"]
            isOneToOne: false
            referencedRelation: "season_calendars"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fraction_windows_fraction_id_fkey"
            columns: ["fraction_id"]
            isOneToOne: false
            referencedRelation: "fractions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fraction_windows_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fraction_windows_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "property_overview"
            referencedColumns: ["id"]
          },
        ]
      }
      fractions: {
        Row: {
          calendar_activated_at: string | null
          calendar_active: boolean
          created_at: string
          id: string
          list_price: number
          number: number
          owner_id: string | null
          property_id: string
          status: Database["public"]["Enums"]["fraction_status"]
          updated_at: string
        }
        Insert: {
          calendar_activated_at?: string | null
          calendar_active?: boolean
          created_at?: string
          id?: string
          list_price: number
          number: number
          owner_id?: string | null
          property_id: string
          status?: Database["public"]["Enums"]["fraction_status"]
          updated_at?: string
        }
        Update: {
          calendar_activated_at?: string | null
          calendar_active?: boolean
          created_at?: string
          id?: string
          list_price?: number
          number?: number
          owner_id?: string | null
          property_id?: string
          status?: Database["public"]["Enums"]["fraction_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fractions_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fractions_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "property_overview"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_history: {
        Row: {
          changed_at: string
          changed_by: string | null
          field: string
          id: string
          item_id: string
          next: string
          note: string | null
          previous: string
          property_id: string
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          field: string
          id?: string
          item_id: string
          next: string
          note?: string | null
          previous: string
          property_id: string
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          field?: string
          id?: string
          item_id?: string
          next?: string
          note?: string | null
          previous?: string
          property_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_history_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_history_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_history_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "property_overview"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_items: {
        Row: {
          category: Database["public"]["Enums"]["inventory_category"]
          condition: Database["public"]["Enums"]["inventory_condition"]
          created_at: string
          created_by: string | null
          id: string
          location: string | null
          name: string
          notes: string | null
          property_id: string
          quantity: number
          retire_reason: string | null
          retired_at: string | null
          retired_by: string | null
          updated_at: string
        }
        Insert: {
          category: Database["public"]["Enums"]["inventory_category"]
          condition?: Database["public"]["Enums"]["inventory_condition"]
          created_at?: string
          created_by?: string | null
          id?: string
          location?: string | null
          name: string
          notes?: string | null
          property_id: string
          quantity?: number
          retire_reason?: string | null
          retired_at?: string | null
          retired_by?: string | null
          updated_at?: string
        }
        Update: {
          category?: Database["public"]["Enums"]["inventory_category"]
          condition?: Database["public"]["Enums"]["inventory_condition"]
          created_at?: string
          created_by?: string | null
          id?: string
          location?: string | null
          name?: string
          notes?: string | null
          property_id?: string
          quantity?: number
          retire_reason?: string | null
          retired_at?: string | null
          retired_by?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_items_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_items_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "property_overview"
            referencedColumns: ["id"]
          },
        ]
      }
      ledger_accounts: {
        Row: {
          active: boolean
          code: string
          created_at: string
          created_by: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      movement_shares: {
        Row: {
          amount: number
          created_at: string
          fraction_id: string
          fraction_number: number
          has_remainder: boolean
          id: string
          movement_id: string
          payer: Database["public"]["Enums"]["share_payer"]
          payer_id: string | null
          property_id: string
          reversed_at: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          fraction_id: string
          fraction_number: number
          has_remainder?: boolean
          id?: string
          movement_id: string
          payer: Database["public"]["Enums"]["share_payer"]
          payer_id?: string | null
          property_id: string
          reversed_at?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          fraction_id?: string
          fraction_number?: number
          has_remainder?: boolean
          id?: string
          movement_id?: string
          payer?: Database["public"]["Enums"]["share_payer"]
          payer_id?: string | null
          property_id?: string
          reversed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "movement_shares_fraction_id_fkey"
            columns: ["fraction_id"]
            isOneToOne: false
            referencedRelation: "fractions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movement_shares_movement_id_fkey"
            columns: ["movement_id"]
            isOneToOne: false
            referencedRelation: "movements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movement_shares_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movement_shares_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "property_overview"
            referencedColumns: ["id"]
          },
        ]
      }
      movements: {
        Row: {
          account_id: string
          allocation: Database["public"]["Enums"]["movement_allocation"]
          amount: number
          attachment_path: string | null
          booking_id: string | null
          category_id: string
          commission_amount: number | null
          commission_basis_points: number | null
          created_at: string
          created_by: string | null
          description: string
          fraction_id: string | null
          id: string
          incurred_on: string
          inventory_item_id: string | null
          kind: Database["public"]["Enums"]["movement_kind"]
          maintenance: boolean
          payment_method_id: string
          property_id: string
          updated_at: string
          void_reason: string | null
          voided_at: string | null
          voided_by: string | null
        }
        Insert: {
          account_id: string
          allocation?: Database["public"]["Enums"]["movement_allocation"]
          amount: number
          attachment_path?: string | null
          booking_id?: string | null
          category_id: string
          commission_amount?: number | null
          commission_basis_points?: number | null
          created_at?: string
          created_by?: string | null
          description: string
          fraction_id?: string | null
          id?: string
          incurred_on: string
          inventory_item_id?: string | null
          kind?: Database["public"]["Enums"]["movement_kind"]
          maintenance?: boolean
          payment_method_id: string
          property_id: string
          updated_at?: string
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Update: {
          account_id?: string
          allocation?: Database["public"]["Enums"]["movement_allocation"]
          amount?: number
          attachment_path?: string | null
          booking_id?: string | null
          category_id?: string
          commission_amount?: number | null
          commission_basis_points?: number | null
          created_at?: string
          created_by?: string | null
          description?: string
          fraction_id?: string | null
          id?: string
          incurred_on?: string
          inventory_item_id?: string | null
          kind?: Database["public"]["Enums"]["movement_kind"]
          maintenance?: boolean
          payment_method_id?: string
          property_id?: string
          updated_at?: string
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "movements_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "ledger_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movements_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "third_party_bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movements_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "expense_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movements_fraction_id_fkey"
            columns: ["fraction_id"]
            isOneToOne: false
            referencedRelation: "fractions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movements_inventory_item_id_fkey"
            columns: ["inventory_item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movements_payment_method_id_fkey"
            columns: ["payment_method_id"]
            isOneToOne: false
            referencedRelation: "payment_methods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movements_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movements_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "property_overview"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_recipients: {
        Row: {
          created_at: string
          email_attempts: number
          email_last_error: string | null
          email_next_attempt_at: string | null
          email_sent_at: string | null
          id: string
          notification_id: string
          read_at: string | null
          recipient_id: string
        }
        Insert: {
          created_at?: string
          email_attempts?: number
          email_last_error?: string | null
          email_next_attempt_at?: string | null
          email_sent_at?: string | null
          id?: string
          notification_id: string
          read_at?: string | null
          recipient_id: string
        }
        Update: {
          created_at?: string
          email_attempts?: number
          email_last_error?: string | null
          email_next_attempt_at?: string | null
          email_sent_at?: string | null
          id?: string
          notification_id?: string
          read_at?: string | null
          recipient_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_recipients_notification_id_fkey"
            columns: ["notification_id"]
            isOneToOne: false
            referencedRelation: "notifications"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          kind: string
          payload: Json
          property_id: string | null
          requires_email: boolean
        }
        Insert: {
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
          kind: string
          payload?: Json
          property_id?: string | null
          requires_email?: boolean
        }
        Update: {
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          kind?: string
          payload?: Json
          property_id?: string | null
          requires_email?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "notifications_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "property_overview"
            referencedColumns: ["id"]
          },
        ]
      }
      owner_charges: {
        Row: {
          amount: number
          created_at: string
          id: string
          owner_id: string
          paid_amount: number
          paid_at: string | null
          period: string
          property_id: string
          status: string
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          owner_id: string
          paid_amount?: number
          paid_at?: string | null
          period: string
          property_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          owner_id?: string
          paid_amount?: number
          paid_at?: string | null
          period?: string
          property_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "owner_charges_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "owner_charges_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "property_overview"
            referencedColumns: ["id"]
          },
        ]
      }
      owner_payments: {
        Row: {
          amount: number
          channel: string
          charge_id: string
          created_at: string
          description: string
          external_reference: string | null
          id: string
          owner_id: string
          paid_on: string
          payment_method_id: string | null
          property_id: string
          provider: string | null
          receipt_path: string | null
          rejection_reason: string | null
          reported_at: string
          resolved_at: string | null
          resolved_by: string | null
          status: string
          updated_at: string
        }
        Insert: {
          amount: number
          channel?: string
          charge_id: string
          created_at?: string
          description: string
          external_reference?: string | null
          id?: string
          owner_id: string
          paid_on: string
          payment_method_id?: string | null
          property_id: string
          provider?: string | null
          receipt_path?: string | null
          rejection_reason?: string | null
          reported_at?: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          channel?: string
          charge_id?: string
          created_at?: string
          description?: string
          external_reference?: string | null
          id?: string
          owner_id?: string
          paid_on?: string
          payment_method_id?: string | null
          property_id?: string
          provider?: string | null
          receipt_path?: string | null
          rejection_reason?: string | null
          reported_at?: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "owner_payments_charge_id_fkey"
            columns: ["charge_id"]
            isOneToOne: false
            referencedRelation: "owner_charges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "owner_payments_payment_method_id_fkey"
            columns: ["payment_method_id"]
            isOneToOne: false
            referencedRelation: "payment_methods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "owner_payments_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "owner_payments_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "property_overview"
            referencedColumns: ["id"]
          },
        ]
      }
      owner_statement_lines: {
        Row: {
          adjustment: boolean
          amount: number
          entry: string
          id: string
          kind: Database["public"]["Enums"]["movement_kind"]
          movement_id: string
          origin_period: string
          share_id: string
          statement_id: string
        }
        Insert: {
          adjustment?: boolean
          amount: number
          entry: string
          id?: string
          kind: Database["public"]["Enums"]["movement_kind"]
          movement_id: string
          origin_period: string
          share_id: string
          statement_id: string
        }
        Update: {
          adjustment?: boolean
          amount?: number
          entry?: string
          id?: string
          kind?: Database["public"]["Enums"]["movement_kind"]
          movement_id?: string
          origin_period?: string
          share_id?: string
          statement_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "owner_statement_lines_movement_id_fkey"
            columns: ["movement_id"]
            isOneToOne: false
            referencedRelation: "movements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "owner_statement_lines_share_id_fkey"
            columns: ["share_id"]
            isOneToOne: false
            referencedRelation: "movement_shares"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "owner_statement_lines_statement_id_fkey"
            columns: ["statement_id"]
            isOneToOne: false
            referencedRelation: "owner_statements"
            referencedColumns: ["id"]
          },
        ]
      }
      owner_statements: {
        Row: {
          closed_at: string
          expenses: number
          fraction_id: string
          fraction_number: number
          id: string
          income: number
          net: number
          owner_id: string
          period: string
          property_id: string
        }
        Insert: {
          closed_at?: string
          expenses?: number
          fraction_id: string
          fraction_number: number
          id?: string
          income?: number
          net?: number
          owner_id: string
          period: string
          property_id: string
        }
        Update: {
          closed_at?: string
          expenses?: number
          fraction_id?: string
          fraction_number?: number
          id?: string
          income?: number
          net?: number
          owner_id?: string
          period?: string
          property_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "owner_statements_fraction_id_fkey"
            columns: ["fraction_id"]
            isOneToOne: false
            referencedRelation: "fractions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "owner_statements_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "owner_statements_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "property_overview"
            referencedColumns: ["id"]
          },
        ]
      }
      owner_wallet_movements: {
        Row: {
          amount: number
          created_at: string
          fraction_id: string | null
          id: string
          kind: string
          occurred_on: string
          owner_id: string
          payment_id: string | null
          property_id: string
          statement_id: string | null
          withdrawal_id: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          fraction_id?: string | null
          id?: string
          kind: string
          occurred_on?: string
          owner_id: string
          payment_id?: string | null
          property_id: string
          statement_id?: string | null
          withdrawal_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          fraction_id?: string | null
          id?: string
          kind?: string
          occurred_on?: string
          owner_id?: string
          payment_id?: string | null
          property_id?: string
          statement_id?: string | null
          withdrawal_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "owner_wallet_movements_fraction_id_fkey"
            columns: ["fraction_id"]
            isOneToOne: false
            referencedRelation: "fractions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "owner_wallet_movements_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: true
            referencedRelation: "owner_payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "owner_wallet_movements_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "owner_wallet_movements_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "property_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "owner_wallet_movements_statement_id_fkey"
            columns: ["statement_id"]
            isOneToOne: true
            referencedRelation: "owner_statements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "owner_wallet_movements_withdrawal_id_fkey"
            columns: ["withdrawal_id"]
            isOneToOne: true
            referencedRelation: "owner_withdrawals"
            referencedColumns: ["id"]
          },
        ]
      }
      owner_withdrawals: {
        Row: {
          account_kind: string
          account_number: string
          amount: number
          bank: string
          created_at: string
          holder: string
          id: string
          owner_id: string
          paid_at: string | null
          property_id: string
          receipt_path: string | null
          rejected_at: string | null
          rejection_reason: string | null
          requested_on: string
          resolved_by: string | null
          status: string
          updated_at: string
        }
        Insert: {
          account_kind: string
          account_number: string
          amount: number
          bank: string
          created_at?: string
          holder: string
          id?: string
          owner_id: string
          paid_at?: string | null
          property_id: string
          receipt_path?: string | null
          rejected_at?: string | null
          rejection_reason?: string | null
          requested_on?: string
          resolved_by?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          account_kind?: string
          account_number?: string
          amount?: number
          bank?: string
          created_at?: string
          holder?: string
          id?: string
          owner_id?: string
          paid_at?: string | null
          property_id?: string
          receipt_path?: string | null
          rejected_at?: string | null
          rejection_reason?: string | null
          requested_on?: string
          resolved_by?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "owner_withdrawals_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "owner_withdrawals_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "property_overview"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_events: {
        Row: {
          emitted_at: string
          id: string
          kind: Database["public"]["Enums"]["payment_event_kind"]
          payload: Json
          plan_id: string
          property_id: string
        }
        Insert: {
          emitted_at?: string
          id?: string
          kind: Database["public"]["Enums"]["payment_event_kind"]
          payload?: Json
          plan_id: string
          property_id: string
        }
        Update: {
          emitted_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["payment_event_kind"]
          payload?: Json
          plan_id?: string
          property_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_events_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "payment_plan_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_events_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "payment_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_events_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_events_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "property_overview"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_methods: {
        Row: {
          active: boolean
          code: string
          created_at: string
          created_by: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      payment_plans: {
        Row: {
          agreed_price: number
          closed_at: string
          closed_by: string | null
          created_at: string
          fraction_id: string
          id: string
          invitation_id: string
          owner_id: string
          property_id: string
          referral_code: string | null
          updated_at: string
          void_reason: string | null
          voided_at: string | null
          voided_by: string | null
        }
        Insert: {
          agreed_price: number
          closed_at?: string
          closed_by?: string | null
          created_at?: string
          fraction_id: string
          id?: string
          invitation_id: string
          owner_id: string
          property_id: string
          referral_code?: string | null
          updated_at?: string
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Update: {
          agreed_price?: number
          closed_at?: string
          closed_by?: string | null
          created_at?: string
          fraction_id?: string
          id?: string
          invitation_id?: string
          owner_id?: string
          property_id?: string
          referral_code?: string | null
          updated_at?: string
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_plans_fraction_id_fkey"
            columns: ["fraction_id"]
            isOneToOne: false
            referencedRelation: "fractions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_plans_invitation_id_fkey"
            columns: ["invitation_id"]
            isOneToOne: true
            referencedRelation: "purchase_invitations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_plans_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_plans_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "property_overview"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          id: string
          note: string | null
          paid_on: string
          payment_method: string
          plan_id: string
          property_id: string
          receipt_path: string
          registered_by: string | null
          void_reason: string | null
          voided_at: string | null
          voided_by: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          note?: string | null
          paid_on: string
          payment_method: string
          plan_id: string
          property_id: string
          receipt_path: string
          registered_by?: string | null
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          note?: string | null
          paid_on?: string
          payment_method?: string
          plan_id?: string
          property_id?: string
          receipt_path?: string
          registered_by?: string | null
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "payment_plan_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "payment_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "property_overview"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_ledger: {
        Row: {
          accrued_on: string
          amount: number
          category_id: string
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["movement_kind"]
          note: string | null
          property_id: string | null
          reverse_reason: string | null
          reversed_at: string | null
          source_id: string | null
          source_type: string
        }
        Insert: {
          accrued_on: string
          amount: number
          category_id: string
          created_at?: string
          id?: string
          kind: Database["public"]["Enums"]["movement_kind"]
          note?: string | null
          property_id?: string | null
          reverse_reason?: string | null
          reversed_at?: string | null
          source_id?: string | null
          source_type: string
        }
        Update: {
          accrued_on?: string
          amount?: number
          category_id?: string
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["movement_kind"]
          note?: string | null
          property_id?: string | null
          reverse_reason?: string | null
          reversed_at?: string | null
          source_id?: string | null
          source_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "platform_ledger_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "expense_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "platform_ledger_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "platform_ledger_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "property_overview"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_settings: {
        Row: {
          id: string
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          id?: string
          key: string
          updated_at?: string
          updated_by?: string | null
          value: Json
        }
        Update: {
          id?: string
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: [
          {
            foreignKeyName: "platform_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          email_verified: boolean
          full_name: string | null
          id: string
          locale: string
          phone: string | null
          referred_by_code: string | null
          status: Database["public"]["Enums"]["account_status"]
          suspended_at: string | null
          suspension_kind: Database["public"]["Enums"]["suspension_kind"] | null
          suspension_reason: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          email_verified?: boolean
          full_name?: string | null
          id: string
          locale?: string
          phone?: string | null
          referred_by_code?: string | null
          status?: Database["public"]["Enums"]["account_status"]
          suspended_at?: string | null
          suspension_kind?:
            | Database["public"]["Enums"]["suspension_kind"]
            | null
          suspension_reason?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          email_verified?: boolean
          full_name?: string | null
          id?: string
          locale?: string
          phone?: string | null
          referred_by_code?: string | null
          status?: Database["public"]["Enums"]["account_status"]
          suspended_at?: string | null
          suspension_kind?:
            | Database["public"]["Enums"]["suspension_kind"]
            | null
          suspension_reason?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      properties: {
        Row: {
          address: string | null
          amenities: string[]
          area_m2: number
          bathrooms: number
          bedrooms: number
          city: string
          coming_soon: boolean
          country: string
          created_at: string
          created_by: string | null
          description: string
          id: string
          name: string
          parking_spots: number
          region: string
          rental_commission_basis_points: number | null
          slug: string
          updated_at: string
          video_url: string | null
          visibility: Database["public"]["Enums"]["property_visibility"]
        }
        Insert: {
          address?: string | null
          amenities?: string[]
          area_m2: number
          bathrooms?: number
          bedrooms?: number
          city: string
          coming_soon?: boolean
          country: string
          created_at?: string
          created_by?: string | null
          description: string
          id?: string
          name: string
          parking_spots?: number
          region: string
          rental_commission_basis_points?: number | null
          slug?: string
          updated_at?: string
          video_url?: string | null
          visibility?: Database["public"]["Enums"]["property_visibility"]
        }
        Update: {
          address?: string | null
          amenities?: string[]
          area_m2?: number
          bathrooms?: number
          bedrooms?: number
          city?: string
          coming_soon?: boolean
          country?: string
          created_at?: string
          created_by?: string | null
          description?: string
          id?: string
          name?: string
          parking_spots?: number
          region?: string
          rental_commission_basis_points?: number | null
          slug?: string
          updated_at?: string
          video_url?: string | null
          visibility?: Database["public"]["Enums"]["property_visibility"]
        }
        Relationships: []
      }
      property_admins: {
        Row: {
          admin_id: string
          assigned_at: string
          assigned_by: string | null
          id: string
          property_id: string
          revoked_at: string | null
          revoked_by: string | null
        }
        Insert: {
          admin_id: string
          assigned_at?: string
          assigned_by?: string | null
          id?: string
          property_id: string
          revoked_at?: string | null
          revoked_by?: string | null
        }
        Update: {
          admin_id?: string
          assigned_at?: string
          assigned_by?: string | null
          id?: string
          property_id?: string
          revoked_at?: string | null
          revoked_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "property_admins_property_fk"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_admins_property_fk"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "property_overview"
            referencedColumns: ["id"]
          },
        ]
      }
      property_media: {
        Row: {
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["property_media_kind"]
          path: string
          property_id: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          id?: string
          kind: Database["public"]["Enums"]["property_media_kind"]
          path: string
          property_id: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["property_media_kind"]
          path?: string
          property_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "property_media_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_media_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "property_overview"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_invitations: {
        Row: {
          accepted_at: string | null
          agreed_price: number
          cancel_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          created_at: string
          fraction_id: string
          id: string
          invited_by: string | null
          invitee_email: string
          invitee_id: string | null
          property_id: string
          referral_code: string | null
          status: Database["public"]["Enums"]["purchase_invitation_status"]
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          agreed_price: number
          cancel_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          created_at?: string
          fraction_id: string
          id?: string
          invited_by?: string | null
          invitee_email: string
          invitee_id?: string | null
          property_id: string
          referral_code?: string | null
          status?: Database["public"]["Enums"]["purchase_invitation_status"]
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          agreed_price?: number
          cancel_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          created_at?: string
          fraction_id?: string
          id?: string
          invited_by?: string | null
          invitee_email?: string
          invitee_id?: string | null
          property_id?: string
          referral_code?: string | null
          status?: Database["public"]["Enums"]["purchase_invitation_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_invitations_fraction_id_fkey"
            columns: ["fraction_id"]
            isOneToOne: false
            referencedRelation: "fractions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_invitations_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_invitations_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "property_overview"
            referencedColumns: ["id"]
          },
        ]
      }
      referral_clicks: {
        Row: {
          clicked_at: string
          code: string
          id: string
          visitor_id: string
        }
        Insert: {
          clicked_at?: string
          code: string
          id?: string
          visitor_id: string
        }
        Update: {
          clicked_at?: string
          code?: string
          id?: string
          visitor_id?: string
        }
        Relationships: []
      }
      referral_codes: {
        Row: {
          ambassador_id: string
          code: string
          created_at: string
          enabled: boolean
          id: string
        }
        Insert: {
          ambassador_id: string
          code: string
          created_at?: string
          enabled?: boolean
          id?: string
        }
        Update: {
          ambassador_id?: string
          code?: string
          created_at?: string
          enabled?: boolean
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "referral_codes_ambassador_id_fkey"
            columns: ["ambassador_id"]
            isOneToOne: true
            referencedRelation: "ambassadors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referral_codes_ambassador_id_fkey"
            columns: ["ambassador_id"]
            isOneToOne: true
            referencedRelation: "wallet_balances"
            referencedColumns: ["ambassador_id"]
          },
        ]
      }
      role_capabilities: {
        Row: {
          capability: string
          role: string
          scope: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          capability: string
          role: string
          scope: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          capability?: string
          role?: string
          scope?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      season_calendars: {
        Row: {
          base_year: number
          check_in: string
          check_out: string
          created_at: string
          created_by: string | null
          criteria: Json
          id: string
          property_id: string
          published_at: string | null
          updated_at: string
          year: number
        }
        Insert: {
          base_year: number
          check_in?: string
          check_out?: string
          created_at?: string
          created_by?: string | null
          criteria?: Json
          id?: string
          property_id: string
          published_at?: string | null
          updated_at?: string
          year: number
        }
        Update: {
          base_year?: number
          check_in?: string
          check_out?: string
          created_at?: string
          created_by?: string | null
          criteria?: Json
          id?: string
          property_id?: string
          published_at?: string | null
          updated_at?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "season_calendars_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "season_calendars_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "property_overview"
            referencedColumns: ["id"]
          },
        ]
      }
      selection_turns: {
        Row: {
          calendar_id: string
          created_at: string
          fraction_id: string
          id: string
          position: number
        }
        Insert: {
          calendar_id: string
          created_at?: string
          fraction_id: string
          id?: string
          position: number
        }
        Update: {
          calendar_id?: string
          created_at?: string
          fraction_id?: string
          id?: string
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "selection_turns_calendar_id_fkey"
            columns: ["calendar_id"]
            isOneToOne: false
            referencedRelation: "season_calendars"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "selection_turns_fraction_id_fkey"
            columns: ["fraction_id"]
            isOneToOne: false
            referencedRelation: "fractions"
            referencedColumns: ["id"]
          },
        ]
      }
      selection_window_turns: {
        Row: {
          closes_at: string
          created_at: string
          fraction_id: string
          id: string
          opens_at: string
          position: number
          window_id: string
        }
        Insert: {
          closes_at: string
          created_at?: string
          fraction_id: string
          id?: string
          opens_at: string
          position: number
          window_id: string
        }
        Update: {
          closes_at?: string
          created_at?: string
          fraction_id?: string
          id?: string
          opens_at?: string
          position?: number
          window_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "selection_window_turns_fraction_id_fkey"
            columns: ["fraction_id"]
            isOneToOne: false
            referencedRelation: "fractions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "selection_window_turns_window_id_fkey"
            columns: ["window_id"]
            isOneToOne: false
            referencedRelation: "selection_windows"
            referencedColumns: ["id"]
          },
        ]
      }
      selection_windows: {
        Row: {
          calendar_id: string
          closed_at: string | null
          closes_at: string
          created_at: string
          created_by: string | null
          duration_days: number
          id: string
          opens_at: string
          property_id: string
          turn_hours: number
          updated_at: string
          year: number
        }
        Insert: {
          calendar_id: string
          closed_at?: string | null
          closes_at: string
          created_at?: string
          created_by?: string | null
          duration_days?: number
          id?: string
          opens_at: string
          property_id: string
          turn_hours?: number
          updated_at?: string
          year: number
        }
        Update: {
          calendar_id?: string
          closed_at?: string | null
          closes_at?: string
          created_at?: string
          created_by?: string | null
          duration_days?: number
          id?: string
          opens_at?: string
          property_id?: string
          turn_hours?: number
          updated_at?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "selection_windows_calendar_id_fkey"
            columns: ["calendar_id"]
            isOneToOne: true
            referencedRelation: "season_calendars"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "selection_windows_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "selection_windows_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "property_overview"
            referencedColumns: ["id"]
          },
        ]
      }
      third_parties: {
        Row: {
          anonymize_after: string
          anonymized_at: string | null
          consent_accepted_at: string
          consent_version: string
          created_at: string
          created_by: string | null
          document_kind: Database["public"]["Enums"]["third_party_document"]
          document_number: string
          email: string | null
          full_name: string
          id: string
          phone: string | null
          property_id: string
          updated_at: string
        }
        Insert: {
          anonymize_after?: string
          anonymized_at?: string | null
          consent_accepted_at?: string
          consent_version?: string
          created_at?: string
          created_by?: string | null
          document_kind: Database["public"]["Enums"]["third_party_document"]
          document_number: string
          email?: string | null
          full_name: string
          id?: string
          phone?: string | null
          property_id: string
          updated_at?: string
        }
        Update: {
          anonymize_after?: string
          anonymized_at?: string | null
          consent_accepted_at?: string
          consent_version?: string
          created_at?: string
          created_by?: string | null
          document_kind?: Database["public"]["Enums"]["third_party_document"]
          document_number?: string
          email?: string | null
          full_name?: string
          id?: string
          phone?: string | null
          property_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "third_parties_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "third_parties_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "property_overview"
            referencedColumns: ["id"]
          },
        ]
      }
      third_party_bookings: {
        Row: {
          calendar_id: string
          cancel_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          created_at: string
          created_by: string | null
          id: string
          origin_fraction_id: string | null
          origin_reason: Database["public"]["Enums"]["week_origin"]
          property_id: string
          status: string
          third_party_id: string
          updated_at: string
          week_id: string
        }
        Insert: {
          calendar_id: string
          cancel_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          origin_fraction_id?: string | null
          origin_reason: Database["public"]["Enums"]["week_origin"]
          property_id: string
          status?: string
          third_party_id: string
          updated_at?: string
          week_id: string
        }
        Update: {
          calendar_id?: string
          cancel_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          origin_fraction_id?: string | null
          origin_reason?: Database["public"]["Enums"]["week_origin"]
          property_id?: string
          status?: string
          third_party_id?: string
          updated_at?: string
          week_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "third_party_bookings_calendar_id_fkey"
            columns: ["calendar_id"]
            isOneToOne: false
            referencedRelation: "season_calendars"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "third_party_bookings_origin_fraction_id_fkey"
            columns: ["origin_fraction_id"]
            isOneToOne: false
            referencedRelation: "fractions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "third_party_bookings_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "third_party_bookings_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "property_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "third_party_bookings_third_party_id_fkey"
            columns: ["third_party_id"]
            isOneToOne: false
            referencedRelation: "third_parties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "third_party_bookings_week_id_fkey"
            columns: ["week_id"]
            isOneToOne: false
            referencedRelation: "calendar_weeks"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          granted_at: string
          granted_by: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          granted_at?: string
          granted_by?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          granted_at?: string
          granted_by?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      waitlist_entries: {
        Row: {
          anonymized_at: string | null
          confirmation_sent_at: string | null
          consent_at: string
          consent_version: string
          created_at: string
          email: string
          email_attempts: number
          email_last_error: string | null
          email_next_attempt_at: string | null
          full_name: string
          id: string
          ip_hash: string | null
          locale: string
          notified_at: string | null
          notify_requested_at: string | null
          phone: string
          property_id: string
          retain_until: string
        }
        Insert: {
          anonymized_at?: string | null
          confirmation_sent_at?: string | null
          consent_at?: string
          consent_version: string
          created_at?: string
          email: string
          email_attempts?: number
          email_last_error?: string | null
          email_next_attempt_at?: string | null
          full_name: string
          id?: string
          ip_hash?: string | null
          locale?: string
          notified_at?: string | null
          notify_requested_at?: string | null
          phone: string
          property_id: string
          retain_until: string
        }
        Update: {
          anonymized_at?: string | null
          confirmation_sent_at?: string | null
          consent_at?: string
          consent_version?: string
          created_at?: string
          email?: string
          email_attempts?: number
          email_last_error?: string | null
          email_next_attempt_at?: string | null
          full_name?: string
          id?: string
          ip_hash?: string | null
          locale?: string
          notified_at?: string | null
          notify_requested_at?: string | null
          phone?: string
          property_id?: string
          retain_until?: string
        }
        Relationships: [
          {
            foreignKeyName: "waitlist_entries_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waitlist_entries_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "property_overview"
            referencedColumns: ["id"]
          },
        ]
      }
      wallet_movements: {
        Row: {
          ambassador_id: string
          amount: number
          commission_id: string | null
          created_at: string
          id: string
          kind: string
          note: string | null
          occurred_on: string
          withdrawal_id: string | null
        }
        Insert: {
          ambassador_id: string
          amount: number
          commission_id?: string | null
          created_at?: string
          id?: string
          kind: string
          note?: string | null
          occurred_on?: string
          withdrawal_id?: string | null
        }
        Update: {
          ambassador_id?: string
          amount?: number
          commission_id?: string | null
          created_at?: string
          id?: string
          kind?: string
          note?: string | null
          occurred_on?: string
          withdrawal_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "wallet_movements_ambassador_id_fkey"
            columns: ["ambassador_id"]
            isOneToOne: false
            referencedRelation: "ambassadors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wallet_movements_ambassador_id_fkey"
            columns: ["ambassador_id"]
            isOneToOne: false
            referencedRelation: "wallet_balances"
            referencedColumns: ["ambassador_id"]
          },
          {
            foreignKeyName: "wallet_movements_commission_id_fkey"
            columns: ["commission_id"]
            isOneToOne: false
            referencedRelation: "commissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wallet_movements_commission_id_fkey"
            columns: ["commission_id"]
            isOneToOne: false
            referencedRelation: "referral_listing"
            referencedColumns: ["commission_id"]
          },
          {
            foreignKeyName: "wallet_movements_withdrawal_id_fkey"
            columns: ["withdrawal_id"]
            isOneToOne: false
            referencedRelation: "withdrawal_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      week_blocks: {
        Row: {
          calendar_id: string
          created_at: string
          created_by: string | null
          id: string
          lift_reason: string | null
          lifted_at: string | null
          lifted_by: string | null
          property_id: string
          reason: string
          week_id: string
        }
        Insert: {
          calendar_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          lift_reason?: string | null
          lifted_at?: string | null
          lifted_by?: string | null
          property_id: string
          reason: string
          week_id: string
        }
        Update: {
          calendar_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          lift_reason?: string | null
          lifted_at?: string | null
          lifted_by?: string | null
          property_id?: string
          reason?: string
          week_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "week_blocks_calendar_id_fkey"
            columns: ["calendar_id"]
            isOneToOne: false
            referencedRelation: "season_calendars"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "week_blocks_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "week_blocks_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "property_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "week_blocks_week_id_fkey"
            columns: ["week_id"]
            isOneToOne: false
            referencedRelation: "calendar_weeks"
            referencedColumns: ["id"]
          },
        ]
      }
      week_swap_requests: {
        Row: {
          calendar_id: string
          created_at: string
          created_by: string | null
          id: string
          message: string | null
          offered_week_id: string
          property_id: string
          requested_week_id: string
          requester_fraction_id: string
          resolution_reason: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: string
          target_fraction_id: string
        }
        Insert: {
          calendar_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          message?: string | null
          offered_week_id: string
          property_id: string
          requested_week_id: string
          requester_fraction_id: string
          resolution_reason?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          target_fraction_id: string
        }
        Update: {
          calendar_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          message?: string | null
          offered_week_id?: string
          property_id?: string
          requested_week_id?: string
          requester_fraction_id?: string
          resolution_reason?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          target_fraction_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "week_swap_requests_calendar_id_fkey"
            columns: ["calendar_id"]
            isOneToOne: false
            referencedRelation: "season_calendars"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "week_swap_requests_offered_week_id_fkey"
            columns: ["offered_week_id"]
            isOneToOne: false
            referencedRelation: "calendar_weeks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "week_swap_requests_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "week_swap_requests_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "property_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "week_swap_requests_requested_week_id_fkey"
            columns: ["requested_week_id"]
            isOneToOne: false
            referencedRelation: "calendar_weeks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "week_swap_requests_requester_fraction_id_fkey"
            columns: ["requester_fraction_id"]
            isOneToOne: false
            referencedRelation: "fractions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "week_swap_requests_target_fraction_id_fkey"
            columns: ["target_fraction_id"]
            isOneToOne: false
            referencedRelation: "fractions"
            referencedColumns: ["id"]
          },
        ]
      }
      withdrawal_requests: {
        Row: {
          ambassador_id: string
          amount: number
          approved_at: string | null
          created_at: string
          id: string
          paid_at: string | null
          receipt_path: string | null
          rejected_at: string | null
          rejection_reason: string | null
          requested_on: string
          resolved_by: string | null
          status: string
          updated_at: string
        }
        Insert: {
          ambassador_id: string
          amount: number
          approved_at?: string | null
          created_at?: string
          id?: string
          paid_at?: string | null
          receipt_path?: string | null
          rejected_at?: string | null
          rejection_reason?: string | null
          requested_on?: string
          resolved_by?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          ambassador_id?: string
          amount?: number
          approved_at?: string | null
          created_at?: string
          id?: string
          paid_at?: string | null
          receipt_path?: string | null
          rejected_at?: string | null
          rejection_reason?: string | null
          requested_on?: string
          resolved_by?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "withdrawal_requests_ambassador_id_fkey"
            columns: ["ambassador_id"]
            isOneToOne: false
            referencedRelation: "ambassadors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "withdrawal_requests_ambassador_id_fkey"
            columns: ["ambassador_id"]
            isOneToOne: false
            referencedRelation: "wallet_balances"
            referencedColumns: ["ambassador_id"]
          },
          {
            foreignKeyName: "withdrawal_requests_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      notification_inbox: {
        Row: {
          created_at: string | null
          entity_id: string | null
          entity_type: string | null
          id: string | null
          kind: string | null
          notification_id: string | null
          payload: Json | null
          property_id: string | null
          property_name: string | null
          read_at: string | null
          recipient_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notification_recipients_notification_id_fkey"
            columns: ["notification_id"]
            isOneToOne: false
            referencedRelation: "notifications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "property_overview"
            referencedColumns: ["id"]
          },
        ]
      }
      owner_wallet_balances: {
        Row: {
          balance: number | null
          owner_id: string | null
          property_id: string | null
          property_name: string | null
        }
        Relationships: []
      }
      owner_wallet_listing: {
        Row: {
          amount: number | null
          created_at: string | null
          fraction_number: number | null
          id: string | null
          kind: string | null
          occurred_on: string | null
          owner_id: string | null
          payment_id: string | null
          period: string | null
          property_id: string | null
          property_name: string | null
          statement_id: string | null
          withdrawal_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "owner_wallet_movements_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: true
            referencedRelation: "owner_payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "owner_wallet_movements_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "owner_wallet_movements_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "property_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "owner_wallet_movements_statement_id_fkey"
            columns: ["statement_id"]
            isOneToOne: true
            referencedRelation: "owner_statements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "owner_wallet_movements_withdrawal_id_fkey"
            columns: ["withdrawal_id"]
            isOneToOne: true
            referencedRelation: "owner_withdrawals"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_plan_overview: {
        Row: {
          agreed_price: number | null
          balance: number | null
          calendar_active: boolean | null
          closed_at: string | null
          closed_by: string | null
          fraction_id: string | null
          fraction_number: number | null
          id: string | null
          invitation_id: string | null
          owner_id: string | null
          paid_total: number | null
          payment_count: number | null
          property_id: string | null
          property_name: string | null
          referral_code: string | null
          status: string | null
          void_reason: string | null
          voided_at: string | null
          voided_by: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_plans_fraction_id_fkey"
            columns: ["fraction_id"]
            isOneToOne: false
            referencedRelation: "fractions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_plans_invitation_id_fkey"
            columns: ["invitation_id"]
            isOneToOne: true
            referencedRelation: "purchase_invitations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_plans_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_plans_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "property_overview"
            referencedColumns: ["id"]
          },
        ]
      }
      property_overview: {
        Row: {
          area_m2: number | null
          available_fractions: number | null
          bathrooms: number | null
          bedrooms: number | null
          city: string | null
          coming_soon: boolean | null
          commercial_status: string | null
          country: string | null
          created_at: string | null
          created_by: string | null
          fraction_count: number | null
          id: string | null
          lowest_available_price: number | null
          name: string | null
          parking_spots: number | null
          region: string | null
          slug: string | null
          sold_fractions: number | null
          visibility: Database["public"]["Enums"]["property_visibility"] | null
        }
        Relationships: []
      }
      referral_listing: {
        Row: {
          ambassador_id: string | null
          commission_amount: number | null
          commission_id: string | null
          commission_status:
            | Database["public"]["Enums"]["commission_status"]
            | null
          fraction_number: number | null
          grace_ends_on: string | null
          id: string | null
          plan_id: string | null
          property_id: string | null
          property_name: string | null
          prospect_email: string | null
          prospect_id: string | null
          prospect_name: string | null
          referred_on: string | null
          stage: Database["public"]["Enums"]["referral_stage"] | null
        }
        Relationships: [
          {
            foreignKeyName: "attributions_ambassador_id_fkey"
            columns: ["ambassador_id"]
            isOneToOne: false
            referencedRelation: "ambassadors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attributions_ambassador_id_fkey"
            columns: ["ambassador_id"]
            isOneToOne: false
            referencedRelation: "wallet_balances"
            referencedColumns: ["ambassador_id"]
          },
          {
            foreignKeyName: "commissions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "payment_plan_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commissions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "payment_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commissions_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commissions_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "property_overview"
            referencedColumns: ["id"]
          },
        ]
      }
      wallet_balances: {
        Row: {
          ambassador_id: string | null
          available: number | null
          in_grace: number | null
          pending: number | null
          reversed: number | null
          total_earned: number | null
          user_id: string | null
          withdrawn: number | null
        }
        Relationships: []
      }
      wallet_listing: {
        Row: {
          ambassador_id: string | null
          amount: number | null
          commission_id: string | null
          created_at: string | null
          fraction_number: number | null
          grace_ends_on: string | null
          id: string | null
          kind: string | null
          note: string | null
          occurred_on: string | null
          property_name: string | null
          referral_label: string | null
          withdrawal_id: string | null
          withdrawal_status: string | null
        }
        Relationships: [
          {
            foreignKeyName: "wallet_movements_ambassador_id_fkey"
            columns: ["ambassador_id"]
            isOneToOne: false
            referencedRelation: "ambassadors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wallet_movements_ambassador_id_fkey"
            columns: ["ambassador_id"]
            isOneToOne: false
            referencedRelation: "wallet_balances"
            referencedColumns: ["ambassador_id"]
          },
          {
            foreignKeyName: "wallet_movements_commission_id_fkey"
            columns: ["commission_id"]
            isOneToOne: false
            referencedRelation: "commissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wallet_movements_commission_id_fkey"
            columns: ["commission_id"]
            isOneToOne: false
            referencedRelation: "referral_listing"
            referencedColumns: ["commission_id"]
          },
          {
            foreignKeyName: "wallet_movements_withdrawal_id_fkey"
            columns: ["withdrawal_id"]
            isOneToOne: false
            referencedRelation: "withdrawal_requests"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      anonimizar_lista_de_espera: {
        Args: { momento?: string }
        Returns: number
      }
      anonimizar_terceros: { Args: { hoy?: string }; Returns: number }
      anular_abono: {
        Args: { abono: string; motivo: string }
        Returns: {
          amount: number
          created_at: string
          id: string
          note: string | null
          paid_on: string
          payment_method: string
          plan_id: string
          property_id: string
          receipt_path: string
          registered_by: string | null
          void_reason: string | null
          voided_at: string | null
          voided_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "payments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      anular_compra: {
        Args: { motivo: string; plan: string }
        Returns: {
          agreed_price: number
          closed_at: string
          closed_by: string | null
          created_at: string
          fraction_id: string
          id: string
          invitation_id: string
          owner_id: string
          property_id: string
          referral_code: string | null
          updated_at: string
          void_reason: string | null
          voided_at: string | null
          voided_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "payment_plans"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      anular_movimiento: {
        Args: { motivo: string; movimiento: string }
        Returns: {
          account_id: string
          allocation: Database["public"]["Enums"]["movement_allocation"]
          amount: number
          attachment_path: string | null
          booking_id: string | null
          category_id: string
          commission_amount: number | null
          commission_basis_points: number | null
          created_at: string
          created_by: string | null
          description: string
          fraction_id: string | null
          id: string
          incurred_on: string
          inventory_item_id: string | null
          kind: Database["public"]["Enums"]["movement_kind"]
          maintenance: boolean
          payment_method_id: string
          property_id: string
          updated_at: string
          void_reason: string | null
          voided_at: string | null
          voided_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "movements"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      aplicar_atribucion_referido: {
        Args: { codigo: string }
        Returns: undefined
      }
      approve_ambassador: {
        Args: { ambassador: string; approve: boolean; reason?: string }
        Returns: string
      }
      approve_withdrawal: { Args: { request: string }; Returns: undefined }
      assign_commission_type: {
        Args: { ambassador: string; commission_type?: string }
        Returns: undefined
      }
      attribute_referral: {
        Args: { referral_code?: string; visitor?: string }
        Returns: string
      }
      block_weeks: {
        Args: { calendar: string; reason: string; week_indexes: number[] }
        Returns: Json
      }
      cancel_week: {
        Args: { calendar: string; fraction: string; week_index: number }
        Returns: undefined
      }
      cancelar_reserva_a_tercero: {
        Args: { motivo: string; reserva: string }
        Returns: {
          calendar_id: string
          cancel_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          created_at: string
          created_by: string | null
          id: string
          origin_fraction_id: string | null
          origin_reason: Database["public"]["Enums"]["week_origin"]
          property_id: string
          status: string
          third_party_id: string
          updated_at: string
          week_id: string
        }
        SetofOptions: {
          from: "*"
          to: "third_party_bookings"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      cerrar_compra: {
        Args: { invitacion: string; precio_pactado?: number }
        Returns: {
          agreed_price: number
          closed_at: string
          closed_by: string | null
          created_at: string
          fraction_id: string
          id: string
          invitation_id: string
          owner_id: string
          property_id: string
          referral_code: string | null
          updated_at: string
          void_reason: string | null
          voided_at: string | null
          voided_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "payment_plans"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      close_expired_selection_windows: {
        Args: { at?: string }
        Returns: number
      }
      close_fraction_window: { Args: { window_id: string }; Returns: undefined }
      close_owner_statements: { Args: { periodo?: string }; Returns: number }
      close_selection_window: { Args: { calendar: string }; Returns: undefined }
      commission_type_for: {
        Args: { ambassador: string }
        Returns: {
          amount: number
          basis_points: number
          id: string
          is_default: boolean
          kind: Database["public"]["Enums"]["commission_kind"]
          name: string
        }[]
      }
      configure_selection_window: {
        Args: {
          calendar: string
          duration_days?: number
          fraction_order?: number[]
          opens_at?: string
          turn_hours?: number
        }
        Returns: string
      }
      confirm_owner_payment: { Args: { payment: string }; Returns: undefined }
      confirm_week: {
        Args: { calendar: string; fraction: string; week_index: number }
        Returns: undefined
      }
      copropietarios_de: {
        Args: { propiedad: string }
        Returns: {
          calendar_active: boolean
          fraction_number: number
          owner_name: string
        }[]
      }
      create_commission_type: {
        Args: {
          amount?: number
          basis_points?: number
          kind: Database["public"]["Enums"]["commission_kind"]
          make_default?: boolean
          name: string
        }
        Returns: string
      }
      default_commission_type: {
        Args: never
        Returns: {
          amount: number
          basis_points: number
          id: string
          is_default: boolean
          kind: Database["public"]["Enums"]["commission_kind"]
          name: string
        }[]
      }
      delete_selection_window: {
        Args: { calendar: string }
        Returns: undefined
      }
      derivar_estado_del_plan: {
        Args: { abonado: number; anulado: boolean; precio: number }
        Returns: string
      }
      emitir_notificacion: {
        Args: {
          carga: Json
          destinatarios: string[]
          entidad: string
          entidad_id: string
          propiedad: string
          requiere_correo?: boolean
          tipo: string
        }
        Returns: string
      }
      enroll_as_ambassador: {
        Args: {
          account_kind: string
          account_number: string
          bank: string
          holder: string
          terms_version: string
        }
        Returns: string
      }
      estado_comercial: { Args: { propiedad: string }; Returns: string }
      estado_del_plan: { Args: { plan: string }; Returns: string }
      expire_unconfirmed_weeks: {
        Args: { days?: number; today?: string }
        Returns: number
      }
      fijar_comision_de_renta: {
        Args: { propiedad: string; puntos_basicos: number }
        Returns: {
          address: string | null
          amenities: string[]
          area_m2: number
          bathrooms: number
          bedrooms: number
          city: string
          coming_soon: boolean
          country: string
          created_at: string
          created_by: string | null
          description: string
          id: string
          name: string
          parking_spots: number
          region: string
          rental_commission_basis_points: number | null
          slug: string
          updated_at: string
          video_url: string | null
          visibility: Database["public"]["Enums"]["property_visibility"]
        }
        SetofOptions: {
          from: "*"
          to: "properties"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      fraccionar_propiedad: {
        Args: { precios: number[]; propiedad: string }
        Returns: {
          calendar_activated_at: string | null
          calendar_active: boolean
          created_at: string
          id: string
          list_price: number
          number: number
          owner_id: string | null
          property_id: string
          status: Database["public"]["Enums"]["fraction_status"]
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "fractions"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      guardar_calendario: {
        Args: {
          anio: number
          anio_base: number
          criterio: Json
          propiedad: string
          semanas: Json
        }
        Returns: string
      }
      lift_week_block: {
        Args: { block: string; reason: string }
        Returns: undefined
      }
      marcar_leida: { Args: { destinatario: string }; Returns: string }
      marcar_todas_leidas: { Args: never; Returns: number }
      open_calendar_selection: {
        Args: { calendar: string; fraction_order?: number[] }
        Returns: number[]
      }
      open_fraction_window: {
        Args: { calendar: string; fraction_number: number; hours?: number }
        Returns: string
      }
      pay_owner_withdrawal: {
        Args: { receipt_path: string; request: string }
        Returns: undefined
      }
      pay_withdrawal: {
        Args: { receipt_path: string; request: string }
        Returns: undefined
      }
      platform_metrics: { Args: never; Returns: Json }
      reactivate_account: { Args: { account: string }; Returns: undefined }
      reassign_week: {
        Args: {
          calendar: string
          fraction: number
          from_week: number
          override_season?: boolean
          reason: string
          to_week: number
        }
        Returns: undefined
      }
      record_referral_click: {
        Args: { referral_code: string; visitor: string }
        Returns: undefined
      }
      registrar_ingreso_de_renta: {
        Args: {
          categoria: string
          causacion?: string
          cuenta: string
          descripcion?: string
          medio: string
          monto: number
          reserva: string
        }
        Returns: {
          account_id: string
          allocation: Database["public"]["Enums"]["movement_allocation"]
          amount: number
          attachment_path: string | null
          booking_id: string | null
          category_id: string
          commission_amount: number | null
          commission_basis_points: number | null
          created_at: string
          created_by: string | null
          description: string
          fraction_id: string | null
          id: string
          incurred_on: string
          inventory_item_id: string | null
          kind: Database["public"]["Enums"]["movement_kind"]
          maintenance: boolean
          payment_method_id: string
          property_id: string
          updated_at: string
          void_reason: string | null
          voided_at: string | null
          voided_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "movements"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      registrar_tercero: {
        Args: {
          consentimiento?: boolean
          correo?: string
          documento: string
          nombre: string
          propiedad: string
          telefono?: string
          tipo_documento: Database["public"]["Enums"]["third_party_document"]
        }
        Returns: {
          anonymize_after: string
          anonymized_at: string | null
          consent_accepted_at: string
          consent_version: string
          created_at: string
          created_by: string | null
          document_kind: Database["public"]["Enums"]["third_party_document"]
          document_number: string
          email: string | null
          full_name: string
          id: string
          phone: string | null
          property_id: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "third_parties"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      reject_owner_payment: {
        Args: { payment: string; reason: string }
        Returns: undefined
      }
      reject_owner_withdrawal: {
        Args: { reason: string; request: string }
        Returns: undefined
      }
      reject_withdrawal: {
        Args: { reason: string; request: string }
        Returns: undefined
      }
      release_commissions_in_grace: { Args: { hoy?: string }; Returns: number }
      release_week: {
        Args: { calendar: string; fraction: string; week_index: number }
        Returns: undefined
      }
      relocate_week: {
        Args: {
          calendar: string
          fraction: string
          from_week: number
          to_week: number
        }
        Returns: undefined
      }
      rename_commission_type: {
        Args: { commission_type: string; name: string }
        Returns: undefined
      }
      rentar_semana: {
        Args: { calendario: string; indice_de_semana: number; tercero: string }
        Returns: {
          calendar_id: string
          cancel_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          created_at: string
          created_by: string | null
          id: string
          origin_fraction_id: string | null
          origin_reason: Database["public"]["Enums"]["week_origin"]
          property_id: string
          status: string
          third_party_id: string
          updated_at: string
          week_id: string
        }
        SetofOptions: {
          from: "*"
          to: "third_party_bookings"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      reopen_selection_window: {
        Args: { calendar: string }
        Returns: undefined
      }
      report_owner_payment: {
        Args: {
          amount: number
          charge: string
          description: string
          paid_on: string
          payment_method: string
          receipt_path: string
        }
        Returns: string
      }
      request_owner_withdrawal: {
        Args: {
          account_kind: string
          account_number: string
          amount: number
          bank: string
          holder: string
          property: string
        }
        Returns: string
      }
      request_week_swap: {
        Args: {
          calendar: string
          fraction: string
          message?: string
          offered_week: number
          requested_week: number
          target_fraction: number
        }
        Returns: string
      }
      request_withdrawal: { Args: { amount: number }; Returns: string }
      resolve_announcement: { Args: { announcement: string }; Returns: string }
      resolve_available_commissions: {
        Args: { ambassador: string; forfeit: boolean; reason: string }
        Returns: number
      }
      resolve_swap_request: {
        Args: { approve: boolean; reason?: string; request: string }
        Returns: undefined
      }
      retire_inventory_item: {
        Args: { item: string; reason: string }
        Returns: {
          category: Database["public"]["Enums"]["inventory_category"]
          condition: Database["public"]["Enums"]["inventory_condition"]
          created_at: string
          created_by: string | null
          id: string
          location: string | null
          name: string
          notes: string | null
          property_id: string
          quantity: number
          retire_reason: string | null
          retired_at: string | null
          retired_by: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "inventory_items"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      select_weeks: {
        Args: { calendar: string; fraction: string; week_indexes: number[] }
        Returns: number
      }
      set_announcement_active: {
        Args: { active: boolean; announcement: string }
        Returns: boolean
      }
      set_commission_type_active: {
        Args: { active: boolean; commission_type: string }
        Returns: undefined
      }
      set_default_commission_type: {
        Args: { commission_type: string }
        Returns: undefined
      }
      set_withdrawal_minimum: { Args: { amount: number }; Returns: number }
      suggested_relocation_order: {
        Args: { calendar: string }
        Returns: number[]
      }
      suggested_selection_order: {
        Args: { calendar: string }
        Returns: number[]
      }
      suspend_account: {
        Args: {
          account: string
          kind: Database["public"]["Enums"]["suspension_kind"]
          reason: string
        }
        Returns: undefined
      }
      swap_weeks: {
        Args: {
          calendar: string
          fraction_a: number
          fraction_b: number
          reason: string
          week_a: number
          week_b: number
        }
        Returns: undefined
      }
      traspasar_fraccion: {
        Args: {
          destino_cuotas: string
          destino_reservas: string
          fraccion: string
          motivo: string
          nuevo_titular: string
        }
        Returns: {
          calendar_activated_at: string | null
          calendar_active: boolean
          created_at: string
          id: string
          list_price: number
          number: number
          owner_id: string | null
          property_id: string
          status: Database["public"]["Enums"]["fraction_status"]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "fractions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      withdrawal_minimum: { Args: never; Returns: number }
    }
    Enums: {
      account_status: "active" | "suspended"
      ambassador_status: "pending" | "approved" | "rejected" | "suspended"
      announcement_urgency: "informative" | "important" | "urgent"
      app_role:
        | "superadmin"
        | "property_admin"
        | "owner"
        | "ambassador"
        | "user"
      category_scope: "property" | "platform"
      commission_kind: "fixed" | "percentage"
      commission_status:
        | "pending"
        | "in_grace"
        | "available"
        | "withdrawn"
        | "reversed"
      fraction_status: "available" | "reserved" | "sold"
      inventory_category:
        | "furniture"
        | "appliances"
        | "equipment"
        | "linens"
        | "supplies"
        | "other"
      inventory_condition: "new" | "good" | "fair" | "damaged"
      movement_allocation: "prorated" | "single_fraction"
      movement_kind: "expense" | "income"
      payment_event_kind: "payment_completed" | "purchase_voided"
      property_media_kind: "photo" | "video" | "floor_plan" | "floor_plan_2d"
      property_visibility: "draft" | "published" | "inactive"
      purchase_invitation_status: "pending" | "accepted" | "cancelled"
      referral_stage: "registered" | "payment_in_progress" | "paid"
      share_payer: "owner" | "inventory_holder"
      suspension_kind: "administrative" | "breach_or_fraud"
      third_party_document: "cc" | "ce" | "passport" | "nit"
      week_origin: "voluntary" | "cancelled" | "expired" | "relocated" | "pool"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      account_status: ["active", "suspended"],
      ambassador_status: ["pending", "approved", "rejected", "suspended"],
      announcement_urgency: ["informative", "important", "urgent"],
      app_role: ["superadmin", "property_admin", "owner", "ambassador", "user"],
      category_scope: ["property", "platform"],
      commission_kind: ["fixed", "percentage"],
      commission_status: [
        "pending",
        "in_grace",
        "available",
        "withdrawn",
        "reversed",
      ],
      fraction_status: ["available", "reserved", "sold"],
      inventory_category: [
        "furniture",
        "appliances",
        "equipment",
        "linens",
        "supplies",
        "other",
      ],
      inventory_condition: ["new", "good", "fair", "damaged"],
      movement_allocation: ["prorated", "single_fraction"],
      movement_kind: ["expense", "income"],
      payment_event_kind: ["payment_completed", "purchase_voided"],
      property_media_kind: ["photo", "video", "floor_plan", "floor_plan_2d"],
      property_visibility: ["draft", "published", "inactive"],
      purchase_invitation_status: ["pending", "accepted", "cancelled"],
      referral_stage: ["registered", "payment_in_progress", "paid"],
      share_payer: ["owner", "inventory_holder"],
      suspension_kind: ["administrative", "breach_or_fraud"],
      third_party_document: ["cc", "ce", "passport", "nit"],
      week_origin: ["voluntary", "cancelled", "expired", "relocated", "pool"],
    },
  },
} as const

