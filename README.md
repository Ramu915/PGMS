# Public Grievance Management System (PGMS)

A full-stack civic grievance platform designed to streamline public complaint redressal across Karnataka's 31 districts. Built with a compiled **Go (Chi)** backend, **PostgreSQL**, and a **React 19 (TypeScript)** frontend.

The system handles the entire grievance lifecycle: photo-based geo-tagging, automated administrative routing, role-based workflows for citizens and officers, and asynchronous status notifications.

---

## System Architecture

The backend is built as a clean modular monolith in Go, separating concerns into domain modules (`auth`, `districts`, `departments`, `grievances`). The frontend uses TanStack Router and Query for client-side state caching and route management.

![System Flowchart](pgms_architecture_flowchart.png)

<details>
  <summary>View Layered Architecture & Database Schema</summary>
  <br/>

  ### Layered Architecture
  ![Layered Architecture](pgms_layered_architecture_diagram.png)

  ### Relational Database Schema
  ![Database ERD](pgms_database_relationship_diagram.png)
</details>

---

## Why This Project? (Key Engineering Problems Solved)

In many civic portals, complaints get delayed or lost due to two main issues:
1. **Location ambiguity:** Citizens describe locations vaguely, making it hard to know which municipal ward or taluk is responsible.
2. **Wrong routing:** Complaints get sent to the wrong department or level of government, requiring manual sorting.

PGMS addresses these issues through:

### 1. In-Browser EXIF GPS Extraction
When a citizen uploads a photo of an issue (such as a broken road or water leakage), the frontend reads the raw JPEG binary markers (`0xFFE1` APP1 and `0x8825` GPS IFD) directly in the browser using `exifreader`. This extracts the camera's satellite coordinates before upload, ensuring the photo was taken on-site and preventing manual location spoofing.

### 2. Reverse Geocoding & Cascading Jurisdictions
The extracted coordinates are translated into structured street landmarks via OpenStreetMap / Nominatim. The UI dynamically loads Karnataka's 31 districts and their respective taluks/municipal bodies (`/api/v1/districts/{id}/taluks`), binding the grievance directly to the responsible local office.

### 3. Automated Government Email Engine (`pkg/govdomain`)
To keep communications professional and isolated from personal mailboxes, the Go backend generates standardized government email aliases when officers are onboarded:
```
[role].[department].[taluk].[district]@karnataka.gov.in
e.g. aee.pwd.yelahanka.bengaluru@karnataka.gov.in
```
A cryptographically secure temporary password (`crypto/rand`) is generated, hashed with salted `bcrypt` (cost 10), and emailed to the officer.

### 4. Non-Blocking Async Email Worker (Goroutines)
Connecting to external SMTP gateways (`smtp.gmail.com:587`) can introduce 1–3 seconds of latency. Instead of blocking the HTTP response, the API delegates email delivery (status transitions, officer assignments, password resets) to lightweight background Goroutines. The API returns in **under 20ms**.

### 5. Multi-Tier Role-Based Access Control (RBAC)
- **Citizen:** Can submit grievances, upload photo evidence, track status history, and view self-submitted issues.
- **Taluk / Municipal Officer:** Access is strictly scoped to their assigned `(district_id, taluk_id, department_id)`. Officers can update statuses and leave internal remarks on an audit timeline.
- **District Deputy Commissioner (DC):** High-level view across all departments and taluks within their district.
- **State Admin:** Manages departments, provisions officer credentials, and oversees state-wide metrics.

---

## Tech Stack

- **Backend:** Go 1.27, Chi Router v5, `lib/pq` (PostgreSQL driver)
- **Database:** PostgreSQL 16 (relational schema with cascading foreign keys and composite indexes)
- **Auth & Security:** JWT (Access + HttpOnly Refresh tokens), Google OAuth 2.0, `golang.org/x/crypto/bcrypt`, sliding-window IP rate limiter
- **Frontend:** React 19, TypeScript, TanStack Router, TanStack Query, Tailwind CSS v4, Radix UI
- **Tooling:** ExifReader (GPS extraction), Tesseract.js (OCR), Docker & Docker Compose

---

## Project Structure

```
├── backend/
│   ├── cmd/api/main.go           # Server entry point & route definitions
│   ├── internal/
│   │   ├── config/               # Environment & database config
│   │   ├── database/             # PostgreSQL connection pool & migrations
│   │   ├── middleware/           # Auth, CORS, IP Rate Limiter, Logger
│   │   └── modules/
│   │       ├── auth/             # Login, Register, OAuth, Password Reset
│   │       ├── departments/      # Department CRUD & assignments
│   │       ├── districts/        # 31 Karnataka Districts & Taluks
│   │       └── grievances/       # Submission, assignment, status pipeline
│   ├── pkg/
│   │   ├── govdomain/            # Standardized government email generator
│   │   ├── jwt/                  # Token creation & claims validation
│   │   └── mailer/               # Goroutine SMTP dispatcher & HTML templates
│   ├── templates/emails/         # Responsive HTML email templates
│   └── migrations/               # SQL migration scripts (000001 - 000012)
│
├── frontend/
│   ├── src/
│   │   ├── api/                  # Axios HTTP client, interceptors & endpoint hooks
│   │   ├── components/           # Reusable UI components & Radix primitives
│   │   ├── routes/               # File-based routes (/grievances, /admin, /login)
│   │   └── lib/                  # EXIF GPS parser, reverse geocoder
│   ├── package.json
│   └── vite.config.ts
```

---

## API Reference

All endpoints are versioned under `/api/v1`:

### Auth
| Method | Route | Description | Auth |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/auth/register` | Register new citizen | Public |
| `POST` | `/api/v1/auth/login` | Email/password login, returns JWT | Public |
| `POST` | `/api/v1/auth/google` | Google One-Tap / OAuth sign-in | Public |
| `POST` | `/api/v1/auth/forgot-password` | Sends password reset email | Public |
| `POST` | `/api/v1/auth/reset-password` | Resets password with valid token | Public |
| `GET`  | `/api/v1/auth/me` | Current authenticated user profile | Bearer Token |

### Districts & Taluks
| Method | Route | Description | Auth |
| :--- | :--- | :--- | :--- |
| `GET`  | `/api/v1/districts` | List all 31 Karnataka districts | Public |
| `GET`  | `/api/v1/districts/{id}/taluks` | List taluks / municipal bodies for a district | Public |
| `POST` | `/api/v1/districts/officers/onboard` | Provision `@karnataka.gov.in` officer account | Admin |

### Grievances
| Method | Route | Description | Auth |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/grievances` | Submit grievance (title, department, photo, coords) | Optional / User |
| `GET`  | `/api/v1/grievances` | List grievances (scoped by user role & jurisdiction) | Bearer Token |
| `GET`  | `/api/v1/grievances/{id}` | Get full details, updates, and remarks | Bearer Token |
| `PATCH`| `/api/v1/grievances/{id}/status` | Update status (`Pending` -> `In Progress` -> `Resolved`) | Officer / Admin |
| `POST` | `/api/v1/grievances/{id}/assign` | Assign grievance to specific officer | Admin / DC |
| `POST` | `/api/v1/grievances/{id}/remarks` | Add internal confidential remark | Officer / Admin |
| `GET`  | `/api/v1/grievances/{id}/remarks` | List remarks history | Officer / Admin |

---

## Getting Started Locally

### Prerequisites
- **Go** 1.22+
- **Node.js** 18+ & npm
- **PostgreSQL** 14+

### 1. Database Setup
Create a PostgreSQL database:
```sql
CREATE DATABASE pgms_db;
```

Run the SQL migrations located in `backend/migrations/` using your preferred migration tool (or psql):
```bash
# Example with golang-migrate:
migrate -path backend/migrations -database "postgres://postgres:password@localhost:5432/pgms_db?sslmode=disable" up
```

### 2. Backend Setup
1. Navigate to `backend`:
   ```bash
   cd backend
   ```
2. Copy `.env.example` to `.env` and fill in your values:
   ```bash
   cp .env.example .env
   ```
   Key variables:
   ```env
   PORT=8080
   DB_HOST=localhost
   DB_PORT=5432
   DB_USER=postgres
   DB_PASSWORD=your_password
   DB_NAME=pgms_db
   DB_SSLMODE=disable
   JWT_SECRET=your_jwt_secret_key_here
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_EMAIL=your-email@gmail.com
   SMTP_PASSWORD=your-app-password
   FRONTEND_URL=http://localhost:5173
   ```
3. Run the Go server:
   ```bash
   go run ./cmd/api
   ```
   The backend will start at `http://localhost:8080/api/v1`.

### 3. Frontend Setup
1. Open a new terminal and navigate to `frontend`:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create `.env`:
   ```env
   VITE_API_BASE_URL=http://localhost:8080/api/v1
   ```
4. Start the Vite dev server:
   ```bash
   npm run dev
   ```
   Open `http://localhost:5173` in your browser.

---

## Security Implementation

- **Password Security:** Hashed using `bcrypt` with cost factor 10.
- **Token Hashing at Rest:** Single-use password reset tokens are stored as `SHA-256` hashes in the database so leaks do not expose valid reset links.
- **Rate Limiting:** Auth routes are protected by an in-memory IP rate limiter (5 requests per minute per IP), responding with HTTP `429 Too Many Requests` and RFC 6585 retry headers.
- **Graceful Shutdown:** The HTTP server listens for `SIGINT` / `SIGTERM` signals and uses a 30-second context timeout to finish ongoing requests before closing database pools.

---

## License

This project is licensed under the [MIT License](LICENSE).
