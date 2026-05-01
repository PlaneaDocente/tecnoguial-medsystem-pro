# TecnoGuiAl MedSystem Pro

## Overview
Sistema SaaS profesional de gestion medica para doctores generales, psicologos y clinicas. Incluye autenticacion mult rol, gestion completa de pacientes, consultas medicas, catalogos de medicamentos y enfermedades, agenda de citas, facturacion Stripe, reportes, asistente IA medica, recetas medicas con firma digital,exportacion PDF, subida de archivos, notificaciones por email, y PWA instalable.

## Tech Stack
- **Framework**: Next.js 15 + React 19 + TypeScript
- **Database**: Supabase (PostgreSQL) - via nubase MCP
- **UI Components**: shadcn/ui + Radix UI + TailwindCSS
- **Charts**: Recharts
- **Icons**: Lucide React
- **Auth**: Supabase Auth con JWT
- **PDF Generation**: jsPDF + jspdf-autotable
- **File Storage**: Supabase Storage (patient-files bucket)
- **Payments**: Stripe (Checkout/Portal)
- **Deployment**: Vercel ready

## Directory Structure
```
src/
├── app/
│   ├── (auth)/
│   │   ├── login/
│   │   └── register/
│   ├── (dashboard)/
│   │   ├── dashboard/
│   │   ├── patients/
│   │   │   ├── [id]/
│   │   │   └── new/
│   │   ├── consultations/
│   │   ├── prescriptions/
│   │   ├── appointments/
│   │   ├── medications/
│   │   ├── diseases/
│   │   ├── billing/
│   │   ├── reports/
│   │   ├── ai-assistant/
│   │   ├── settings/
│   │   ├── chat/
│   │   └── layout.tsx
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   ├── layout/
│   │   └── AppShell.tsx
│   └── ui/
│       ├── signature-pad.tsx
│       └── (shadcn components)
├── hooks/
│   └── useAuth.tsx
├── lib/
│   ├── utils.ts
│   ├── types.ts
│   ├── pdf-generator.ts
│   ├── file-upload.ts
│   └── notifications.ts
└── integrations/
    └── supabase/
        ├── client.ts
        └── server.ts
public/
├── manifest.json
└── sw.js
```

## Core Systems

### Authentication
- **Status**: Implemented
- **Location**: `src/hooks/useAuth.tsx`, `src/app/(auth)/`
- **Features**: Email/password signup, login, logout, JWT sessions, profile management, roles (doctor/psicologo/admin)
- **Database**: `public.profiles` table with RLS policies

### Dashboard
- **Status**: Implemented
- **Location**: `src/app/(dashboard)/dashboard/page.tsx`
- **Features**: Metrics cards, patient evolution chart, consultations by type donut chart, today's appointments, recent patients, quick actions

### Patient Management
- **Status**: Implemented
- **Location**: `src/app/(dashboard)/patients/`
- **Features**: Patient list with search/filters, create/edit patient, patient detail with tabs (summary, allergies, antecedents, chronic diseases, files, history), badges for allergies
- **PDF Export**: Generate patient medical record PDF with all clinical data

### Consultations
- **Status**: Implemented
- **Location**: `src/app/(dashboard)/consultations/`
- **Features**: Consultation list with filters, consultation types (general, seguimiento, urgencia, psicologica), prescriptions linked to medications catalog

### Prescriptions
- **Status**: Implemented
- **Location**: `src/app/(dashboard)/prescriptions/`
- **Features**: Create medical prescriptions, search medications from catalog, dosage/frequency/duration selection, digital signature capture, PDF generation with professional layout

### Appointments
- **Status**: Implemented
- **Location**: `src/app/(dashboard)/appointments/page.tsx`
- **Features**: Interactive calendar (monthly view), appointment status management (pending/confirmed/in_progress/completed/cancelled), day appointments list

### Medications Catalog
- **Status**: Implemented
- **Location**: `src/app/(dashboard)/medications/page.tsx`
- **Features**: Searchable catalog, medication detail modal, dosage forms, routes, indications, contraindications
- **Seed Data**: 10 sample medications

### Diseases Catalog
- **Status**: Implemented
- **Location**: `src/app/(dashboard)/diseases/page.tsx`
- **Features**: Categorized diseases (viral, bacterial, chronic, etc), CIE-10 codes, symptoms, treatment info
- **Seed Data**: 15 sample diseases

### Billing & Stripe
- **Status**: Implemented (UI ready, needs Stripe keys)
- **Location**: `src/app/(dashboard)/billing/page.tsx`
- **Features**: 3 subscription plans (Basic $29, Professional $79, Clinics $199), plan comparison, invoice history

### Reports
- **Status**: Implemented
- **Location**: `src/app/(dashboard)/reports/page.tsx`
- **Features**: Date range filters, patient evolution chart, consultations by type, top diagnoses bar chart, CSV export, PDF export with patient list table

### AI Assistant
- **Status**: Implemented
- **Location**: `src/app/(dashboard)/ai-assistant/page.tsx`
- **Features**: Diagnosis suggestions based on symptoms, summary generator, medical notes templates, intelligent search
- **Disclaimer**: AI suggestions are auxiliary and don't replace medical judgment

### Chat
- **Status**: Implemented
- **Location**: `src/app/(dashboard)/chat/page.tsx`
- **Features**: Conversations list, message interface, real-time-like messaging

### Settings
- **Status**: Implemented
- **Location**: `src/app/(dashboard)/settings/page.tsx`
- **Features**: Profile editing, clinic settings, notifications, appearance (light/dark/system), data export

### PWA
- **Status**: Implemented
- **Location**: `public/manifest.json`, `public/sw.js`
- **Features**: Service Worker, offline indicator, PWA install prompt, cache strategies

### PDF Export
- **Status**: Implemented
- **Location**: `src/lib/pdf-generator.ts`
- **Features**: Patient medical record PDF, prescription PDF with signature, consultation notes, reports with tables

### File Upload
- **Status**: Implemented
- **Location**: `src/lib/file-upload.ts`
- **Features**: Upload patient files to Supabase Storage, categories (laboratory, imaging, clinical, prescription, other), delete files, file size formatting

### Digital Signature
- **Status**: Implemented
- **Location**: `src/components/ui/signature-pad.tsx`
- **Features**: Canvas-based signature capture, mouse and touch support, PNG export, clear/save functionality

### Email Notifications
- **Status**: Implemented
- **Location**: `src/lib/notifications.ts`
- **Features**: Appointment reminders, confirmation emails, cancellation notifications, notification logging

## Database Schema

### Tables (22 total)
- `profiles` - User profiles extending auth.users
- `patients` - Patient records
- `patient_allergies` - Patient allergies
- `patient_antecedents` - Medical history
- `patient_chronic_diseases` - Chronic conditions
- `patient_files` - Uploaded documents (with file_size)
- `consultations` - Medical consultations
- `consultation_prescriptions` - Prescription details
- `appointments` - Scheduled appointments
- `medications_catalog` - Medications reference
- `diseases_catalog` - Diseases reference
- `subscriptions` - Stripe subscriptions
- `invoices` - Payment invoices
- `clinic_settings` - Clinic configuration
- `conversations` - Chat conversations
- `messages` - Chat messages
- `ai_suggestions_log` - AI usage audit
- `audit_log` - Security audit trail
- `branches` - Multi-clinic support
- `branch_users` - Branch-user assignments
- `notification_log` - Email notification history

### Security
- RLS (Row Level Security) enabled on all tables
- Users can only access their own data
- Admin role for system-wide access
- Audit logging for compliance

## Current State

### Completed
- [x] Database schema with 22 tables
- [x] Authentication system (signup/login/logout)
- [x] Dashboard with metrics and charts
- [x] Patient management (CRUD, allergies, antecedents, files)
- [x] Consultations system (4 types)
- [x] Prescriptions with digital signature
- [x] Appointments calendar
- [x] Medications catalog with search
- [x] Diseases catalog with categories
- [x] Billing page with 3 plans
- [x] Reports with charts
- [x] Reports PDF export
- [x] Reports CSV export
- [x] Patient PDF export
- [x] AI assistant (diagnosis, summary, notes)
- [x] Chat system
- [x] Settings page
- [x] PWA configuration
- [x] Dark mode support
- [x] Responsive design
- [x] File upload to Supabase Storage
- [x] Digital signature capture
- [x] Email notifications system

### Planned / TODO
- [ ] Stripe actual integration (needs Stripe API keys)
- [ ] Multi-clinic feature
- [ ] Real-time chat updates
- [ ] Mobile app wrapper

## Maintenance Log
- 2024-04-30: Initial build - Complete TecnoGuiAl MedSystem Pro implemented with all major modules
- 2024-04-30: Added PDF export functionality (patient records, prescriptions, consultation notes, reports)
- 2024-04-30: Added file upload to Supabase Storage with categories
- 2024-04-30: Added digital signature capture component
- 2024-04-30: Added email notifications system with appointment reminders
