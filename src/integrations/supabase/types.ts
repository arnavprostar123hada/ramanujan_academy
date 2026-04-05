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
      announcements: {
        Row: {
          content: string
          created_at: string
          id: string
          target_classes: string[] | null
          title: string
          updated_at: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          target_classes?: string[] | null
          title: string
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          target_classes?: string[] | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      class_logs: {
        Row: {
          class: string
          content: string
          created_at: string
          id: string
          log_date: string
          teacher_id: string
        }
        Insert: {
          class: string
          content: string
          created_at?: string
          id?: string
          log_date?: string
          teacher_id: string
        }
        Update: {
          class?: string
          content?: string
          created_at?: string
          id?: string
          log_date?: string
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_logs_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_submissions: {
        Row: {
          class_interested: string | null
          created_at: string
          email: string
          id: string
          is_read: boolean | null
          message: string | null
          name: string
          phone: string
        }
        Insert: {
          class_interested?: string | null
          created_at?: string
          email: string
          id?: string
          is_read?: boolean | null
          message?: string | null
          name: string
          phone: string
        }
        Update: {
          class_interested?: string | null
          created_at?: string
          email?: string
          id?: string
          is_read?: boolean | null
          message?: string | null
          name?: string
          phone?: string
        }
        Relationships: []
      }
      enquiries: {
        Row: {
          academic_notes: string | null
          board: string
          class: string
          created_at: string
          date_of_birth: string | null
          followup_date: string | null
          gender: string
          id: string
          name: string
          notes: string | null
          parent_email: string | null
          parent_name: string
          parent_occupation: string | null
          parent_phone: string
          previous_percentage: number | null
          previous_school: string | null
          promoted_at: string | null
          promoted_student_id: string | null
          source: string | null
          status: string
          strong_subjects: string[] | null
          updated_at: string
          weak_subjects: string[] | null
        }
        Insert: {
          academic_notes?: string | null
          board: string
          class: string
          created_at?: string
          date_of_birth?: string | null
          followup_date?: string | null
          gender: string
          id?: string
          name: string
          notes?: string | null
          parent_email?: string | null
          parent_name: string
          parent_occupation?: string | null
          parent_phone: string
          previous_percentage?: number | null
          previous_school?: string | null
          promoted_at?: string | null
          promoted_student_id?: string | null
          source?: string | null
          status?: string
          strong_subjects?: string[] | null
          updated_at?: string
          weak_subjects?: string[] | null
        }
        Update: {
          academic_notes?: string | null
          board?: string
          class?: string
          created_at?: string
          date_of_birth?: string | null
          followup_date?: string | null
          gender?: string
          id?: string
          name?: string
          notes?: string | null
          parent_email?: string | null
          parent_name?: string
          parent_occupation?: string | null
          parent_phone?: string
          previous_percentage?: number | null
          previous_school?: string | null
          promoted_at?: string | null
          promoted_student_id?: string | null
          source?: string | null
          status?: string
          strong_subjects?: string[] | null
          updated_at?: string
          weak_subjects?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "enquiries_promoted_student_id_fkey"
            columns: ["promoted_student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      page_visits: {
        Row: {
          id: string
          page_path: string
          referrer: string | null
          user_agent: string | null
          visited_at: string
        }
        Insert: {
          id?: string
          page_path?: string
          referrer?: string | null
          user_agent?: string | null
          visited_at?: string
        }
        Update: {
          id?: string
          page_path?: string
          referrer?: string | null
          user_agent?: string | null
          visited_at?: string
        }
        Relationships: []
      }
      parent_messages: {
        Row: {
          created_at: string
          id: string
          is_from_parent: boolean
          is_read: boolean
          message: string
          student_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_from_parent?: boolean
          is_read?: boolean
          message: string
          student_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_from_parent?: boolean
          is_read?: boolean
          message?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "parent_messages_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      ra_points: {
        Row: {
          created_at: string
          id: string
          last_reset: string
          points: number
          student_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_reset?: string
          points?: number
          student_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          last_reset?: string
          points?: number
          student_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      student_complaints: {
        Row: {
          complaint: string
          created_at: string
          id: string
          is_sent_to_parent: boolean | null
          sent_at: string | null
          student_id: string
          teacher_id: string
        }
        Insert: {
          complaint: string
          created_at?: string
          id?: string
          is_sent_to_parent?: boolean | null
          sent_at?: string | null
          student_id: string
          teacher_id: string
        }
        Update: {
          complaint?: string
          created_at?: string
          id?: string
          is_sent_to_parent?: boolean | null
          sent_at?: string | null
          student_id?: string
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_complaints_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_complaints_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      student_concerns: {
        Row: {
          content: string
          created_at: string
          id: string
          is_resolved: boolean
          resolved_at: string | null
          student_id: string
          title: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          is_resolved?: boolean
          resolved_at?: string | null
          student_id: string
          title: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          is_resolved?: boolean
          resolved_at?: string | null
          student_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_concerns_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      student_payments: {
        Row: {
          amount: number
          created_at: string
          id: string
          month: string
          paid_at: string | null
          status: string
          student_id: string
          year: number
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          month: string
          paid_at?: string | null
          status?: string
          student_id: string
          year: number
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          month?: string
          paid_at?: string | null
          status?: string
          student_id?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "student_payments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      students: {
        Row: {
          access_code: string
          class: string
          created_at: string
          email: string | null
          id: string
          name: string
          parent_name: string | null
          phone: string
          updated_at: string
        }
        Insert: {
          access_code: string
          class: string
          created_at?: string
          email?: string | null
          id?: string
          name: string
          parent_name?: string | null
          phone: string
          updated_at?: string
        }
        Update: {
          access_code?: string
          class?: string
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          parent_name?: string | null
          phone?: string
          updated_at?: string
        }
        Relationships: []
      }
      teacher_attendance: {
        Row: {
          attendance_date: string
          check_in_time: string | null
          check_out_time: string | null
          created_at: string
          id: string
          is_late: boolean | null
          status: string
          teacher_id: string
        }
        Insert: {
          attendance_date: string
          check_in_time?: string | null
          check_out_time?: string | null
          created_at?: string
          id?: string
          is_late?: boolean | null
          status?: string
          teacher_id: string
        }
        Update: {
          attendance_date?: string
          check_in_time?: string | null
          check_out_time?: string | null
          created_at?: string
          id?: string
          is_late?: boolean | null
          status?: string
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "teacher_attendance_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      teacher_salary_records: {
        Row: {
          base_salary: number
          bonus: number
          calculated_salary: number
          created_at: string
          days_absent: number
          days_present: number
          deductions: number
          final_salary: number
          half_days: number
          id: string
          month: string
          notes: string | null
          paid_at: string | null
          teacher_id: string
          total_days: number
          year: number
        }
        Insert: {
          base_salary?: number
          bonus?: number
          calculated_salary?: number
          created_at?: string
          days_absent?: number
          days_present?: number
          deductions?: number
          final_salary?: number
          half_days?: number
          id?: string
          month: string
          notes?: string | null
          paid_at?: string | null
          teacher_id: string
          total_days?: number
          year: number
        }
        Update: {
          base_salary?: number
          bonus?: number
          calculated_salary?: number
          created_at?: string
          days_absent?: number
          days_present?: number
          deductions?: number
          final_salary?: number
          half_days?: number
          id?: string
          month?: string
          notes?: string | null
          paid_at?: string | null
          teacher_id?: string
          total_days?: number
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "teacher_salary_records_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      teachers: {
        Row: {
          access_code: string
          assigned_classes: string[] | null
          created_at: string
          email: string | null
          expected_check_in: string | null
          expected_check_out: string | null
          id: string
          monthly_salary: number | null
          name: string
          phone: string
          updated_at: string
        }
        Insert: {
          access_code?: string
          assigned_classes?: string[] | null
          created_at?: string
          email?: string | null
          expected_check_in?: string | null
          expected_check_out?: string | null
          id?: string
          monthly_salary?: number | null
          name: string
          phone: string
          updated_at?: string
        }
        Update: {
          access_code?: string
          assigned_classes?: string[] | null
          created_at?: string
          email?: string | null
          expected_check_in?: string | null
          expected_check_out?: string | null
          id?: string
          monthly_salary?: number | null
          name?: string
          phone?: string
          updated_at?: string
        }
        Relationships: []
      }
      test_results: {
        Row: {
          created_at: string
          id: string
          is_notified: boolean
          marks_obtained: number
          photo_url: string | null
          remarks: string | null
          student_id: string
          test_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_notified?: boolean
          marks_obtained: number
          photo_url?: string | null
          remarks?: string | null
          student_id: string
          test_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_notified?: boolean
          marks_obtained?: number
          photo_url?: string | null
          remarks?: string | null
          student_id?: string
          test_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "test_results_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "test_results_test_id_fkey"
            columns: ["test_id"]
            isOneToOne: false
            referencedRelation: "tests"
            referencedColumns: ["id"]
          },
        ]
      }
      tests: {
        Row: {
          class: string
          created_at: string
          description: string | null
          id: string
          is_notified: boolean
          max_marks: number
          subject: string
          teacher_id: string | null
          test_date: string
          title: string
          updated_at: string
        }
        Insert: {
          class: string
          created_at?: string
          description?: string | null
          id?: string
          is_notified?: boolean
          max_marks?: number
          subject: string
          teacher_id?: string | null
          test_date: string
          title: string
          updated_at?: string
        }
        Update: {
          class?: string
          created_at?: string
          description?: string | null
          id?: string
          is_notified?: boolean
          max_marks?: number
          subject?: string
          teacher_id?: string | null
          test_date?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tests_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
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
    Enums: {
      app_role: ["admin", "user"],
    },
  },
} as const
