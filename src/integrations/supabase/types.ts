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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      clients: {
        Row: {
          address: string | null
          city: string | null
          company_name: string
          contact_name: string | null
          created_at: string
          email: string | null
          id: string
          notes: string | null
          phone: string | null
          state: string | null
          updated_at: string
          zip_code: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          company_name: string
          contact_name?: string | null
          created_at?: string
          email?: string | null
          id?: string
          notes?: string | null
          phone?: string | null
          state?: string | null
          updated_at?: string
          zip_code?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          company_name?: string
          contact_name?: string | null
          created_at?: string
          email?: string | null
          id?: string
          notes?: string | null
          phone?: string | null
          state?: string | null
          updated_at?: string
          zip_code?: string | null
        }
        Relationships: []
      }
      order_items: {
        Row: {
          color: string | null
          created_at: string
          id: string
          order_id: string
          quantity: number
          size: string | null
          style_id: string
          total_price: number | null
          unit_price: number
        }
        Insert: {
          color?: string | null
          created_at?: string
          id?: string
          order_id: string
          quantity?: number
          size?: string | null
          style_id: string
          total_price?: number | null
          unit_price: number
        }
        Update: {
          color?: string | null
          created_at?: string
          id?: string
          order_id?: string
          quantity?: number
          size?: string | null
          style_id?: string
          total_price?: number | null
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_style_id_fkey"
            columns: ["style_id"]
            isOneToOne: false
            referencedRelation: "styles"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          client_id: string
          created_at: string
          id: string
          notes: string | null
          order_date: string
          order_number: string
          season: string | null
          status: string
          total_amount: number | null
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          id?: string
          notes?: string | null
          order_date?: string
          order_number: string
          season?: string | null
          status?: string
          total_amount?: number | null
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          order_date?: string
          order_number?: string
          season?: string | null
          status?: string
          total_amount?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          client_id: string
          created_at: string
          id: string
          notes: string | null
          order_id: string
          payment_date: string
          payment_method: string | null
          reference_number: string | null
        }
        Insert: {
          amount: number
          client_id: string
          created_at?: string
          id?: string
          notes?: string | null
          order_id: string
          payment_date?: string
          payment_method?: string | null
          reference_number?: string | null
        }
        Update: {
          amount?: number
          client_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          order_id?: string
          payment_date?: string
          payment_method?: string | null
          reference_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      styles: {
        Row: {
          category: string | null
          colors: string[] | null
          created_at: string
          description: string | null
          factory_description: string | null
          factory_name: string | null
          id: string
          image_url: string | null
          is_active: boolean
          last_number: string | null
          leather_description: string | null
          materials: string | null
          name: string
          retail_price: number | null
          season: string | null
          sizes: string[] | null
          sole_type: string | null
          style_code: string
          updated_at: string
          wholesale_price: number | null
        }
        Insert: {
          category?: string | null
          colors?: string[] | null
          created_at?: string
          description?: string | null
          factory_description?: string | null
          factory_name?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          last_number?: string | null
          leather_description?: string | null
          materials?: string | null
          name: string
          retail_price?: number | null
          season?: string | null
          sizes?: string[] | null
          sole_type?: string | null
          style_code: string
          updated_at?: string
          wholesale_price?: number | null
        }
        Update: {
          category?: string | null
          colors?: string[] | null
          created_at?: string
          description?: string | null
          factory_description?: string | null
          factory_name?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          last_number?: string | null
          leather_description?: string | null
          materials?: string | null
          name?: string
          retail_price?: number | null
          season?: string | null
          sizes?: string[] | null
          sole_type?: string | null
          style_code?: string
          updated_at?: string
          wholesale_price?: number | null
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
      [_ in never]: never
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
  public: {
    Enums: {},
  },
} as const
