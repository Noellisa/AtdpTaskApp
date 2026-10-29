export type TaskStatus =
  | 'PENDING CONFIRMATION'
  | 'BACKLOG'
  | 'ASSIGNED'
  | 'IN PROGRESS'
  | 'SUBMITTED'
  | 'UNDER REVIEW'
  | 'COMPLETED'
  | 'ON HOLD'
  | 'BLOCKED'
  | 'CANCELLED';

export const ALL_TASK_STATUSES: TaskStatus[] = [
  'PENDING CONFIRMATION',
  'BACKLOG',
  'ASSIGNED',
  'IN PROGRESS',
  'SUBMITTED',
  'UNDER REVIEW',
  'COMPLETED',
  'ON HOLD',
  'BLOCKED',
  'CANCELLED',
];

export const TASK_SOURCES = [
  'Created directly',
  'Verbal/in-person instruction',
  'Meeting action item',
  'Supervisor directive',
  'Cross-department request',
] as const;

export const TASK_CATEGORIES = [
  'Report',
  'Partnership',
  'Event',
  'Operations',
  'Finance',
  'Outreach',
  'Policy & Research',
  'Other',
] as const;

export const ROLE_PERMISSIONS_MATRIX: {
  role: string;
  tierLabel: string;
  permissions: string[];
}[] = [
  {
    role: 'Employee',
    tierLabel: 'Employee Access Tier',
    permissions: [
      'View own dashboard & deadlines',
      'Create tasks & record verbal instructions',
      'Submit deliverable versions (files & links)',
      'Post task comments & updates',
      'View own profile & HR documents',
    ],
  },
  {
    role: 'Team Lead / Supervisor',
    tierLabel: 'Supervisor Access Tier',
    permissions: [
      'All Employee permissions',
      'Create & assign tasks across desk',
      'Confirm recorded instructions into tasks',
      'Review, request revision & approve deliverables',
      'Set deadlines & log performance evaluations',
    ],
  },
  {
    role: 'Manager',
    tierLabel: 'Supervisor / Department Head Tier',
    permissions: [
      'All Team Lead permissions',
      'Cross-department task assignment',
      'View organisation-wide activity metrics',
      'Broadcast departmental announcements',
    ],
  },
  {
    role: 'HR / Admin',
    tierLabel: 'Top Management Tier',
    permissions: [
      'Register & invite employees by email',
      'Bulk CSV database import & export',
      'Create & configure departments and desks',
      'Manage HR documents (CV, Contract, ID)',
    ],
  },
  {
    role: 'Executive',
    tierLabel: 'Top Management Tier',
    permissions: [
      'Full organisation-wide visibility',
      'View all department workloads & audit logs',
      'Executive approvals & quality oversight',
      'Organisation-wide broadcasts & governance',
    ],
  },
];

export type TaskPriority = 'Low' | 'Medium' | 'High' | 'Critical';

export type RolePerspective = 'Employee' | 'Supervisor' | 'Top Management';

export type OnboardingStatus = 'INVITED' | 'ACTIVE';

export type NavSection =
  | 'dashboard'
  | 'tasks'
  | 'employees'
  | 'departments'
  | 'meetings'
  | 'announcements'
  | 'notifications'
  | 'profile';

export interface SubtaskItem {
  id: string;
  title: string;
  completed: boolean;
}

export interface DeliverableVersion {
  id: string;
  version: string; // e.g., "v1", "v2"
  fileName: string;
  fileSize: string;
  fileUrl: string;
  notes: string;
  submittedBy: string;
  submittedAt: string;
}

export interface TaskComment {
  id: string;
  authorName: string;
  authorRole: string;
  text: string;
  type: 'comment' | 'supervisor_feedback' | 'approval' | 'revision_request';
  createdAt: string;
}

export interface TaskHistoryEntry {
  id: string;
  action: string;
  actorName: string;
  timestamp: string;
}

export interface TaskRecord {
  id: string;
  workspaceOwnerId: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  department: string;
  assignees: string[];
  reviewer: string;
  owner: string;
  deadline: string;
  deadlineIso: string;
  subtasks: SubtaskItem[];
  deliverables: DeliverableVersion[];
  comments: TaskComment[];
  history: TaskHistoryEntry[];
  createdAt: string;
  updatedAt: string;
}

export interface EmployeeDocument {
  id: string;
  fileName: string;
  category: string; // e.g. "CV", "Contract", "Identification"
  fileSize: string;
  fileUrl?: string;
  uploadedAt: string;
}

export interface PerformanceReviewItem {
  id: string;
  period: string;
  reviewerName: string;
  rating: number; // 1 - 5
  summary: string;
  date: string;
}

export interface EmployeeRecord {
  id: string;
  workspaceOwnerId: string;
  staffId: string;
  onboardingStatus: OnboardingStatus;
  fullName: string;
  email: string;
  phone: string;
  role: string;
  accessLevel: RolePerspective;
  department: string;
  desk: string;
  managerName: string;
  joinDate: string;
  location: string;
  nationalId: string;
  bio: string;
  avatarColor: string;
  avatarUrl?: string;
  badges: string[];
  documents: EmployeeDocument[];
  performanceScore: number;
  onTimeRate: number;
  performanceReviews: PerformanceReviewItem[];
  createdAt: string;
  updatedAt: string;
}

export interface InstructionRecord {
  id: string;
  workspaceOwnerId: string;
  title: string;
  department: string;
  recordedBy: string;
  assignedTo: string;
  notes: string;
  durationSec: number;
  hasAudio: boolean;
  audioDataUrl: string;
  status: 'PENDING' | 'CONFIRMED';
  createdAt: string;
  updatedAt: string;
}

export interface DepartmentRecord {
  id: string;
  workspaceOwnerId: string;
  name: string;
  headName: string;
  description: string;
  desks: string[];
  createdAt: string;
}

export interface MeetingRecord {
  id: string;
  workspaceOwnerId: string;
  title: string;
  department: string;
  organizer: string;
  date: string;
  time: string;
  locationOrLink: string;
  agenda: string;
  attendees: string[];
  createdAt: string;
}

export interface AnnouncementRecord {
  id: string;
  workspaceOwnerId: string;
  title: string;
  body: string;
  authorName: string;
  authorRole: string;
  department: string;
  priority: 'Normal' | 'Important' | 'Urgent';
  createdAt: string;
}

export interface NotificationRecord {
  id: string;
  workspaceOwnerId: string;
  title: string;
  message: string;
  category: 'task_status' | 'feedback' | 'instruction' | 'deadline' | 'announcement';
  recipientName: string;
  read: boolean;
  relatedTaskId: string;
  createdAt: string;
  updatedAt: string;
}

export interface ActivityLogRecord {
  id: string;
  workspaceOwnerId: string;
  headline: string;
  subtext: string;
  actorName: string;
  createdAt: string;
}
