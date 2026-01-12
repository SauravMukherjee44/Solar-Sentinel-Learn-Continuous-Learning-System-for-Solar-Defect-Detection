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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      drift_alerts: {
        Row: {
          acknowledged: boolean
          alert_type: string
          current_value: number
          id: string
          message: string
          severity: string
          threshold: number
          timestamp: string
        }
        Insert: {
          acknowledged?: boolean
          alert_type: string
          current_value: number
          id?: string
          message: string
          severity: string
          threshold: number
          timestamp?: string
        }
        Update: {
          acknowledged?: boolean
          alert_type?: string
          current_value?: number
          id?: string
          message?: string
          severity?: string
          threshold?: number
          timestamp?: string
        }
        Relationships: []
      }
      inference_logs: {
        Row: {
          actual_label: string | null
          confidence: number
          id: string
          image_id: string
          is_correct: boolean | null
          latency_ms: number
          model_version: string
          prediction: string
          timestamp: string
        }
        Insert: {
          actual_label?: string | null
          confidence: number
          id?: string
          image_id: string
          is_correct?: boolean | null
          latency_ms: number
          model_version: string
          prediction: string
          timestamp?: string
        }
        Update: {
          actual_label?: string | null
          confidence?: number
          id?: string
          image_id?: string
          is_correct?: boolean | null
          latency_ms?: number
          model_version?: string
          prediction?: string
          timestamp?: string
        }
        Relationships: []
      }
      model_versions: {
        Row: {
          batch_version: string | null
          created_at: string
          dataset_version: string
          deployment_status: string
          hyperparameters: Json
          id: string
          metrics: Json
          model_path: string | null
          traffic_split: number | null
          training_date: string
          updated_at: string
          version: string
        }
        Insert: {
          batch_version?: string | null
          created_at?: string
          dataset_version: string
          deployment_status?: string
          hyperparameters?: Json
          id?: string
          metrics?: Json
          model_path?: string | null
          traffic_split?: number | null
          training_date?: string
          updated_at?: string
          version: string
        }
        Update: {
          batch_version?: string | null
          created_at?: string
          dataset_version?: string
          deployment_status?: string
          hyperparameters?: Json
          id?: string
          metrics?: Json
          model_path?: string | null
          traffic_split?: number | null
          training_date?: string
          updated_at?: string
          version?: string
        }
        Relationships: []
      }
      pipeline_steps: {
        Row: {
          batch_id: string | null
          created_at: string
          details: string | null
          end_time: string | null
          id: string
          progress: number | null
          start_time: string | null
          status: string
          step_name: string
          step_order: number
        }
        Insert: {
          batch_id?: string | null
          created_at?: string
          details?: string | null
          end_time?: string | null
          id?: string
          progress?: number | null
          start_time?: string | null
          status?: string
          step_name: string
          step_order: number
        }
        Update: {
          batch_id?: string | null
          created_at?: string
          details?: string | null
          end_time?: string | null
          id?: string
          progress?: number | null
          start_time?: string | null
          status?: string
          step_name?: string
          step_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "pipeline_steps_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "training_batches"
            referencedColumns: ["id"]
          },
        ]
      }
      system_status: {
        Row: {
          active_model: string
          avg_latency: number
          canary_model: string | null
          current_phase: number
          id: number
          is_training: boolean
          total_inferences: number
          updated_at: string
          uptime: number
        }
        Insert: {
          active_model?: string
          avg_latency?: number
          canary_model?: string | null
          current_phase?: number
          id?: number
          is_training?: boolean
          total_inferences?: number
          updated_at?: string
          uptime?: number
        }
        Update: {
          active_model?: string
          avg_latency?: number
          canary_model?: string | null
          current_phase?: number
          id?: number
          is_training?: boolean
          total_inferences?: number
          updated_at?: string
          uptime?: number
        }
        Relationships: []
      }
      training_batches: {
        Row: {
          analysis_results: Json | null
          created_at: string
          defect_images: number
          error_message: string | null
          id: string
          normal_images: number
          phase: number
          status: string
          total_images: number
          updated_at: string
          upload_date: string
        }
        Insert: {
          analysis_results?: Json | null
          created_at?: string
          defect_images?: number
          error_message?: string | null
          id?: string
          normal_images?: number
          phase: number
          status?: string
          total_images?: number
          updated_at?: string
          upload_date?: string
        }
        Update: {
          analysis_results?: Json | null
          created_at?: string
          defect_images?: number
          error_message?: string | null
          id?: string
          normal_images?: number
          phase?: number
          status?: string
          total_images?: number
          updated_at?: string
          upload_date?: string
        }
        Relationships: []
      }
      uploaded_images: {
        Row: {
          batch_id: string | null
          file_size: number | null
          filename: string
          id: string
          label: string
          storage_path: string
          uploaded_at: string | null
        }
        Insert: {
          batch_id?: string | null
          file_size?: number | null
          filename: string
          id?: string
          label: string
          storage_path: string
          uploaded_at?: string | null
        }
        Update: {
          batch_id?: string | null
          file_size?: number | null
          filename?: string
          id?: string
          label?: string
          storage_path?: string
          uploaded_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "uploaded_images_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "training_batches"
            referencedColumns: ["id"]
          },
        ]
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
