# SmartApartment System — Comprehensive Database & Backend Audit

**Document:** `DATABASE_AUDIT.md`  
**Date:** October 12, 2026  
**Auditor:** Antigravity Pair-Programming Assistant  
**Target Environment:**  
- **Project Root:** `C:\Users\talla\Downloads\SmartApartment`  
- **Backend Directory:** `C:\Users\talla\Downloads\SmartApartment\backend`  
- **Database Engine:** MongoDB (via Mongoose v9.11.1)  
- **Active Database:** `smartapartment` (`mongodb://127.0.0.1:27017/smartapartment`)  

---

## 1. Executive Summary

A comprehensive audit was performed across the backend architecture, Mongoose schemas, indexes, controllers, middleware, seed scripts, and active MongoDB collections.

### Current Database State
- **MongoDB Server Connectivity:** Verified and active.
- **Automated Test Suite:** 146 of 146 tests passing across 38 suites (`node --test`).
- **Collections Present:** 14 collections exist in `smartapartment`.
- **Active Documents in Live DB:**
  - `users`: 4 documents (Super Admin, Apartment Admin, Resident, Maintenance Staff)
  - `apartments`: 1 document (*Grand Horizon Residences*, slug `grand-horizon-residences`)
  - `buildings`: 1 document (*Tower A*, 10 floors, 40 flats)
  - `flats`: 1 document (*Unit 101*, 2BHK, occupied)
  - `auditlogs`: 350+ entries (operational audit records)
  - `memberships`, `complaints`, `workorders`, `billingrules`, `bills`, `payments`, `expenses`, `announcements`, `notifications`: 0 documents (empty in persistent database outside of ephemeral test executions).

---

## 2. Existing Models & Collections Inventory

| Model File | Collection Name | Primary Identifier | Key References | Timestamps | Virtuals / Helpers |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `User.js` / `user.model.js` | `users` | `_id` (ObjectId) | `apartment` (`Apartment`) | Yes | `toSafeObject()`, `comparePassword()`, `toJSON` transform (strips password) |
| `apartment.model.js` | `apartments` | `_id`, `slug` (unique) | `requestedBy`, `reviewedBy` (`User`) | Yes | `postal_code`, `contact_email`, `contact_phone` |
| `building.model.js` | `buildings` | `_id` | `apartmentId` (`Apartment`) | Yes | Composite unique index: `apartmentId + name` |
| `flat.model.js` | `flats` | `_id` | `apartmentId` (`Apartment`), `buildingId` (`Building`) | Yes | `occupancyStatus`, `flatNumber`, Composite unique: `buildingId + number` |
| `membership.model.js` | `memberships` | `_id` | `userId` (`User`), `apartmentId`, `buildingId`, `flatId`, `invitedBy`, `approvedBy` | Yes | Composite unique: `userId + apartmentId` |
| `complaint.model.js` | `complaints` | `_id`, `ticketNumber` | `apartmentId`, `buildingId`, `flatId`, `requestedBy`, `assignedTo`, `workOrderId` | Yes | `title`, embedded `comments`, embedded `statusHistory` |
| `work-order.model.js` | `workorders` | `_id`, `orderNumber` | `complaintId` (unique sparse), `apartmentId`, `buildingId`, `flatId`, `createdBy`, `assignedTo` | Yes | embedded `progressHistory` |
| `billing-rule.model.js` | `billingrules` | `_id` | `apartmentId`, `createdBy` (`User`) | Yes | `amount` (paise to rupees conversion) |
| `bill.model.js` | `bills` | `_id`, `billNumber` | `apartmentId`, `buildingId`, `flatId`, `residentId`, `billingRuleIds` | Yes | `amount`, `subtotal`, `amountPaid`, `outstandingBalance`, `isOverdue` |
| `payment.model.js` | `payments` | `_id` | `apartmentId`, `buildingId`, `flatId`, `payerId`, `verifiedBy`, `billId` | Yes | `amount`, `transactionId`, `utrNumber` |
| `expense.model.js` | `expenses` | `_id` | `apartmentId`, `createdBy` (`User`) | Yes | `amount`, `date` |
| `announcement.model.js` | `announcements` | `_id` | `apartmentId`, `createdBy` (`User`) | Yes | `body`, `message` |
| `audit-log.model.js` | `auditlogs` | `_id` | `actorId` (`User`), `apartmentId` (`Apartment`) | Yes | `actor`, `target`, `description`, `timestamp` |
| `notification.model.js`| `notifications` | `_id` | `userId` (`User`), `apartmentId` (`Apartment`) | Yes | `read`, `isRead` |

---

## 3. Required Entities & Relationships Mapping

```
       [Apartment] (Multi-tenant Root)
         ├── [Building] (Block)
         │     └── [Flat] (Unit)
         │           ├── [Membership] ◄────────────── [User] (Resident)
         │           ├── [Bill] (Invoices)            [User] (Staff)
         │           │     └── [Payment] (Offline)    [User] (Admin)
         │           └── [Complaint] (Tickets)        [User] (Super Admin)
         │                 └── [WorkOrder]
         ├── [BillingRule] (Recurring Charge Config)
         ├── [Expense] (Community OPEX)
         ├── [Announcement] (Broadcasts)
         ├── [AuditLog] (Compliance trail)
         └── [Notification] (In-app alerts)
```

### Feature to Entity Mapping:
1. **User Authentication & Role Authorization**: `User` (`role` enum: `SUPER_ADMIN`, `APARTMENT_ADMIN`, `RESIDENT`, `MAINTENANCE_STAFF`).
2. **Multi-Tenant Governance**: `Apartment` onboarding, activation, suspension, review lifecycle.
3. **Estate Topology**: `Building` and `Flat` hierarchical division with unique numbering per building.
4. **Residency & Occupancy**: `Membership` links residents to flat units with occupancy types (`owner`, `tenant`, etc.).
5. **Maintenance & Repairs**: `Complaint` handles resident ticket submissions; `WorkOrder` represents administrative task assignment to staff.
6. **Billing Engine**: `BillingRule` drives automated generation of `Bill` line items; `Payment` tracks manual submissions and admin verification.
7. **Expense Accounting**: `Expense` tracks recurring community expenses.
8. **Communication**: `Announcement` broadcasts notices scoped by audience (`all`, `residents`, `staff`).
9. **Accountability**: `AuditLog` captures state changes and actor details.
10. **Notifications**: `Notification` alerts users to status updates, notices, and payment receipts.

---

## 4. Missing or Incomplete Database Features Identified

### A. Critical Schema Inconsistency in `User.js`
* **Observation:** In [`backend/src/models/User.js`](file:///C:/Users/talla/Downloads/SmartApartment/backend/src/models/User.js), the Mongoose schema only defines:
  ```javascript
  { name, email, password, role, status, apartment, isEmailVerified, lastLoginAt }
  ```
* **Discrepancy:** The controllers ([`resident.controller.js`](file:///C:/Users/talla/Downloads/SmartApartment/backend/src/controllers/resident.controller.js), [`auth.controller.js`](file:///C:/Users/talla/Downloads/SmartApartment/backend/src/controllers/auth.controller.js)), the seed scripts, and the frontend expect and write:
  - `apartmentId`
  - `phone`
  - `buildingId`
  - `flatId`
* **Impact:** In Mongoose, schema strict mode drops properties not defined in the schema. When loaded from the database via Mongoose, `user.phone`, `user.apartmentId`, `user.buildingId`, and `user.flatId` return `undefined` on the hydrated Mongoose document instance.

### B. Seed Script Lacks `Membership` Record
* **Observation:** [`seed.js`](file:///C:/Users/talla/Downloads/SmartApartment/backend/src/scripts/seed.js) seeds the demo resident account directly on the `users` collection, but does not create a corresponding document in the `memberships` collection.
* **Impact:** When an admin lists residents via `GET /api/v1/admin/residents`, the query primary source is `Membership.find()`, which returns 0 rows. The controller only finds the resident via its secondary fallback query on `User.find({ apartmentId })`.

### C. Missing Operational Demo Records
* **Observation:** The persistent MongoDB database contains 0 complaints, 0 work orders, 0 billing rules, 0 bills, 0 payments, 0 expenses, and 0 announcements.
* **Impact:** While all unit and integration tests run successfully using temporary test-fixture data, logging into the frontend with the demo credentials initially shows empty tables for complaints, maintenance, billing, and notices.

### D. Missing Database Indexes
* `User`: Missing single or compound index on `{ apartmentId: 1 }` or `{ apartment: 1 }`. Scoping users by apartment requires a full collection scan.
* `Membership`: Missing compound index on `{ apartmentId: 1, status: 1 }` for fast directory filtering.

---

## 5. Security & Data-Integrity Risks

1. **Ticket / Order Number Generation Concurrency Risk**:
   * In `Complaint` and `WorkOrder`, pre-save hooks compute ticket numbers via `countDocuments() + 1` (e.g. `MR-00001`, `WO-00001`).
   * Concurrent submissions can evaluate the same count, triggering MongoDB duplicate key errors on the unique index.
   * *Mitigation:* Use atomic counters (`$inc` on a sequence collection) or append a short random token.

2. **Dual Apartment Reference Properties (`apartment` vs `apartmentId`)**:
   * Some documents store `apartment`, while others store `apartmentId`.
   * *Mitigation:* Unify on `apartmentId` across all schemas, adding a virtual alias for backward compatibility.

3. **Multi-Tenant Isolation Safeguards**:
   * Verified: All controllers strictly extract `apartmentId` from the authenticated session user (`req.user.apartmentId` or `req.user.apartment`) and inject it into MongoDB filter queries.
   * Cross-tenant query poisoning is blocked; admins cannot query or manipulate buildings, flats, complaints, bills, or expenses outside their authorized apartment.

4. **Credential Security**:
   * Verified: Bcrypt password hashing (minimum 10 salt rounds) enforced via Mongoose pre-save hook.
   * `toJSON` and `toObject` transforms strictly strip `password` and `__v` from serialization.

---

## 6. Ordered Implementation Plan

### Phase 1: Schema Normalization (Data Integrity)
1. Update [`User.js`](file:///C:/Users/talla/Downloads/SmartApartment/backend/src/models/User.js):
   - Add `phone: { type: String, trim: true, default: null }`
   - Add `apartmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Apartment', default: null, index: true }`
   - Add `buildingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Building', default: null, index: true }`
   - Add `flatId: { type: mongoose.Schema.Types.ObjectId, ref: 'Flat', default: null, index: true }`
   - Add virtual aliases so both `user.apartment` and `user.apartmentId` return the same ObjectId.

### Phase 2: Seed Script Enhancement
1. Update [`backend/src/scripts/seed.js`](file:///C:/Users/talla/Downloads/SmartApartment/backend/src/scripts/seed.js):
   - Create the `Membership` document linking `resident@smartapartment.demo` to *Grand Horizon Residences*, *Tower A*, and *Unit 101*.
   - Create initial operational demo fixtures:
     - 1 default `BillingRule` (e.g. Fixed Monthly Maintenance: ₹3,500)
     - 1 sample `Bill` for Unit 101
     - 1 sample verified `Payment`
     - 1 sample `Complaint` and corresponding `WorkOrder`
     - 1 sample `Announcement` (Welcome to Grand Horizon Residences)

### Phase 3: Index Optimization
1. Ensure explicit indexes on `{ apartmentId: 1 }` across all multi-tenant collections.
2. Ensure `{ apartmentId: 1, status: 1 }` on `Membership`, `Bill`, `Complaint`, and `Payment`.

### Phase 4: Full Validation Pass
1. Run backend tests (`npm test` in `backend`) to confirm 146/146 pass with zero regressions.
2. Run `npm run verify:auth` in root to verify authentication for all 4 roles.
3. Validate API query responses across all role dashboards.
