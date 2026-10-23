# Employee Asset Management System

I want you to build a complete, production-ready **Employee Asset Management System** for companies to manage physical assets assigned to employees.

The application should be designed as a modern SaaS-style business application, with a clean, professional, simple UI that non-technical company staff can easily use.

## 1. Core Concept

The system manages the complete lifecycle of company assets:

```text
Purchase
   ↓
Available
   ↓
Assigned to Employee
   ↓
Transferred / Reassigned
   ↓
Repair / Maintenance
   ↓
Assigned Again
   ↓
Returned
   ↓
Retired
   ↓
Disposed
```

Typical assets include:

* Laptops
* Desktop computers
* Monitors
* Mobile phones
* Tablets
* Keyboards
* Mice
* Headsets
* Webcams
* Docking stations
* Chargers
* Laptop bags
* Printers
* Routers
* Office equipment
* Access cards
* Other company-owned equipment

The most important requirement is **complete asset history**.

Never lose historical information when an asset is assigned, returned, transferred, repaired, or disposed.

---

#  Important i duplicated my enscone project which already having foundation like auth,theme,tool, resuable components, role, permisionsm, menu format. 

# 2. Technology Stack

Use the following architecture:

## Backend

* Laravel
* PHP
* MySQL
* Laravel Sanctum for authentication
* Spatie Laravel Permission for roles and permissions
* REST API architecture
* Ingnore resourceclass, action class
* use repository pattern
* use request class 


## Frontend

* Next.js App Router
* JavaScript, NOT TypeScript
* Tailwind CSS
* shadcn/ui
* ReUI/shadcn-style components where appropriate

Use clean reusable components.

Do not create unnecessarily complicated abstractions.

Follow standard Laravel and Next.js best practices.

---

# 3. Authentication

Use a single authentication system.

Do NOT create completely separate authentication systems for employees and administrators.

Use:

```text
users
```

with roles and permissions.

Example roles:

```text
Super Admin
Asset Manager
IT Admin
HR
Employee
Viewer / Auditor
```

After login, redirect the user to the appropriate dashboard based on their role.

Example:

```text
Admin Login
    ↓
Admin Dashboard

Employee Login
    ↓
Employee Dashboard
```

Employees must only be able to access their own permitted information.

An employee must NEVER be able to see another employee's assigned assets.

---

# 4. Roles & Permissions

## Super Admin

Full access to the entire application.

Can:

* Manage users
* Manage employees
* Manage assets
* Manage categories
* Manage locations
* Assign assets
* Return assets
* Transfer assets
* Manage repairs
* Manage maintenance
* Manage vendors
* Manage documents
* Manage requests
* Manage employee offboarding
* View reports
* View audit logs
* Configure system settings

## Asset Manager / IT Admin

Can:

* View employees
* Create assets
* Edit assets
* Assign assets
* Return assets
* Transfer assets
* Manage repairs
* Manage maintenance
* Manage asset documents
* Manage QR codes
* View asset history
* View reports

## HR

Can:

* View employees
* View employee assets
* Start employee offboarding
* Track asset clearance
* View asset handover/return documents

## Employee

Employees should have their own portal.

They can:

* View their own profile
* View their assigned assets
* View asset details
* View handover documents
* View asset history
* Request an asset
* Report damaged asset
* Report lost asset
* Request replacement
* View request status

Employees cannot:

* Create assets
* Assign assets
* View other employees
* Edit asset ownership
* Delete asset records
* Access administration features

## Viewer / Auditor

Read-only access to approved areas.

---

# 5. Dashboard

Create a professional dashboard.

Display:

```text
Total Assets
Assigned
Available
Under Repair
Lost
Damaged
Retired
Disposed
```

Example:

```text
Total Assets       248
Assigned           187
Available           42
Under Repair        12
Lost                2
Damaged             5
Retired             7
Disposed            3
```

Also display:

### Asset Categories

```text
Laptop        85
Monitor       72
Mobile        38
Accessories   53
```

### Recent Activity

Examples:

```text
Laptop AST-000125 assigned to Mohamed
Monitor AST-000126 returned by Ahmed
Mobile AST-000127 sent for repair
Laptop AST-000128 transferred to Sara
```

### Warranty Expiry

Show assets whose warranty is expiring soon.

### Pending Requests

Show employee asset requests waiting for approval.

### Pending Returns

Show assets that still need to be returned during employee offboarding.

---

# 6. Employee Management

Create employee CRUD.

Employee fields:

```text
Employee ID
First Name
Last Name
Email
Phone
Department
Designation
Location
Joining Date
Employment Status
User Account
Profile Photo
Notes
```

Employment statuses:

```text
Active
On Leave
Resigned
Terminated
Inactive
```

Employee profile should show:

```text
Employee Information

Assigned Assets
Asset Requests
Asset History
Handover Documents
Return Documents
Offboarding Status
```

---

# 7. Asset Categories

Create dynamic categories.

Examples:

```text
Laptop
Desktop
Monitor
Mobile
Tablet
Printer
Keyboard
Mouse
Headset
Webcam
Docking Station
Charger
Laptop Bag
Access Card
Office Equipment
Other
```

Admin should be able to create/edit/delete categories.

Do not hard-code asset categories.

---

# 8. Asset Management

Each physical asset must have a unique asset code.

Example:

```text
AST-000001
AST-000002
AST-000003
```

Asset fields:

```text
Asset ID
Asset Code
Category
Brand
Model
Serial Number
Service Tag
Purchase Date
Purchase Cost
Supplier
Warranty Start Date
Warranty End Date
Condition
Status
Location
Description
Notes
```

Optional:

```text
Invoice Number
Purchase Order
Vendor
Depreciation Information
Asset Image
```

Asset statuses:

```text
Available
Assigned
Reserved
Under Repair
Lost
Damaged
Returned
Retired
Disposed
```

Asset conditions:

```text
New
Excellent
Good
Fair
Poor
Damaged
```

---

# 9. Asset Assignment

Create an asset assignment workflow.

Admin selects:

```text
Employee
Asset
Assignment Date
Condition
Location
Notes
Accessories
```

Example:

```text
Employee:
Mohamed Fahath

Asset:
AST-000125 - Dell Latitude 5540

Assignment Date:
13-Sep-2026

Condition:
Good

Accessories:
Charger
Mouse
Laptop Bag
```

When assigned:

```text
Asset status = Assigned
```

Create an `asset_assignments` record.

Do NOT simply overwrite the employee on the asset.

Historical assignments must remain available.

---

# 10. Asset Assignment History

Every assignment must be tracked.

Example:

```text
AST-000125

15-Jan-2025
Assigned → Ahmed

01-Aug-2025
Returned from Ahmed

05-Aug-2025
Assigned → Mohamed

10-Sep-2026
Sent for repair

12-Sep-2026
Repair completed

13-Sep-2026
Assigned → Mohamed
```

The asset detail page should have a timeline.

---

# 11. Asset Return

Create an asset return workflow.

Fields:

```text
Asset
Employee
Return Date
Condition on Return
Accessories Returned
Damage Details
Notes
Returned By
```

Example:

```text
Asset:
AST-000125

Employee:
Mohamed

Return Date:
20-Sep-2026

Condition:
Good

Accessories:
✓ Charger
✓ Mouse
✗ Laptop Bag

Damage:
Small scratch on laptop body
```

After return:

```text
Asset status = Available
```

or:

```text
Asset status = Under Repair
```

depending on condition.

---

# 12. Asset Transfer

Allow an asset to be transferred between employees.

Example:

```text
Current Employee:
Mohamed

Transfer To:
Ahmed

Transfer Date:
25-Sep-2026

Reason:
Employee transferred department
```

The old assignment must be closed.

A new assignment/history record must be created.

Never delete the old employee assignment history.

---

# 13. Asset Repair / Maintenance

Create a repair module.

Fields:

```text
Asset
Reported By
Reported Date
Issue
Repair Vendor
Repair Cost
Sent Date
Completed Date
Status
Resolution
Notes
```

Repair statuses:

```text
Reported
Sent for Repair
In Progress
Completed
Cancelled
```

Example:

```text
AST-000125

Issue:
Keyboard not working

Repair Cost:
AED 250

Status:
Completed
```

Repair history must remain permanently linked to the asset.

---

# 14. Warranty Management

Track:

```text
Warranty Start
Warranty End
Warranty Provider
Warranty Reference
```

Dashboard should show:

```text
Warranty Expiring Soon
```

Allow filtering:

```text
Expired
Expiring within 7 days
Expiring within 30 days
Expiring within 90 days
Active
```

---

# 15. Asset Locations

Create locations.

Examples:

```text
Dubai Office
Abu Dhabi Office
Sharjah Office
Warehouse
IT Storage
Repair Center
Remote
```

An asset should have a location.

Example:

```text
Employee:
None

Location:
IT Storage

Status:
Available
```

---

# 16. Asset Documents

Allow documents to be attached to assets.

Examples:

```text
Purchase Invoice
Warranty Certificate
Repair Invoice
Handover Form
Return Form
Asset Photo
Other Documents
```

Documents should be securely stored.

Do not expose private storage files directly without authorization.

---

# 17. QR Code

Every asset should have a QR code.

Example:

```text
AST-000125
```

Generate a QR code containing the asset identifier or secure asset URL.

When an authorized user scans it:

```text
Dell Latitude 5540

Asset:
AST-000125

Status:
Assigned

Employee:
Mohamed Fahath

Condition:
Good

Warranty:
Active
```

Employees should only see information they are authorized to see.

---

# 18. Asset Handover

When an asset is assigned, generate a professional PDF handover document.

Example:

```text
ASSET HANDOVER FORM

Employee:
Mohamed Fahath

Employee ID:
EMP-0001

Asset:
Dell Latitude 5540

Asset Code:
AST-000125

Serial Number:
XXXXXXXX

Condition:
Good

Accessories:
Charger
Mouse
Laptop Bag

Assigned Date:
13-Sep-2026
```

Include signature fields:

```text
Employee Signature

IT/Admin Signature
```

If practical, support electronic signature capture.

---

# 19. Asset Return Document

When an employee returns an asset, generate a return document.

Include:

```text
Employee
Asset
Return Date
Condition
Accessories
Damage
Remarks
Employee acknowledgement
Admin acknowledgement
```

---

# 20. Employee Asset Requests

Employees should be able to request assets.

Example:

```text
Request Asset

Asset Type:
Monitor

Reason:
Need second monitor for development work

Priority:
Normal

Submit
```

Request statuses:

```text
Pending
Approved
Rejected
Fulfilled
Cancelled
```

Admin can approve/reject.

Once approved, the asset can be assigned.

---

# 21. Damage / Lost Asset Reporting

Employee should be able to report:

```text
Damaged Asset
Lost Asset
Missing Accessory
Technical Problem
```

Example:

```text
Report Problem

Asset:
AST-000125

Problem:
Laptop screen damaged

Description:
Screen cracked while travelling.

Photo:
Upload

Submit
```

Admin can review and convert the report into a repair/incident workflow.

---

# 22. Employee Offboarding

Create an employee offboarding process.

When HR starts offboarding:

```text
Employee:
Mohamed Fahath

Assigned Assets:

Laptop        ✓ Returned
Monitor       ✓ Returned
Mobile        ✓ Returned
Headset       ✓ Returned
Mouse         ⏳ Pending
```

The system should clearly show outstanding assets.

Once everything is returned:

```text
Asset Clearance:
COMPLETED
```

Generate:

```text
Employee Asset Clearance Certificate
```

Do not allow HR to accidentally mark clearance complete if required assets are still outstanding.

---

# 23. Vendors / Suppliers

Create vendor management.

Fields:

```text
Vendor Name
Contact Person
Email
Phone
Address
Tax/VAT Number
Notes
```

Assets can optionally be linked to vendors.

---

# 24. Audit Logs

Track important actions:

```text
User
Action
Module
Record
Old Value
New Value
IP Address
Timestamp
```

Examples:

```text
Admin assigned AST-000125 to Mohamed
Admin changed asset condition
Admin transferred asset
Admin deleted a request
HR completed employee clearance
```

Important records should not be silently deleted.

Prefer soft deletes where appropriate.

---

# 25. Database Design

Create proper normalized tables.

Recommended tables:

```text
users

employees
departments
locations

asset_categories
asset_brands
assets

asset_assignments
asset_returns
asset_transfers

asset_repairs
asset_maintenance

asset_requests
asset_incidents

asset_documents
asset_history

vendors

audit_logs
```

Use foreign keys and appropriate indexes.

Most importantly:

### Do NOT depend on only this:

```text
assets.employee_id
```

Instead maintain assignment history through:

```text
asset_assignments
```

Example:

```text
asset_assignments

id
asset_id
employee_id
assigned_at
returned_at
condition_on_assignment
condition_on_return
assigned_by
returned_by
notes
created_at
updated_at
```

This allows complete historical tracking.

---

# 26. Asset History

Consider creating a unified history/timeline.

For an asset:

```text
Purchase
Assignment
Transfer
Repair
Maintenance
Return
Status Change
Location Change
Document Added
```

Show everything chronologically.

Example UI:

```text
Asset History

● 13 Sep 2026
  Assigned to Mohamed
  Condition: Good

● 12 Sep 2026
  Repair completed
  Cost: AED 250

● 10 Sep 2026
  Sent for repair
  Issue: Keyboard

● 05 Aug 2026
  Assigned to Mohamed

● 01 Aug 2026
  Returned by Ahmed
```

---

# 27. Employee Dashboard

Employee dashboard should be much simpler than admin dashboard.

Example:

```text
Welcome, Mohamed 👋

My Assets: 5
Pending Requests: 1
Open Issues: 1

My Assets
────────────────────

Dell Laptop
AST-000125
Good

Dell Monitor
AST-000126
Good

Samsung Mobile
AST-000127
Good
```

Quick actions:

```text
Request Asset
Report Damage
Report Lost Asset
View My Assets
```

Employees should not see administration menus.

---

# 28. Admin Navigation

Use a clean sidebar:

```text
Dashboard

Assets
  All Assets
  Categories
  Assignments
  Transfers
  Repairs
  Maintenance
  Requests

Employees

Locations

Vendors

Documents

Reports

Audit Logs

Settings
```

For employee:

```text
Dashboard

My Assets

My Requests

Report Issue

My Documents

My Profile
```

---

# 29. UI / UX Requirements

The application should feel like a professional modern SaaS product.

Use:

* Clean dashboard cards
* Tables with search
* Filters
* Pagination
* Sorting
* Status badges
* Confirmation dialogs
* Toast notifications
* Empty states
* Loading states
* Error states
* Responsive layouts
* Mobile-friendly employee portal

Use icons consistently.

Keep the UI simple enough for HR and IT staff who are not highly technical.

Avoid overly complicated screens.

---

# 30. Search and Filters

Assets should support:

```text
Search by Asset Code
Search by Serial Number
Search by Employee
Search by Model
Search by Brand
```

Filters:

```text
Category
Status
Condition
Location
Employee
Warranty Status
Purchase Date
```

Employees:

```text
Department
Location
Employment Status
```

---

# 31. Reports

Create useful reports:

### Asset Inventory Report

```text
Asset Code
Category
Brand
Model
Serial Number
Employee
Location
Status
Condition
Purchase Date
Purchase Cost
Warranty
```

### Employee Asset Report

Show all assets assigned to an employee.

### Asset Assignment Report

Show assignment history.

### Repair Cost Report

Show:

```text
Asset
Repair Count
Total Repair Cost
```

### Warranty Report

### Lost/Damaged Asset Report

### Asset Lifecycle Report

Allow export to:

```text
CSV
Excel
PDF
```

---

# 32. Multi-Company Architecture

Design the database so the system can support multiple companies in the future.

Use:

```text
companies
```

and add:

```text
company_id
```

to company-specific records.

Example:

```text
companies

id
name
email
phone
address
logo
status
```

All company users and company assets must be isolated.

Company A must never see Company B's employees or assets.

Build proper tenant/company authorization.

---

# 33. Security

Implement:

* Laravel Sanctum authentication
* Role/permission authorization
* Request validation
* Policies
* Form Requests
* API authentication
* Company-level authorization
* Employee-level authorization
* Secure document access
* CSRF protection where applicable
* Rate limiting where appropriate
* Audit logging
* Soft deletes for important entities

Never trust IDs sent by the frontend.

Always verify authorization on the backend.

---

# 34. API Architecture

Create clean REST APIs.

Example:

```text
POST   /api/auth/login
POST   /api/auth/logout
GET    /api/me

GET    /api/employees
POST   /api/employees
GET    /api/employees/{id}
PUT    /api/employees/{id}

GET    /api/assets
POST   /api/assets
GET    /api/assets/{id}
PUT    /api/assets/{id}

POST   /api/assets/{id}/assign
POST   /api/assets/{id}/return
POST   /api/assets/{id}/transfer

GET    /api/assets/{id}/history

GET    /api/asset-requests
POST   /api/asset-requests

GET    /api/repairs
POST   /api/repairs

GET    /api/dashboard
```

Follow consistent API response structures.

---

# 35. Important Business Rules

Implement these rules carefully:

1. An asset cannot be assigned to two active employees simultaneously.

2. An asset marked `Retired` cannot be assigned.

3. An asset marked `Disposed` cannot be assigned.

4. An employee cannot complete offboarding while required assets are outstanding.

5. Returning an asset must close its active assignment.

6. Transferring an asset must close the previous assignment and create a new assignment.

7. Asset history must never be destroyed when ownership changes.

8. Employees can only view assets assigned to themselves.

9. Employees cannot modify asset ownership.

10. Only authorized roles can assign/return/transfer assets.

11. Company users can only access records belonging to their company.

12. Asset codes must be unique within the company.

13. Serial numbers should preferably be unique where provided.

14. An asset cannot have more than one active assignment.

15. Important financial and lifecycle records should use soft deletion or immutable history rather than destructive deletion.

---

# 36. Development Approach

Build the project incrementally.

Do not generate a huge amount of disconnected code at once.

First create:

### Phase 1

```text
Authentication
Users/Roles
Companies
Employees
Departments
Locations
Asset Categories
Assets
```

Then:

### Phase 2

```text
Asset Assignment
Asset Return
Asset Transfer
Asset History
```

Then:

### Phase 3

```text
Repairs
Maintenance
Warranty
Documents
QR Codes
Handover PDFs
```

Then:

### Phase 4

```text
Employee Portal
Asset Requests
Damage/Lost Reports
Offboarding
Clearance
```

Then:

### Phase 5

```text
Reports
Analytics
Audit Logs
Advanced filters
Exports
```

---

# 37. Code Quality Requirements

Write production-quality code.

Backend:

* Laravel conventions
* Models
* Migrations
* Policies
* Form Requests
* API Resources where appropriate
* Services only where they genuinely simplify business logic
* Proper relationships
* Database transactions for assignment/return/transfer operations
* Validation
* Authorization

Frontend:

* Next.js App Router
* JavaScript
* Reusable components
* Server/client components appropriately
* Proper loading/error states
* Reusable API layer
* Proper authentication handling
* No unnecessary global state
* Responsive UI

Do not use TypeScript.

Do not use localStorage for authentication tokens if the architecture uses secure HttpOnly cookies.

---

# 38. UX Priority

The most important user experience should be:

```text
Add Asset
     ↓
Assign Asset
     ↓
Employee Receives Asset
     ↓
Track Asset
     ↓
Repair / Transfer
     ↓
Return Asset
     ↓
Employee Clearance
```

This flow should be extremely easy for an IT administrator.

---

# 39. Final Goal

The finished application should feel like a real commercial **Employee Asset Management SaaS**, not a basic CRUD project.

It should allow a company to answer questions such as:

* What assets does the company own?
* Where is each asset?
* Who currently has it?
* Who had it before?
* When was it purchased?
* How much did it cost?
* Is it under warranty?
* How many times has it been repaired?
* How much has been spent on repairs?
* What assets does an employee have?
* What assets are still outstanding when an employee leaves?
* Which assets are lost or damaged?
* Which warranties are expiring?
* What happened to an asset throughout its entire lifecycle?

Build the system around **accurate asset lifecycle tracking, historical records, security, role-based access, and a very simple user experience**.

Before implementing each major module, explain the proposed database relationships and workflow briefly, then implement it completely and consistently with the rest of the system.
