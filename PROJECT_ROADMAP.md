# Public Grievance Management System (PGMS) — Project Roadmap & Task Tracker

This document tracks all completed features, active implementation layers, and upcoming project milestones for the PGMS Portal.

---

## 🟢 Completed Features & Modules (Phase 1 & Phase 2 Layers 1-2)

### 1. Authentication & Security Infrastructure
- [x] Citizen Registration & Login with `bcrypt` salted password hashing.
- [x] JWT Authentication (Access + Refresh Token rotation & `HttpOnly` cookie security).
- [x] Google OAuth 2.0 Integration (One-Tap / standard sign-in).
- [x] Profile Management & Role-Based Access Control (Citizen, Department Officer, Admin).
- [x] Password Reset Link flow via Gmail SMTP (`smtp.gmail.com:587`).
- [x] Decoupled HTML Email Template Loader (`backend/templates/emails/reset_password.html`).
- [x] SHA-256 Token Hashing at Rest in PostgreSQL database.
- [x] IP-based Rate Limiter Middleware (5 requests/minute per IP) on auth endpoints with RFC 6585 headers.
- [x] Frontend pages for `/forgot-password`, `/reset-password?token=...`, and `/login`.

### 2. Department Management
- [x] Department CRUD operations & database schema.
- [x] Officer association & department assignment.

### 3. Grievance Management Core
- [x] Grievance submission with title, description, department selection, priority, and file uploads.
- [x] Isolated Grievance Listing (Citizens see only their grievances; Officers see department grievances; Admins see all).
- [x] Grievance Status Pipeline (`Pending` ➔ `In Progress` ➔ `Resolved` / `Rejected`).

### 4. Officer & Admin Workflow Enhancements (Phase 2 - Layers 1 & 2)
- [x] **Layer 1: Grievance Assignment & Remarks Timeline**:
  - `assigned_officer_id` in `grievances` & `comments` table with `is_internal` flag.
  - REST endpoints: `POST /api/v1/grievances/{id}/assign`, `POST /api/v1/grievances/{id}/remarks`, `GET /api/v1/grievances/{id}/remarks`.
  - Officer Assignment Panel & Internal Remarks Timeline (confidential notes visible to Officers/Admins only).
- [x] **Layer 2: Automated Email Notifications**:
  - HTML Email Template for Citizens (`grievance_status_update.html`) sent when status transitions (`Pending` ➔ `In Progress` ➔ `Resolved` / `Rejected`).
  - HTML Email Template for Officers (`grievance_assignment.html`) sent when assigned to a grievance.
  - Non-blocking asynchronous email dispatcher using Go goroutines (sub-20ms API response time).

---

## 🟡 Active & Upcoming Milestones

### 🟡 Phase 2 — Layer 3: PDF Receipt & Grievance Export (Next Up)
- [ ] **PDF Generator**: Server-side / Client-side official PDF receipt download with QR code & grievance reference.

### 🔵 Phase 3: Analytics & Rating System
- [ ] **Admin & Department Dashboard**: Resolution rates, average response times, department performance charts.
- [ ] **Citizen Rating & Reopen**: Citizens rate resolved grievances (1 to 5 stars) or reopen if unsatisfied.

### 🔵 Phase 4: Advanced Real-Time Integrations
- [ ] **Real-time Notifications**: WebSockets / Server-Sent Events (SSE) for live alerts.
- [ ] **Audit Trail & System Logs**: Activity logging for administrative operations.

---

## 📝 Change Log
- **2026-09-16**: Completed Phase 2 Layer 2 (Automated HTML Email Notifications for status updates & officer assignments via async goroutines).
- **2026-09-16**: Completed Phase 2 Layer 1 (Grievance Assignment & Internal Remarks Timeline).
- **2026-09-16**: Updated comprehensive technical architecture guide for learners.
- **2026-09-16**: Completed Phase 1 Production Security Upgrades (HTML templates, SHA-256 token hashing, Rate Limiter middleware).
- **2026-09-15**: Completed Gmail SMTP Password Reset Flow & front-end reset pages.
