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
      fractions: {
        Row: {
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
    }
    Views: {
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
          available_fractions: number | null
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
          region: string | null
          sold_fractions: number | null
          visibility: Database["public"]["Enums"]["property_visibility"] | null
        }
        Relationships: []
      }
    }
    Functions: {
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
      aplicar_atribucion_referido: {
        Args: { codigo: string }
        Returns: undefined
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
      derivar_estado_del_plan: {
        Args: { abonado: number; anulado: boolean; precio: number }
        Returns: string
      }
      estado_comercial: { Args: { propiedad: string }; Returns: string }
      estado_del_plan: { Args: { plan: string }; Returns: string }
      fraccionar_propiedad: {
        Args: { precios: number[]; propiedad: string }
        Returns: {
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
      traspasar_fraccion: {
        Args: {
          destino_cuotas: string
          destino_reservas: string
          fraccion: string
          motivo: string
          nuevo_titular: string
        }
        Returns: {
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
    }
    Enums: {
      account_status: "active" | "suspended"
      app_role:
        | "superadmin"
        | "property_admin"
        | "owner"
        | "ambassador"
        | "user"
      fraction_status: "available" | "reserved" | "sold"
      payment_event_kind: "payment_completed" | "purchase_voided"
      property_media_kind: "photo" | "video" | "floor_plan"
      property_visibility: "draft" | "published" | "inactive"
      purchase_invitation_status: "pending" | "accepted" | "cancelled"
      suspension_kind: "administrative" | "breach_or_fraud"
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
      app_role: ["superadmin", "property_admin", "owner", "ambassador", "user"],
      fraction_status: ["available", "reserved", "sold"],
      payment_event_kind: ["payment_completed", "purchase_voided"],
      property_media_kind: ["photo", "video", "floor_plan"],
      property_visibility: ["draft", "published", "inactive"],
      purchase_invitation_status: ["pending", "accepted", "cancelled"],
      suspension_kind: ["administrative", "breach_or_fraud"],
    },
  },
} as const

