# CA.OS - Staff Management System PRD

## Original Problem Statement
Build a staff management application for a CA (Chartered Accountant) office with task assignments, attendance tracking, leave management, client management, query/response system, role-based access, and in-app notifications.

## User Choices
- JWT-based auth (email/password)
- 3-tier roles: Admin → Manager → Employee
- In-app notifications
- Leave management + Client management linked to tasks
- Modern/Minimal design

## Architecture
- **Backend**: FastAPI + MongoDB (Motor async) + JWT Auth
- **Frontend**: React + Tailwind CSS + Shadcn UI
- **Design**: Swiss Vault aesthetic (Navy sidebar, White content, Blue accents)

## User Personas
1. **Admin (CA Partner)**: Full access - manage employees, tasks, clients, approve leaves
2. **Manager (Senior CA)**: Assign tasks, manage clients, approve leaves, view all data
3. **Employee (Junior CA/Intern)**: View own tasks, clock in/out, apply leaves, submit queries

## What's Been Implemented (March 2026)
- JWT authentication with seeded admin (admin@caos.com / admin123)
- Dashboard with stats, recent tasks, weekly attendance chart
- Task management (CRUD, assign, status tracking, client linking)
- Attendance tracking (clock in/out, presence/absence)
- Leave management (apply, approve/reject, history)
- Client management (CRUD with PAN/GST, services)
- Query/Response system (internal communication with chat-style UI)
- In-app notifications with real-time badge
- Employee directory with role management
- Login time logging
- Role-based access control on all routes

### OTP Password Change/Reset (March 2026 - Iteration 4)
- Twilio SMS integration for OTP-based password operations
- Forgot Password flow: Login page → Enter email → OTP sent to registered phone → Verify OTP → Set new password
- Change Password flow: Dashboard sidebar → Send OTP → Verify OTP → Set new password
- Proper error handling (no phone registered, invalid OTP, expired OTP)
- Resend OTP functionality
- Phone number auto-prefixed with +91 (India) for E.164 format

### PWA Enhancement (March 2026 - Iteration 3)
- Progressive Web App manifest with installability
- Service worker for offline caching (cache-first for assets, network-first for API)
- Custom install prompt banner (bottom of screen on mobile, bottom-right on desktop)
- Offline fallback page with retry button
- Apple mobile web app meta tags
- Custom app icons (192x192, 512x512)
- Standalone display mode for native app-like experience
- Professional indigo color scheme (was dark navy blue)
- Light white sidebar with indigo active indicators
- Outfit + Figtree fonts (distinctive, professional)
- Mobile bottom tab navigation (Dashboard, Tasks, Attendance, Leaves, More)
- Mobile card views for tables (responsive breakpoints)
- Staggered entrance animations for stat cards
- Stat cards with colored left border accents
- Touch-friendly 44px+ tap targets on mobile

## Prioritized Backlog
### P0 (Critical)
- All core features implemented and tested

### P1 (High)
- Password change/reset flow
- Bulk task assignment
- Leave balance tracking (annual quotas)

### P2 (Medium)
- Export reports (attendance, tasks) to CSV/PDF
- Advanced analytics dashboard with charts
- Client document management
- Email notifications for critical events
- Task comments/activity log

### P3 (Nice to Have)
- Dark mode toggle
- Multi-language support
- Mobile app (PWA)
- Calendar view for tasks/leaves
- File attachments on tasks/queries
