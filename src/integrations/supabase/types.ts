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
      academic_interventions: {
        Row: {
          action_plan: string | null
          created_at: string
          current_level: string | null
          id: string
          next_review_date: string | null
          parent_informed: boolean
          reason: string
          status: string
          student_id: string
          subject: string | null
          target_level: string | null
          teacher_id: string | null
          updated_at: string
        }
        Insert: {
          action_plan?: string | null
          created_at?: string
          current_level?: string | null
          id?: string
          next_review_date?: string | null
          parent_informed?: boolean
          reason: string
          status?: string
          student_id: string
          subject?: string | null
          target_level?: string | null
          teacher_id?: string | null
          updated_at?: string
        }
        Update: {
          action_plan?: string | null
          created_at?: string
          current_level?: string | null
          id?: string
          next_review_date?: string | null
          parent_informed?: boolean
          reason?: string
          status?: string
          student_id?: string
          subject?: string | null
          target_level?: string | null
          teacher_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "academic_interventions_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "academic_interventions_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_attendance: {
        Row: {
          admin_staff_id: string
          attendance_date: string
          check_in_distance_m: number | null
          check_in_lat: number | null
          check_in_lng: number | null
          check_in_method: string | null
          check_in_time: string | null
          check_out_distance_m: number | null
          check_out_lat: number | null
          check_out_lng: number | null
          check_out_time: string | null
          created_at: string
          geo_verified: boolean | null
          id: string
          is_late: boolean | null
          status: string
          worked_minutes: number | null
        }
        Insert: {
          admin_staff_id: string
          attendance_date: string
          check_in_distance_m?: number | null
          check_in_lat?: number | null
          check_in_lng?: number | null
          check_in_method?: string | null
          check_in_time?: string | null
          check_out_distance_m?: number | null
          check_out_lat?: number | null
          check_out_lng?: number | null
          check_out_time?: string | null
          created_at?: string
          geo_verified?: boolean | null
          id?: string
          is_late?: boolean | null
          status?: string
          worked_minutes?: number | null
        }
        Update: {
          admin_staff_id?: string
          attendance_date?: string
          check_in_distance_m?: number | null
          check_in_lat?: number | null
          check_in_lng?: number | null
          check_in_method?: string | null
          check_in_time?: string | null
          check_out_distance_m?: number | null
          check_out_lat?: number | null
          check_out_lng?: number | null
          check_out_time?: string | null
          created_at?: string
          geo_verified?: boolean | null
          id?: string
          is_late?: boolean | null
          status?: string
          worked_minutes?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_attendance_admin_staff_id_fkey"
            columns: ["admin_staff_id"]
            isOneToOne: false
            referencedRelation: "admin_staff"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_staff: {
        Row: {
          created_at: string
          email: string
          expected_check_in: string | null
          expected_check_out: string | null
          id: string
          is_active: boolean
          name: string
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email: string
          expected_check_in?: string | null
          expected_check_out?: string | null
          id?: string
          is_active?: boolean
          name: string
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string
          expected_check_in?: string | null
          expected_check_out?: string | null
          id?: string
          is_active?: boolean
          name?: string
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      admissions: {
        Row: {
          admission_date: string
          agreed_fee: number | null
          batch: string | null
          board: string | null
          class: string | null
          counsellor_id: string | null
          created_at: string
          discount: number | null
          id: string
          lead_id: string | null
          net_fee: number | null
          notes: string | null
          program: string | null
          student_id: string | null
        }
        Insert: {
          admission_date?: string
          agreed_fee?: number | null
          batch?: string | null
          board?: string | null
          class?: string | null
          counsellor_id?: string | null
          created_at?: string
          discount?: number | null
          id?: string
          lead_id?: string | null
          net_fee?: number | null
          notes?: string | null
          program?: string | null
          student_id?: string | null
        }
        Update: {
          admission_date?: string
          agreed_fee?: number | null
          batch?: string | null
          board?: string | null
          class?: string | null
          counsellor_id?: string | null
          created_at?: string
          discount?: number | null
          id?: string
          lead_id?: string | null
          net_fee?: number | null
          notes?: string | null
          program?: string | null
          student_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admissions_counsellor_id_fkey"
            columns: ["counsellor_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admissions_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admissions_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
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
      branches: {
        Row: {
          active: boolean
          address: string | null
          code: string | null
          created_at: string
          id: string
          name: string
          phone: string | null
        }
        Insert: {
          active?: boolean
          address?: string | null
          code?: string | null
          created_at?: string
          id?: string
          name: string
          phone?: string | null
        }
        Update: {
          active?: boolean
          address?: string | null
          code?: string | null
          created_at?: string
          id?: string
          name?: string
          phone?: string | null
        }
        Relationships: []
      }
      campaigns: {
        Row: {
          admission_target: number | null
          budget: number | null
          channel: string
          created_at: string
          end_date: string | null
          id: string
          lead_target: number | null
          name: string
          notes: string | null
          objective: string | null
          start_date: string | null
          status: string
          updated_at: string
        }
        Insert: {
          admission_target?: number | null
          budget?: number | null
          channel: string
          created_at?: string
          end_date?: string | null
          id?: string
          lead_target?: number | null
          name: string
          notes?: string | null
          objective?: string | null
          start_date?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          admission_target?: number | null
          budget?: number | null
          channel?: string
          created_at?: string
          end_date?: string | null
          id?: string
          lead_target?: number | null
          name?: string
          notes?: string | null
          objective?: string | null
          start_date?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      class_logs: {
        Row: {
          approval_status: string
          approved_at: string | null
          approved_by: string | null
          batch: string | null
          board: string | null
          class: string
          content: string
          created_at: string
          homework: string | null
          id: string
          log_date: string
          published_at: string | null
          subject: string | null
          teacher_id: string
          topic: string | null
        }
        Insert: {
          approval_status?: string
          approved_at?: string | null
          approved_by?: string | null
          batch?: string | null
          board?: string | null
          class: string
          content: string
          created_at?: string
          homework?: string | null
          id?: string
          log_date?: string
          published_at?: string | null
          subject?: string | null
          teacher_id: string
          topic?: string | null
        }
        Update: {
          approval_status?: string
          approved_at?: string | null
          approved_by?: string | null
          batch?: string | null
          board?: string | null
          class?: string
          content?: string
          created_at?: string
          homework?: string | null
          id?: string
          log_date?: string
          published_at?: string | null
          subject?: string | null
          teacher_id?: string
          topic?: string | null
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
      communication_templates: {
        Row: {
          active: boolean
          body: string
          category: string | null
          channel: string
          created_at: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          body: string
          category?: string | null
          channel?: string
          created_at?: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          body?: string
          category?: string | null
          channel?: string
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      communications: {
        Row: {
          channel: string
          created_at: string
          created_by: string | null
          id: string
          lead_id: string | null
          message: string | null
          parent_id: string | null
          recipient_id: string | null
          recipient_type: string
          sent_at: string | null
          status: string
          student_id: string | null
          template_id: string | null
        }
        Insert: {
          channel: string
          created_at?: string
          created_by?: string | null
          id?: string
          lead_id?: string | null
          message?: string | null
          parent_id?: string | null
          recipient_id?: string | null
          recipient_type: string
          sent_at?: string | null
          status?: string
          student_id?: string | null
          template_id?: string | null
        }
        Update: {
          channel?: string
          created_at?: string
          created_by?: string | null
          id?: string
          lead_id?: string | null
          message?: string | null
          parent_id?: string | null
          recipient_id?: string | null
          recipient_type?: string
          sent_at?: string | null
          status?: string
          student_id?: string | null
          template_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "communications_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communications_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communications_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "parents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communications_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communications_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "communication_templates"
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
          batch: string | null
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
          batch?: string | null
          board: string
          class: string
          created_at?: string
          date_of_birth?: string | null
          followup_date?: string | null
          gender?: string
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
          batch?: string | null
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
      fee_accounts: {
        Row: {
          created_at: string
          discount: number | null
          id: string
          net_fee: number
          scholarship: number | null
          student_id: string
          total_fee: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          discount?: number | null
          id?: string
          net_fee?: number
          scholarship?: number | null
          student_id: string
          total_fee?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          discount?: number | null
          id?: string
          net_fee?: number
          scholarship?: number | null
          student_id?: string
          total_fee?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fee_accounts_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      fee_installments: {
        Row: {
          amount: number
          created_at: string
          due_date: string
          fee_account_id: string
          id: string
          paid_amount: number
          status: string
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          due_date: string
          fee_account_id: string
          id?: string
          paid_amount?: number
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          due_date?: string
          fee_account_id?: string
          id?: string
          paid_amount?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fee_installments_fee_account_id_fkey"
            columns: ["fee_account_id"]
            isOneToOne: false
            referencedRelation: "fee_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      fee_payments: {
        Row: {
          amount: number
          created_at: string
          fee_account_id: string
          id: string
          notes: string | null
          payment_date: string
          payment_mode: string | null
          receipt_number: string | null
          reference_number: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          fee_account_id: string
          id?: string
          notes?: string | null
          payment_date?: string
          payment_mode?: string | null
          receipt_number?: string | null
          reference_number?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          fee_account_id?: string
          id?: string
          notes?: string | null
          payment_date?: string
          payment_mode?: string | null
          receipt_number?: string | null
          reference_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fee_payments_fee_account_id_fkey"
            columns: ["fee_account_id"]
            isOneToOne: false
            referencedRelation: "fee_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      growth_tasks: {
        Row: {
          completed_at: string | null
          created_at: string
          description: string | null
          due_at: string | null
          entity_id: string | null
          entity_type: string | null
          id: string
          owner_id: string | null
          priority: string
          status: string
          task_type: string
          title: string
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          description?: string | null
          due_at?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          owner_id?: string | null
          priority?: string
          status?: string
          task_type?: string
          title: string
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          description?: string | null
          due_at?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          owner_id?: string | null
          priority?: string
          status?: string
          task_type?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "growth_tasks_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      kpi_targets: {
        Row: {
          branch_id: string | null
          created_at: string
          id: string
          metric: string
          owner_id: string | null
          period_end: string
          period_start: string
          target_value: number
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          id?: string
          metric: string
          owner_id?: string | null
          period_end: string
          period_start: string
          target_value: number
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          id?: string
          metric?: string
          owner_id?: string | null
          period_end?: string
          period_start?: string
          target_value?: number
        }
        Relationships: [
          {
            foreignKeyName: "kpi_targets_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kpi_targets_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_activities: {
        Row: {
          activity_type: string
          completed_at: string | null
          created_at: string
          created_by: string | null
          id: string
          lead_id: string
          notes: string | null
          outcome: string | null
          scheduled_at: string | null
        }
        Insert: {
          activity_type: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          lead_id: string
          notes?: string | null
          outcome?: string | null
          scheduled_at?: string | null
        }
        Update: {
          activity_type?: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          lead_id?: string
          notes?: string | null
          outcome?: string | null
          scheduled_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_activities_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_activities_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          assigned_to: string | null
          batch: string | null
          board: string | null
          branch_id: string | null
          class: string | null
          created_at: string
          email: string | null
          expected_fee: number | null
          id: string
          interested_program: string | null
          lost_reason: string | null
          name: string
          next_follow_up_at: string | null
          notes: string | null
          parent_id: string | null
          phone: string | null
          priority: string
          source: string
          stage: string
          student_id: string | null
          updated_at: string
          whatsapp_phone: string | null
        }
        Insert: {
          assigned_to?: string | null
          batch?: string | null
          board?: string | null
          branch_id?: string | null
          class?: string | null
          created_at?: string
          email?: string | null
          expected_fee?: number | null
          id?: string
          interested_program?: string | null
          lost_reason?: string | null
          name: string
          next_follow_up_at?: string | null
          notes?: string | null
          parent_id?: string | null
          phone?: string | null
          priority?: string
          source?: string
          stage?: string
          student_id?: string | null
          updated_at?: string
          whatsapp_phone?: string | null
        }
        Update: {
          assigned_to?: string | null
          batch?: string | null
          board?: string | null
          branch_id?: string | null
          class?: string | null
          created_at?: string
          email?: string | null
          expected_fee?: number | null
          id?: string
          interested_program?: string | null
          lost_reason?: string | null
          name?: string
          next_follow_up_at?: string | null
          notes?: string | null
          parent_id?: string | null
          phone?: string | null
          priority?: string
          source?: string
          stage?: string
          student_id?: string | null
          updated_at?: string
          whatsapp_phone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "parents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_student_id_fkey"
            columns: ["student_id"]
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
      parents: {
        Row: {
          created_at: string
          email: string | null
          id: string
          name: string
          notes: string | null
          occupation: string | null
          phone: string | null
          updated_at: string
          whatsapp_phone: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          occupation?: string | null
          phone?: string | null
          updated_at?: string
          whatsapp_phone?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          occupation?: string | null
          phone?: string | null
          updated_at?: string
          whatsapp_phone?: string | null
        }
        Relationships: []
      }
      question_bank: {
        Row: {
          active: boolean
          answer_text: string | null
          batch: string | null
          board: string | null
          chapter: string | null
          class: string | null
          created_at: string
          difficulty: string | null
          explanation: string | null
          id: string
          marks: number | null
          question_text: string
          question_type: string | null
          subject: string | null
          topic: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          answer_text?: string | null
          batch?: string | null
          board?: string | null
          chapter?: string | null
          class?: string | null
          created_at?: string
          difficulty?: string | null
          explanation?: string | null
          id?: string
          marks?: number | null
          question_text: string
          question_type?: string | null
          subject?: string | null
          topic?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          answer_text?: string | null
          batch?: string | null
          board?: string | null
          chapter?: string | null
          class?: string | null
          created_at?: string
          difficulty?: string | null
          explanation?: string | null
          id?: string
          marks?: number | null
          question_text?: string
          question_type?: string | null
          subject?: string | null
          topic?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      referrals: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          referred_lead_id: string | null
          referred_student_id: string | null
          referrer_parent_id: string | null
          referrer_student_id: string | null
          reward_type: string | null
          reward_value: number | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          referred_lead_id?: string | null
          referred_student_id?: string | null
          referrer_parent_id?: string | null
          referrer_student_id?: string | null
          reward_type?: string | null
          reward_value?: number | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          referred_lead_id?: string | null
          referred_student_id?: string | null
          referrer_parent_id?: string | null
          referrer_student_id?: string | null
          reward_type?: string | null
          reward_value?: number | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "referrals_referred_lead_id_fkey"
            columns: ["referred_lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referrals_referred_student_id_fkey"
            columns: ["referred_student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referrals_referrer_parent_id_fkey"
            columns: ["referrer_parent_id"]
            isOneToOne: false
            referencedRelation: "parents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referrals_referrer_student_id_fkey"
            columns: ["referrer_student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      renewals: {
        Row: {
          assigned_to: string | null
          created_at: string
          current_program: string | null
          due_date: string | null
          expected_fee: number | null
          id: string
          notes: string | null
          renewal_program: string | null
          renewed_at: string | null
          status: string
          student_id: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string
          current_program?: string | null
          due_date?: string | null
          expected_fee?: number | null
          id?: string
          notes?: string | null
          renewal_program?: string | null
          renewed_at?: string | null
          status?: string
          student_id: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          created_at?: string
          current_program?: string | null
          due_date?: string | null
          expected_fee?: number | null
          id?: string
          notes?: string | null
          renewal_program?: string | null
          renewed_at?: string | null
          status?: string
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "renewals_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "renewals_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      student_attendance: {
        Row: {
          attendance_date: string
          created_at: string
          id: string
          remarks: string | null
          status: string
          student_id: string
        }
        Insert: {
          attendance_date: string
          created_at?: string
          id?: string
          remarks?: string | null
          status?: string
          student_id: string
        }
        Update: {
          attendance_date?: string
          created_at?: string
          id?: string
          remarks?: string | null
          status?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_attendance_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
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
      student_progress_reviews: {
        Row: {
          academic_level: string | null
          action_plan: string | null
          attendance_pct: number | null
          created_at: string
          gaps: string | null
          id: string
          next_review_date: string | null
          parent_contacted: boolean
          review_date: string
          strengths: string | null
          student_id: string
          teacher_id: string | null
        }
        Insert: {
          academic_level?: string | null
          action_plan?: string | null
          attendance_pct?: number | null
          created_at?: string
          gaps?: string | null
          id?: string
          next_review_date?: string | null
          parent_contacted?: boolean
          review_date?: string
          strengths?: string | null
          student_id: string
          teacher_id?: string | null
        }
        Update: {
          academic_level?: string | null
          action_plan?: string | null
          attendance_pct?: number | null
          created_at?: string
          gaps?: string | null
          id?: string
          next_review_date?: string | null
          parent_contacted?: boolean
          review_date?: string
          strengths?: string | null
          student_id?: string
          teacher_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "student_progress_reviews_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      student_subjects: {
        Row: {
          created_at: string
          current_marks: number | null
          id: string
          status: string | null
          student_id: string
          subject: string
          target_marks: number | null
          teacher_id: string | null
          updated_at: string
          weak_topics: string | null
        }
        Insert: {
          created_at?: string
          current_marks?: number | null
          id?: string
          status?: string | null
          student_id: string
          subject: string
          target_marks?: number | null
          teacher_id?: string | null
          updated_at?: string
          weak_topics?: string | null
        }
        Update: {
          created_at?: string
          current_marks?: number | null
          id?: string
          status?: string | null
          student_id?: string
          subject?: string
          target_marks?: number | null
          teacher_id?: string | null
          updated_at?: string
          weak_topics?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "student_subjects_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_subjects_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      students: {
        Row: {
          academic_year: string | null
          access_code: string | null
          admission_date: string | null
          batch: string | null
          board: string | null
          branch_id: string | null
          class: string
          created_at: string
          email: string | null
          id: string
          legacy_id: string | null
          name: string
          parent_id: string | null
          parent_name: string | null
          phone: string | null
          status: string
          student_type: string | null
          updated_at: string
        }
        Insert: {
          academic_year?: string | null
          access_code?: string | null
          admission_date?: string | null
          batch?: string | null
          board?: string | null
          branch_id?: string | null
          class: string
          created_at?: string
          email?: string | null
          id?: string
          legacy_id?: string | null
          name: string
          parent_id?: string | null
          parent_name?: string | null
          phone?: string | null
          status?: string
          student_type?: string | null
          updated_at?: string
        }
        Update: {
          academic_year?: string | null
          access_code?: string | null
          admission_date?: string | null
          batch?: string | null
          board?: string | null
          branch_id?: string | null
          class?: string
          created_at?: string
          email?: string | null
          id?: string
          legacy_id?: string | null
          name?: string
          parent_id?: string | null
          parent_name?: string | null
          phone?: string | null
          status?: string
          student_type?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "students_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "students_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "parents"
            referencedColumns: ["id"]
          },
        ]
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
      teacher_daily_reports: {
        Row: {
          classes_taken: number
          created_at: string
          id: string
          report_date: string
          report_text: string | null
          students_needing_attention: number
          submitted_at: string
          teacher_id: string | null
          topics_completed: number
        }
        Insert: {
          classes_taken?: number
          created_at?: string
          id?: string
          report_date?: string
          report_text?: string | null
          students_needing_attention?: number
          submitted_at?: string
          teacher_id?: string | null
          topics_completed?: number
        }
        Update: {
          classes_taken?: number
          created_at?: string
          id?: string
          report_date?: string
          report_text?: string | null
          students_needing_attention?: number
          submitted_at?: string
          teacher_id?: string | null
          topics_completed?: number
        }
        Relationships: []
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
          approval_status: string
          approved_at: string | null
          approved_by: string | null
          created_at: string
          id: string
          is_notified: boolean
          marks_obtained: number
          photo_url: string | null
          published_at: string | null
          remarks: string | null
          student_id: string
          test_id: string
          updated_at: string
        }
        Insert: {
          approval_status?: string
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          id?: string
          is_notified?: boolean
          marks_obtained: number
          photo_url?: string | null
          published_at?: string | null
          remarks?: string | null
          student_id: string
          test_id: string
          updated_at?: string
        }
        Update: {
          approval_status?: string
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          id?: string
          is_notified?: boolean
          marks_obtained?: number
          photo_url?: string | null
          published_at?: string | null
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
          approval_status: string
          approved_at: string | null
          approved_by: string | null
          batch: string | null
          board: string | null
          class: string
          created_at: string
          description: string | null
          id: string
          is_notified: boolean
          max_marks: number
          published_at: string | null
          subject: string
          teacher_id: string | null
          test_date: string
          title: string
          updated_at: string
        }
        Insert: {
          approval_status?: string
          approved_at?: string | null
          approved_by?: string | null
          batch?: string | null
          board?: string | null
          class: string
          created_at?: string
          description?: string | null
          id?: string
          is_notified?: boolean
          max_marks?: number
          published_at?: string | null
          subject: string
          teacher_id?: string | null
          test_date: string
          title: string
          updated_at?: string
        }
        Update: {
          approval_status?: string
          approved_at?: string | null
          approved_by?: string | null
          batch?: string | null
          board?: string | null
          class?: string
          created_at?: string
          description?: string | null
          id?: string
          is_notified?: boolean
          max_marks?: number
          published_at?: string | null
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
      user_profiles: {
        Row: {
          active: boolean
          created_at: string
          full_name: string | null
          id: string
          phone: string | null
          role: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          full_name?: string | null
          id: string
          phone?: string | null
          role?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          role?: string
          updated_at?: string
        }
        Relationships: []
      }
      zoom_links: {
        Row: {
          batch: string | null
          board: string | null
          class: string
          created_at: string
          id: string
          is_active: boolean
          meeting_id: string | null
          passcode: string | null
          schedule_day: string
          schedule_time: string
          subject: string
          teacher_name: string | null
          updated_at: string
          zoom_url: string
        }
        Insert: {
          batch?: string | null
          board?: string | null
          class: string
          created_at?: string
          id?: string
          is_active?: boolean
          meeting_id?: string | null
          passcode?: string | null
          schedule_day: string
          schedule_time: string
          subject: string
          teacher_name?: string | null
          updated_at?: string
          zoom_url: string
        }
        Update: {
          batch?: string | null
          board?: string | null
          class?: string
          created_at?: string
          id?: string
          is_active?: boolean
          meeting_id?: string | null
          passcode?: string | null
          schedule_day?: string
          schedule_time?: string
          subject?: string
          teacher_name?: string | null
          updated_at?: string
          zoom_url?: string
        }
        Relationships: []
      }
    }
    Views: {
      growth_dashboard: {
        Row: {
          admissions_this_month: number | null
          collections_this_month: number | null
          followups_due: number | null
          open_leads: number | null
          open_renewals: number | null
          overdue_tasks: number | null
          pending_referrals: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      get_my_access_profile: {
        Args: never
        Returns: {
          active: boolean
          full_name: string
          role: string
        }[]
      }
      is_admin_or_owner: { Args: never; Returns: boolean }
      refresh_overdue_installments: { Args: never; Returns: undefined }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
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
    Enums: {},
  },
} as const
