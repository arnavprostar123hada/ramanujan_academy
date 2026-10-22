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
      attendance_audit_log: {
        Row: {
          action: string
          actor_user_id: string | null
          created_at: string
          details: Json
          device_id: string | null
          id: string
          student_id: string | null
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          created_at?: string
          details?: Json
          device_id?: string | null
          id?: string
          student_id?: string | null
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          created_at?: string
          details?: Json
          device_id?: string | null
          id?: string
          student_id?: string | null
        }
        Relationships: []
      }
      attendance_kiosk_devices: {
        Row: {
          branch: string
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          last_seen_at: string | null
          name: string
          token_hash: string
        }
        Insert: {
          branch?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          last_seen_at?: string | null
          name: string
          token_hash: string
        }
        Update: {
          branch?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          last_seen_at?: string | null
          name?: string
          token_hash?: string
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
      geofence_locations: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          latitude: number
          longitude: number
          name: string
          radius_meters: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          latitude: number
          longitude: number
          name?: string
          radius_meters?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          latitude?: number
          longitude?: number
          name?: string
          radius_meters?: number
          updated_at?: string
        }
        Relationships: []
      }
      online_students: {
        Row: {
          class: string
          created_at: string
          email: string
          id: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          class?: string
          created_at?: string
          email: string
          id?: string
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          class?: string
          created_at?: string
          email?: string
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      online_test_answers: {
        Row: {
          answer_text: string | null
          created_at: string
          id: string
          is_correct: boolean | null
          marks_awarded: number | null
          question_id: string
          submission_id: string
        }
        Insert: {
          answer_text?: string | null
          created_at?: string
          id?: string
          is_correct?: boolean | null
          marks_awarded?: number | null
          question_id: string
          submission_id: string
        }
        Update: {
          answer_text?: string | null
          created_at?: string
          id?: string
          is_correct?: boolean | null
          marks_awarded?: number | null
          question_id?: string
          submission_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "online_test_answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "online_test_questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "online_test_answers_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "online_test_submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      online_test_questions: {
        Row: {
          correct_answer: string | null
          created_at: string
          id: string
          marks: number
          options: Json | null
          question_order: number
          question_text: string
          question_type: string
          test_id: string
        }
        Insert: {
          correct_answer?: string | null
          created_at?: string
          id?: string
          marks?: number
          options?: Json | null
          question_order?: number
          question_text: string
          question_type?: string
          test_id: string
        }
        Update: {
          correct_answer?: string | null
          created_at?: string
          id?: string
          marks?: number
          options?: Json | null
          question_order?: number
          question_text?: string
          question_type?: string
          test_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "online_test_questions_test_id_fkey"
            columns: ["test_id"]
            isOneToOne: false
            referencedRelation: "online_tests"
            referencedColumns: ["id"]
          },
        ]
      }
      online_test_submissions: {
        Row: {
          created_at: string
          id: string
          is_graded: boolean
          started_at: string
          status: string
          student_id: string
          submitted_at: string | null
          test_id: string
          total_marks_obtained: number | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_graded?: boolean
          started_at?: string
          status?: string
          student_id: string
          submitted_at?: string | null
          test_id: string
          total_marks_obtained?: number | null
        }
        Update: {
          created_at?: string
          id?: string
          is_graded?: boolean
          started_at?: string
          status?: string
          student_id?: string
          submitted_at?: string | null
          test_id?: string
          total_marks_obtained?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "online_test_submissions_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "online_test_submissions_test_id_fkey"
            columns: ["test_id"]
            isOneToOne: false
            referencedRelation: "online_tests"
            referencedColumns: ["id"]
          },
        ]
      }
      online_tests: {
        Row: {
          class: string
          created_at: string
          description: string | null
          duration_minutes: number
          ends_at: string | null
          id: string
          is_published: boolean
          max_marks: number
          starts_at: string | null
          subject: string
          test_type: string
          title: string
          updated_at: string
        }
        Insert: {
          class: string
          created_at?: string
          description?: string | null
          duration_minutes?: number
          ends_at?: string | null
          id?: string
          is_published?: boolean
          max_marks?: number
          starts_at?: string | null
          subject: string
          test_type?: string
          title: string
          updated_at?: string
        }
        Update: {
          class?: string
          created_at?: string
          description?: string | null
          duration_minutes?: number
          ends_at?: string | null
          id?: string
          is_published?: boolean
          max_marks?: number
          starts_at?: string | null
          subject?: string
          test_type?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
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
        Relationships: []
      }
      student_attendance_events: {
        Row: {
          actor_user_id: string | null
          attendance_date: string
          branch: string
          confidence: number | null
          corrects_event_id: string | null
          created_at: string
          device_id: string | null
          direction: string
          id: string
          idempotency_key: string
          method: string
          needs_review: boolean
          occurred_at: string
          override_reason: string | null
          review_reason: string | null
          student_id: string
        }
        Insert: {
          actor_user_id?: string | null
          attendance_date?: string
          branch?: string
          confidence?: number | null
          corrects_event_id?: string | null
          created_at?: string
          device_id?: string | null
          direction: string
          id?: string
          idempotency_key: string
          method: string
          needs_review?: boolean
          occurred_at?: string
          override_reason?: string | null
          review_reason?: string | null
          student_id: string
        }
        Update: {
          actor_user_id?: string | null
          attendance_date?: string
          branch?: string
          confidence?: number | null
          corrects_event_id?: string | null
          created_at?: string
          device_id?: string | null
          direction?: string
          id?: string
          idempotency_key?: string
          method?: string
          needs_review?: boolean
          occurred_at?: string
          override_reason?: string | null
          review_reason?: string | null
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_attendance_events_corrects_event_id_fkey"
            columns: ["corrects_event_id"]
            isOneToOne: false
            referencedRelation: "student_attendance_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_attendance_events_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "attendance_kiosk_devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_attendance_events_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      student_chat_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          mode: string
          role: string
          student_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          mode?: string
          role: string
          student_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          mode?: string
          role?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_chat_messages_student_id_fkey"
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
      student_face_consent: {
        Row: {
          granted_at: string | null
          guardian_name: string | null
          notes: string | null
          recorded_by: string | null
          revoked_at: string | null
          status: string
          student_id: string
          updated_at: string
        }
        Insert: {
          granted_at?: string | null
          guardian_name?: string | null
          notes?: string | null
          recorded_by?: string | null
          revoked_at?: string | null
          status?: string
          student_id: string
          updated_at?: string
        }
        Update: {
          granted_at?: string | null
          guardian_name?: string | null
          notes?: string | null
          recorded_by?: string | null
          revoked_at?: string | null
          status?: string
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_face_consent_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: true
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
          student_type: string
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
          student_type?: string
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
          student_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      teacher_attendance: {
        Row: {
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
          teacher_id: string
          worked_minutes: number | null
        }
        Insert: {
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
          teacher_id: string
          worked_minutes?: number | null
        }
        Update: {
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
          teacher_id?: string
          worked_minutes?: number | null
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
      zoom_links: {
        Row: {
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
      [_ in never]: never
    }
    Functions: {
      _kiosk_device: {
        Args: { p_token: string }
        Returns: {
          branch: string
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          last_seen_at: string | null
          name: string
          token_hash: string
        }
        SetofOptions: {
          from: "*"
          to: "attendance_kiosk_devices"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      _kiosk_resolve_student: { Args: { p_code: string }; Returns: string }
      _last_effective_event: {
        Args: { p_student: string }
        Returns: {
          actor_user_id: string | null
          attendance_date: string
          branch: string
          confidence: number | null
          corrects_event_id: string | null
          created_at: string
          device_id: string | null
          direction: string
          id: string
          idempotency_key: string
          method: string
          needs_review: boolean
          occurred_at: string
          override_reason: string | null
          review_reason: string | null
          student_id: string
        }
        SetofOptions: {
          from: "*"
          to: "student_attendance_events"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_staff: { Args: { _user_id: string }; Returns: boolean }
      kiosk_lookup: {
        Args: { p_code: string; p_device_token: string }
        Returns: Json
      }
      kiosk_record: {
        Args: {
          p_code: string
          p_device_token: string
          p_direction: string
          p_idempotency_key: string
        }
        Returns: Json
      }
      parent_attendance_by_code: {
        Args: { p_access_code: string }
        Returns: Json
      }
      register_kiosk_device: {
        Args: { p_branch?: string; p_name: string }
        Returns: Json
      }
      set_face_consent: {
        Args: {
          p_guardian_name?: string
          p_notes?: string
          p_status: string
          p_student_id: string
        }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "user" | "owner"
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
      app_role: ["admin", "user", "owner"],
    },
  },
} as const
