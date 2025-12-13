export type Json =
  | string |
  number |
  boolean |
  null |
  { [key: string]: Json | undefined } |
  Json[];

export interface Database {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5";
  };
  public: {
    Tables: {
      video_chunks: {
        Row: {
          chunk_index: number;
          chunk_text: string;
          created_at: string | null;
          embedding: string | null;
          end_time: number;
          id: string;
          start_time: number;
          video_id: string;
          visual_description: string | null;
        };
        Insert: {
          chunk_index: number;
          chunk_text: string;
          created_at?: string | null;
          embedding?: string | null;
          end_time: number;
          id?: string;
          start_time: number;
          video_id: string;
          visual_description?: string | null;
        };
        Update: {
          chunk_index?: number;
          chunk_text?: string;
          created_at?: string | null;
          embedding?: string | null;
          end_time?: number;
          id?: string;
          start_time?: number;
          video_id?: string;
          visual_description?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "video_chunks_video_id_fkey";
            columns: ["video_id"];
            isOneToOne: false;
            referencedRelation: "videos";
            referencedColumns: ["id"];
          },
        ];
      };
      videos: {
        Row: {
          chapters: Json | null;
          created_at: string | null;
          description: string | null;
          id: string;
          mux_asset_id: string;
          title: string | null;
          topics: string[] | null;
          transcript_en_text: string | null;
          transcript_en_vtt: string | null;
          updated_at: string | null;
        };
        Insert: {
          chapters?: Json | null;
          created_at?: string | null;
          description?: string | null;
          id?: string;
          mux_asset_id: string;
          title?: string | null;
          topics?: string[] | null;
          transcript_en_text?: string | null;
          transcript_en_vtt?: string | null;
          updated_at?: string | null;
        };
        Update: {
          chapters?: Json | null;
          created_at?: string | null;
          description?: string | null;
          id?: string;
          mux_asset_id?: string;
          title?: string | null;
          topics?: string[] | null;
          transcript_en_text?: string | null;
          transcript_en_vtt?: string | null;
          updated_at?: string | null;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never
    };
    Functions: {
      match_video_chunks: {
        Args: {
          match_count?: number;
          query_embedding: string;
          similarity_threshold?: number;
        };
        Returns: {
          chunk_id: string;
          chunk_text: string;
          mux_asset_id: string;
          parent_video_topics: string[];
          similarity_score: number;
          video_id: string;
          visual_description: string;
        }[];
      };
    };
    Enums: {
      [_ in never]: never
    };
    CompositeTypes: {
      [_ in never]: never
    };
  };
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
  | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"]) |
  { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  } ?
    keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"]) :
    never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
} ?
    (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    } ?
      R :
      never :
  DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
    DefaultSchema["Views"]) ?
      (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      } ?
        R :
        never :
    never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
  | keyof DefaultSchema["Tables"] |
  { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  } ?
    keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] :
    never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
} ?
  DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
    Insert: infer I;
  } ?
    I :
    never :
  DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"] ?
    DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I;
    } ?
      I :
      never :
    never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
  | keyof DefaultSchema["Tables"] |
  { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  } ?
    keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] :
    never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
} ?
  DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
    Update: infer U;
  } ?
    U :
    never :
  DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"] ?
    DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U;
    } ?
      U :
      never :
    never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
  | keyof DefaultSchema["Enums"] |
  { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  } ?
    keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"] :
    never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
} ?
  DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName] :
  DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"] ?
    DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions] :
    never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
  | keyof DefaultSchema["CompositeTypes"] |
  { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  } ?
    keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"] :
    never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
} ?
  DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName] :
  PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"] ?
    DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions] :
    never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;
