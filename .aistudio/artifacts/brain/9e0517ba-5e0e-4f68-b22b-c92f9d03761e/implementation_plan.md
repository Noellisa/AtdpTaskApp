# ATDP Workforce Flow — Production Onboarding, Employee Creation & Workforce Database

This update transitions **ATDP Workforce Flow** from a pre-populated demo into a clean, production-ready platform for immediate organizational use. We are removing the Demo Role Switcher and all sample records, introducing a structured **Onboarding & Email Invite Sign-Up Page**, and building a dedicated **Create Employee & Workforce Database** suite for Top Management with **Bulk CSV Import/Export**.

### User Review & Critical Decisions

> [!IMPORTANT]
> Below are the confirmed decisions from your responses that govern this update:

- **Confirmed Decision 1 — Zero Demo Data & No Demo Switcher**: All demo tasks, demo employees, and the `DEMO ROLE SWITCHER` top bar pill are completely removed. Only standard ATDP department shells (`Programmes`, `Outreach`, `Logistics`, `Finance`, `Executive`) are pre-initialized so you can begin assigning real work immediately.
- **Confirmed Decision 2 — Top Management Email Invite & Employee Onboarding Flow**: Top Management registers new employees by email invite (pre-assigning their job title, role tier, department, desk, and reporting manager). When invited staff sign up on the Onboarding page using their email (via Google Sign-In or direct Email/Invite onboarding), the platform automatically links them to their pre-registered record and guides them through completing their personal profile and HR documents.
- **Confirmed Decision 3 — Comprehensive Create Employee Section & Bulk CSV Tools**: Top Management gets a dedicated **Create Employee** workflow capturing Personal Info (Name, Email, Phone, National ID, Location), Employment Info (Job Title, Department, Desk, Reporting Manager, Role Tier), HR Documents, and **Bulk CSV Import & Export** to organize and manage the entire workforce database.

---

### 1. Overview & Core Concept

- **What It Does**: Provides a live, production-grade workforce management system where Top Management initializes the organization, invites and registers staff into a structured database (individually or via CSV), and tracks real tasks, deliverables, voice instructions, and employee performance.
- **Target Audience / Persona**:
  - **Top Management**: Onboards the organization, creates employee records and email invites, imports/exports the staff database via CSV, assigns supervisors, and oversees all departments and employee profiles.
  - **Supervisors**: Manages departmental tasks, records voice instructions, reviews employee deliverables, and logs performance evaluations.
  - **Employees**: Claims their email invite on the Onboarding page, completes personal and document verification, uploads task deliverables, and tracks deadlines.
- **Key Value**: Gives ATDP a clean, authoritative employee database and task tracking system ready for day-one operational deployment without any mock clutter.

---

### 2. User Experience & Visual Design

- **Key User Flows**:
  1. **Authentication & Multi-Path Onboarding Page**:
     - **Path A — Initial Top Management Setup**: When launching the fresh workspace, the founding administrator completes a streamlined **Executive Onboarding** screen (Full Name, Official Email, Phone, Title, National ID) to establish the initial Top Management account.
     - **Path B — Invited Employee Sign-Up & Profile Completion**: Staff who have been invited by Top Management enter their invited email (or sign in with Google matching that email). The onboarding page recognizes their pending invitation, displays their assigned Department, Role, and Manager, and prompts them to complete their Personal Information (Phone, National ID, Location, Bio) and upload HR documents (`CV`, `Contract`, `National ID`) to activate their account.
  2. **Top Management "Create Employee" & Invite Center**:
     - Accessible directly from the Dashboard quick actions, Sidebar, and Employees Database header for Top Management users.
     - **Single Employee Registration & Invite**: Structured form organized into *Personal Details & National ID*, *Department, Desk & Reporting Manager*, *Access Tier (`Employee`, `Supervisor`, `Top Management`)*, and *HR Document Checklist*. Generates a ready-to-send email invitation (`mailto:` trigger + one-click copyable invite details).
     - **Bulk CSV Import & Export**: Download a clean CSV template (`FullName,Email,Phone,NationalID,JobTitle,AccessLevel,Department,Desk,ManagerName,Location`), upload a CSV file to batch-create/invite employees with live preview validation, or export the full employee database to CSV for executive reporting.
  3. **Organized Employee Database**:
     - Segmented tabs for **All Staff**, **Active Employees**, **Pending Invite Onboarding**, and **Department Matrix**.
     - Multi-column search and filters by Department, Desk, Access Tier, and Onboarding Status (`Active` vs. `Invited`).
     - Clicking any employee opens their 360-degree drawer with Personal Info, Employment Info (editable by Top Management), HR Documents, Assigned Tasks, and Performance History.
  4. **Production Dashboard, Tasks & My Profile**:
     - Clean header displaying only the authenticated user's real name, actual role (`Top Management`, `Supervisor`, or `Employee`), and live notification bell.
     - Clean empty states on Dashboard, Tasks, Meetings, and Announcements with direct primary action buttons (`+ Create First Task`, `+ Invite / Create Employee`, `Record an Instruction`) so the team can populate real operational data immediately.

- **Visual Identity & Theme**:
  - Preserves the crisp ATDP visual language from your reference screenshots: cool alabaster canvas (`#F8FAFC`), pure white structural cards (`#FFFFFF`) with `1px` `#E2E8F0` borders, deep navy primary controls (`#0F172A`), `Plus Jakarta Sans` headings, `Public Sans` body copy, and `JetBrains Mono` (`tabular-nums`) for staff IDs, phone numbers, National IDs, and task counters.

---

### 3. Key Product Decisions & Trade-Offs

- **Decision 1: Email-Matched Invite Onboarding + Direct Account Creation**
  - *Chosen Approach*: When Top Management creates an employee record, the record is stored in the database with `onboardingStatus: 'INVITED'` and normalized `email`. When that employee signs in via Google or completes the Invited Staff Sign-Up form with that email, their session binds to that exact employee record and transitions `onboardingStatus` to `'ACTIVE'`.
  - *Why*: Ensures only authorized ATDP personnel created by Top Management can join the workspace, while automatically assigning them the right department, supervisor, and permission tier.
- **Decision 2: Pre-Initialized Standard ATDP Departments Only**
  - *Chosen Approach*: Seed only the 5 core department definitions (`Programmes`, `Outreach`, `Logistics`, `Finance`, `Executive`) on a fresh workspace, while purging all demo tasks, demo instructions, and demo staff. Top Management can also add new custom departments or desks at any time.
  - *Why*: Saves setup time when creating the first employees and tasks without polluting the database with fake tasks or fake people.

---

### 4. Technical Architecture & Data Strategy *(Technical Reference)*

- **Architecture & Component Diagram**:

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                   ATDP WORKFORCE FLOW (PRODUCTION ARCHITECTURE)              │
├───────────────────────────┬──────────────────────────────────────────────────┤
│  AUTH & ONBOARDING GATE   │           WORKFORCE & TASK DATABASE              │
│                           │                                                  │
│  ┌─────────────────────┐  │  ┌────────────────────────────────────────────┐  │
│  │ Sign-In / Sign-Up   │  │  │ Cloud Firestore + Persistent Sync Engine   │  │
│  │ • Google Sign-In    │  │  │  • employees (Personal, Job, National ID,  │  │
│  │ • Email Invite Claim│──┼─▶│    OnboardingStatus: INVITED | ACTIVE)     │  │
│  └──────────┬──────────┘  │  │  • departments (Standard ATDP Depts)       │  │
│             │             │  │  • tasks (Subtasks, Deliverables, Reviews) │  │
│             ▼             │  │  • instructions, meetings, announcements   │  │
│  ┌─────────────────────┐  │  └────────────────────┬───────────────────────┘  │
│  │ Onboarding Wizard   │  │                       │                          │
│  │ • Exec First Setup  │  ├───────────────────────┴──────────────────────────┤
│  │ • Invited Employee  │  │          ROLE-GOVERNED WORKSPACE VIEWS           │
│  │   Profile & Docs    │  │                                                  │
│  └─────────────────────┘  │  ┌────────────────────┐  ┌────────────────────┐  │
│                           │  │Create Employee &   │  │Employee Database   │  │
│                           │  │Invite Center       │  │• Directory & Filter│  │
│                           │  │(Top Management)    │  │• Bulk CSV Import   │  │
│                           │  │• Single Invite Form│  │• CSV Export        │  │
│                           │  │• Role & Desk Assign│  │• Performance Log   │  │
│                           │  └────────────────────┘  └────────────────────┘  │
│                           │  ┌────────────────────┐  ┌────────────────────┐  │
│                           │  │Dashboard & Tasks   │  │My Profile &        │  │
│                           │  │• Live KPIs         │  │Public Work Profile │  │
│                           │  │• Voice Instructions│  │• HR Document Upload│  │
│                           │  └────────────────────┘  └────────────────────┘  │
└───────────────────────────┴──────────────────────────────────────────────────┘
```

- **Data Model Enhancements (`EmployeeRecord`)**:
  - Adds `staffId` (auto-generated format e.g. `ATDP-2026-001`), `onboardingStatus` (`'INVITED' | 'ACTIVE'`), `invitedBy` (name of Top Management creator), and `invitedAt` timestamp alongside Personal Info (`fullName`, `email`, `phone`, `nationalId`, `location`, `bio`), Employment Info (`role`, `accessLevel`, `department`, `desk`, `managerName`, `joinDate`), `documents[]`, and `performanceReviews[]`.
- **Interactive Component & State Mapping**:
  - **Onboarding Gate (`OnboardingFlow`)**: Checks if the workspace has any `ACTIVE` Top Management record. If empty, renders the *Executive Workspace Setup* wizard. If the workspace is initialized, allows users to sign in or claim a pending email invite, verify their personal/ID details, and enter the platform with their assigned `accessLevel`.
  - **Create Employee & CSV Manager (`CreateEmployeeView` / `EmployeesDatabase`)**: Validates required fields, checks for duplicate emails, writes new employee records with `onboardingStatus: 'INVITED'` (or `'ACTIVE'`), parses uploaded `.csv` files into validated employee records, and generates downloadable `.csv` exports of the entire staff directory.
