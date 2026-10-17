# SmartApartment — Local Development Demo Accounts Setup

This document outlines the local development demo account specifications, relational models, seeding script, and backend integration requirements for the SmartApartment system.

---

## 1. Configured Development Demo Accounts

The following four role accounts are configured for local development and testing:

| Role | Role Key | Email | Development Password | Scope & Description |
|---|---|---|---|---|
| **Super Admin** | `super_admin` | `superadmin@smartapartment.demo` | `SuperAdmin@123!` | Platform-wide privileges (approvals, audit logs, apartment onboarding) |
| **Apartment Admin** | `admin` | `admin@smartapartment.demo` | `Admin@123!` | Authorized administrator for *Grand Horizon Residences* |
| **Resident** | `resident` | `resident@smartapartment.demo` | `Resident@123!` | Resident assigned to *Tower A, Flat 101* in *Grand Horizon Residences* |
| **Maintenance Staff** | `staff` | `staff@smartapartment.demo` | `Staff@123!` | Operations staff assigned to *Grand Horizon Residences* |

> **Security Rule**: These accounts are strictly for local development and testing. Passwords must never be stored in plaintext and must always be hashed using bcrypt (cost factor $\ge 10$).

---

## 2. Relational Hierarchy & Schemas

The frontend expects the following relational hierarchy for user accounts and apartments:

```
[Apartment] (Grand Horizon Residences, slug: grand-horizon-residences, status: approved)
    ├── [Building] (Tower A, floors: 10, totalFlats: 40)
    │       └── [Flat] (Unit 101, floor: 1, type: 2BHK, status: occupied)
    │               └── [User: Alex Rivera] (role: resident)
    ├── [User: Horizon Community Admin] (role: admin, apartmentId: <apartment._id>)
    └── [User: Sam Morgan] (role: staff, apartmentId: <apartment._id>)

[User: Platform Super Admin] (role: super_admin, no apartmentId required)
```

### User Model Schema
* **`email`**: String, unique, lowercase, trimmed.
* **`password`**: String, hashed using bcrypt (10 rounds).
* **`role`**: Enum: `super_admin`, `admin`, `resident`, `staff`.
* **`status`**: String: `active` (must be `active` to allow login; `pending_approval` and `suspended` are blocked).
* **`apartmentId`**: ObjectId/UUID ref to `Apartment` (required for `admin`, `resident`, `staff`).
* **`buildingId`**: ObjectId/UUID ref to `Building` (required for `resident`).
* **`flatId`**: ObjectId/UUID ref to `Flat` (required for `resident`).

---

## 3. Current Environment Status & Blockers

* **Project Structure**: `C:\Users\talla\Downloads\SmartApartment` is a **frontend-only SPA** (Vite + React 19).
* **Port 5000 / Backend Connection**:
  * Tested via: `Test-NetConnection -ComputerName localhost -Port 5000`
  * Result: **TCP connect failed** (`TcpTestSucceeded: False`).
  * No backend process is currently listening on port 5000.
* **Database**: No local MongoDB or SQL database is currently connected in this folder.
* **Honest Audit Reporting**: In accordance with the system rules, we do **not** claim the accounts are created in the database or that login succeeded, because the backend and database are currently offline.

---

## 4. Execution Commands

### To run frontend:
```bash
npm run dev
```
Runs the Vite dev server at `http://localhost:5173/`.

### To build frontend:
```bash
npm run build
```
Builds the production bundle into `/dist`.

### To seed demo accounts (when MongoDB is running):
```bash
# If using MongoDB:
MONGODB_URI=mongodb://localhost:27017/smartapartment npm run seed
```

### To verify account authentication against the backend API:
```bash
npm run verify:auth
```
Tests `POST http://localhost:5000/api/v1/auth/login` for each of the 4 demo accounts and reports the HTTP status code.
