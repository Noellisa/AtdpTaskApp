import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  browserPopupRedirectResolver,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
} from 'firebase/auth';
import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import {
  ArrowUpDown,
  Bell,
  Briefcase,
  Building2,
  Calendar,
  Camera,
  CheckCircle2,
  ChevronDown,
  Clock,
  Download,
  ExternalLink,
  LayoutGrid,
  ListTodo,
  LogOut,
  Mail,
  Megaphone,
  Menu,
  Mic,
  Paperclip,
  Phone,
  Plus,
  Search,
  ShieldCheck,
  Table as TableIcon,
  Upload,
  User as UserIcon,
  UserPlus,
  Users,
  Video,
  Volume2,
  X,
} from 'lucide-react';
import {
  auth,
  db,
  googleProvider,
  handleFirestoreError,
  OperationType,
} from './firebase';
import {
  ActivityLogRecord,
  ALL_TASK_STATUSES,
  AnnouncementRecord,
  DepartmentRecord,
  EmployeeRecord,
  InstructionRecord,
  MeetingRecord,
  NavSection,
  NotificationRecord,
  ROLE_PERMISSIONS_MATRIX,
  RolePerspective,
  TASK_CATEGORIES,
  TaskRecord,
} from './types';
import { buildDefaultDepartments } from './data/seedData';
import { Avatar, AvatarStack } from './components/Avatar';
import { getStatusBadgeStyle, TaskDetailDrawer } from './components/TaskDetailDrawer';
import {
  CreateAnnouncementModal,
  CreateDepartmentModal,
  CreateTaskModal,
  EmployeeDetailModal,
  RecordInstructionModal,
  ScheduleMeetingModal,
} from './components/Modals';
import { OnboardingFlow } from './components/OnboardingFlow';
import { CreateEmployeeSection } from './components/CreateEmployeeSection';
import {
  compressProfileImage,
  downloadOrOpenFile,
  processUploadedFile,
} from './utils/fileUpload';

interface ToastAlert {
  id: string;
  title: string;
  message: string;
}

interface SessionUser {
  uid: string;
  email: string;
  displayName: string;
  isCloudConnected: boolean;
}

const LEGACY_DEMO_KEYS = [
  'atdp_wf_session_v1',
  'atdp_wf_employees_v1',
  'atdp_wf_tasks_v1',
  'atdp_wf_instructions_v1',
  'atdp_wf_departments_v1',
  'atdp_wf_meetings_v1',
  'atdp_wf_announcements_v1',
  'atdp_wf_notifications_v1',
  'atdp_wf_activity_logs_v1',
];

const STORAGE_KEYS = {
  SESSION: 'atdp_wf_prod_v2_session',
  ACTIVE_EMP_ID: 'atdp_wf_prod_v2_active_emp_id',
  EMPLOYEES: 'atdp_wf_prod_v2_employees',
  TASKS: 'atdp_wf_prod_v2_tasks',
  INSTRUCTIONS: 'atdp_wf_prod_v2_instructions',
  DEPARTMENTS: 'atdp_wf_prod_v2_departments',
  MEETINGS: 'atdp_wf_prod_v2_meetings',
  ANNOUNCEMENTS: 'atdp_wf_prod_v2_announcements',
  NOTIFICATIONS: 'atdp_wf_prod_v2_notifications',
  ACTIVITY_LOGS: 'atdp_wf_prod_v2_activity_logs',
};

function purgeLegacyDemoStorage(): void {
  try {
    LEGACY_DEMO_KEYS.forEach((k) => localStorage.removeItem(k));
  } catch {
    // Ignore storage errors
  }
}

function loadLocalArray<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw) as T[];
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch {
    // Ignore parse errors
  }
  return [];
}

function loadOrInitDepartments(key: string, uid: string): DepartmentRecord[] {
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw) as DepartmentRecord[];
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch {
    // Ignore parse errors
  }
  const initialDepts: DepartmentRecord[] = buildDefaultDepartments(uid).map((d, idx) => ({
    id: `dept_${ idx + 1 }`,
    ...d,
  }));
  try {
    localStorage.setItem(key, JSON.stringify(initialDepts));
  } catch {
    // Ignore quota errors
  }
  return initialDepts;
}

function saveLocal<T>(key: string, data: T[]): void {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch {
    // Ignore storage quota errors
  }
}

export default function App() {
  const defaultUid = 'atdp_workspace_prod';

  // Ensure any old v1 demo storage keys are purged immediately
  useState(() => {
    purgeLegacyDemoStorage();
    return true;
  });

  const [sessionUser, setSessionUser] = useState<SessionUser>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.SESSION);
      if (saved) return JSON.parse(saved) as SessionUser;
    } catch {
      // Ignore
    }
    return {
      uid: defaultUid,
      email: '',
      displayName: '',
      isCloudConnected: false,
    };
  });

  const [cloudActive, setCloudActive] = useState(false);

  // Collections State (starts clean with zero demo data; only ATDP standard department shells)
  const [employees, setEmployees] = useState<EmployeeRecord[]>(() =>
    loadLocalArray<EmployeeRecord>(STORAGE_KEYS.EMPLOYEES)
  );
  const [tasks, setTasks] = useState<TaskRecord[]>(() =>
    loadLocalArray<TaskRecord>(STORAGE_KEYS.TASKS)
  );
  const [instructions, setInstructions] = useState<InstructionRecord[]>(() =>
    loadLocalArray<InstructionRecord>(STORAGE_KEYS.INSTRUCTIONS)
  );
  const [departments, setDepartments] = useState<DepartmentRecord[]>(() =>
    loadOrInitDepartments(STORAGE_KEYS.DEPARTMENTS, defaultUid)
  );
  const [meetings, setMeetings] = useState<MeetingRecord[]>(() =>
    loadLocalArray<MeetingRecord>(STORAGE_KEYS.MEETINGS)
  );
  const [announcements, setAnnouncements] = useState<AnnouncementRecord[]>(() =>
    loadLocalArray<AnnouncementRecord>(STORAGE_KEYS.ANNOUNCEMENTS)
  );
  const [notifications, setNotifications] = useState<NotificationRecord[]>(() =>
    loadLocalArray<NotificationRecord>(STORAGE_KEYS.NOTIFICATIONS)
  );
  const [activityLogs, setActivityLogs] = useState<ActivityLogRecord[]>(() =>
    loadLocalArray<ActivityLogRecord>(STORAGE_KEYS.ACTIVITY_LOGS)
  );

  // Active Signed-In Employee ID
  const [activeEmployeeId, setActiveEmployeeId] = useState<string | null>(() => {
    try {
      return localStorage.getItem(STORAGE_KEYS.ACTIVE_EMP_ID);
    } catch {
      return null;
    }
  });
  const [isOnboardingPortalOpen, setIsOnboardingPortalOpen] = useState(false);

  // Navigation & UI State
  const [activeNav, setActiveNav] = useState<NavSection>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  // Filters & Sorting for Tasks
  const [taskSearch, setTaskSearch] = useState('');
  const [taskStatusFilter, setTaskStatusFilter] = useState<string>('ALL');
  const [taskDeptFilter, setTaskDeptFilter] = useState<string>('ALL');
  const [taskPersonFilter, setTaskPersonFilter] = useState<string>('ALL');
  const [taskSort, setTaskSort] = useState<{
    key: 'title' | 'status' | 'department' | 'deadline';
    dir: 'asc' | 'desc';
  }>({ key: 'deadline', dir: 'asc' });

  // Filters, Sub-Tab & View Mode for Unified Employees Section
  const [empWorkspaceTab, setEmpWorkspaceTab] = useState<
    'directory' | 'register' | 'csv' | 'governance'
  >('directory');
  const [empSearch, setEmpSearch] = useState('');
  const [empDeptFilter, setEmpDeptFilter] = useState<string>('ALL');
  const [empRoleFilter, setEmpRoleFilter] = useState<string>('ALL');
  const [empStatusFilter, setEmpStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INVITED'>('ALL');
  const [empViewMode, setEmpViewMode] = useState<'table' | 'cards'>('table');

  // Selected Department for Interactive Department Inspector
  const [selectedDeptId, setSelectedDeptId] = useState<string>('dept_1');

  // Active Modals & Drawers
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
  const [isCreateTaskOpen, setIsCreateTaskOpen] = useState(false);
  const [createTaskPrefill, setCreateTaskPrefill] = useState<
    | Partial<{
        title: string;
        description: string;
        department: string;
        assignee: string;
        taskSource: string;
      }>
    | undefined
  >(undefined);
  const [isRecordInstOpen, setIsRecordInstOpen] = useState(false);
  const [isScheduleMeetingOpen, setIsScheduleMeetingOpen] = useState(false);
  const [isCreateAnnouncementOpen, setIsCreateAnnouncementOpen] = useState(false);
  const [isCreateDeptOpen, setIsCreateDeptOpen] = useState(false);
  const [showPublicWorkProfile, setShowPublicWorkProfile] = useState(false);
  const [playingInstructionId, setPlayingInstructionId] = useState<string | null>(null);
  const [profileDocCategory, setProfileDocCategory] = useState('CV');
  const profilePhotoInputRef = useRef<HTMLInputElement | null>(null);
  const profileDocInputRef = useRef<HTMLInputElement | null>(null);

  // Push Notification Toasts
  const [toasts, setToasts] = useState<ToastAlert[]>([]);
  const [browserPushEnabled, setBrowserPushEnabled] = useState<boolean>(
    typeof Notification !== 'undefined' && Notification.permission === 'granted'
  );
  const seededDeptsUidRef = useRef<string | null>(null);

  const triggerPushAlert = (title: string, message: string) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setToasts((prev) => [{ id, title, message }, ...prev].slice(0, 3));
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);

    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      try {
        new Notification(title, { body: message });
      } catch {
        // Ignore notification constructor constraints
      }
    }
  };

  const requestBrowserPushPermission = async () => {
    if (typeof Notification === 'undefined') return;
    try {
      const perm = await Notification.requestPermission();
      setBrowserPushEnabled(perm === 'granted');
      if (perm === 'granted') {
        triggerPushAlert(
          'Desktop Push Notifications Enabled',
          'You will now receive instant status alerts when tasks are updated or reviewed.'
        );
      }
    } catch {
      // Ignore
    }
  };

  // Monitor Firebase Auth and verify STS Token Service availability before attaching Firestore listeners
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        setCloudActive(false);
        return;
      }

      try {
        await firebaseUser.getIdToken(true);
        const nextSession: SessionUser = {
          uid: firebaseUser.uid,
          email: firebaseUser.email || '',
          displayName: firebaseUser.displayName || '',
          isCloudConnected: true,
        };
        setSessionUser(nextSession);
        localStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(nextSession));
        setCloudActive(true);
      } catch {
        const fallbackSession: SessionUser = {
          uid: firebaseUser.uid || defaultUid,
          email: firebaseUser.email || '',
          displayName: firebaseUser.displayName || '',
          isCloudConnected: false,
        };
        setSessionUser(fallbackSession);
        localStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(fallbackSession));
        setCloudActive(false);
        try {
          await signOut(auth);
        } catch {
          // Ignore signOut error
        }
      }
    });
    return () => unsub();
  }, []);

  // Sync with Cloud Firestore when cloudActive is true (seeds ONLY standard ATDP departments if empty)
  useEffect(() => {
    if (!cloudActive || !auth.currentUser) return;

    const uid = auth.currentUser.uid;
    const unsubscribers: (() => void)[] = [];

    const initializeAndSubscribe = async () => {
      try {
        if (seededDeptsUidRef.current !== uid) {
          const existingDeptsSnap = await getDocs(
            query(collection(db, 'departments'), where('workspaceOwnerId', '==', uid))
          );
          if (existingDeptsSnap.empty) {
            const batch = writeBatch(db);
            buildDefaultDepartments(uid).forEach((dept, i) => {
              batch.set(doc(db, 'departments', `dept_${uid.slice(0, 8)}_${i + 1}`), dept);
            });
            await batch.commit();
          }
          seededDeptsUidRef.current = uid;
        }
      } catch {
        setCloudActive(false);
        return;
      }

      const subscribeCollection = <T extends { id: string }>(
        colName: string,
        storageKey: string,
        setter: React.Dispatch<React.SetStateAction<T[]>>
      ) => {
        const q = query(collection(db, colName), where('workspaceOwnerId', '==', uid));
        const unsub = onSnapshot(
          q,
          (snap) => {
            const items: T[] = snap.docs.map(
              (d) =>
                ({
                  id: d.id,
                  ...d.data(),
                }) as unknown as T
            );
            if (items.length > 0) {
              setter(items);
              saveLocal(storageKey, items);
            }
          },
          () => {
            setCloudActive(false);
          }
        );
        unsubscribers.push(unsub);
      };

      subscribeCollection<EmployeeRecord>('employees', STORAGE_KEYS.EMPLOYEES, setEmployees);
      subscribeCollection<TaskRecord>('tasks', STORAGE_KEYS.TASKS, setTasks);
      subscribeCollection<InstructionRecord>('instructions', STORAGE_KEYS.INSTRUCTIONS, setInstructions);
      subscribeCollection<DepartmentRecord>('departments', STORAGE_KEYS.DEPARTMENTS, setDepartments);
      subscribeCollection<MeetingRecord>('meetings', STORAGE_KEYS.MEETINGS, setMeetings);
      subscribeCollection<AnnouncementRecord>('announcements', STORAGE_KEYS.ANNOUNCEMENTS, setAnnouncements);
      subscribeCollection<NotificationRecord>('notifications', STORAGE_KEYS.NOTIFICATIONS, setNotifications);
      subscribeCollection<ActivityLogRecord>('activityLogs', STORAGE_KEYS.ACTIVITY_LOGS, setActivityLogs);
    };

    initializeAndSubscribe();

    return () => {
      unsubscribers.forEach((u) => u());
    };
  }, [cloudActive]);

  // Resolve currently authenticated & onboarded employee
  const currentEmployee = useMemo(() => {
    if (activeEmployeeId) {
      const byId = employees.find(
        (e) => e.id === activeEmployeeId && e.onboardingStatus === 'ACTIVE'
      );
      if (byId) return byId;
    }
    if (sessionUser.email) {
      const byEmail = employees.find(
        (e) =>
          e.email.toLowerCase() === sessionUser.email.toLowerCase() &&
          e.onboardingStatus === 'ACTIVE'
      );
      if (byEmail) return byEmail;
    }
    return null;
  }, [employees, activeEmployeeId, sessionUser.email]);

  const currentRole: RolePerspective = currentEmployee?.accessLevel || 'Employee';
  const currentUserName = currentEmployee?.fullName || '';
  const firstName = currentUserName.split(' ')[0] || 'Team';

  const selectActiveEmployee = (empId: string | null) => {
    setActiveEmployeeId(empId);
    try {
      if (empId) {
        localStorage.setItem(STORAGE_KEYS.ACTIVE_EMP_ID, empId);
      } else {
        localStorage.removeItem(STORAGE_KEYS.ACTIVE_EMP_ID);
      }
    } catch {
      // Ignore storage errors
    }
  };

  const selectedTask = useMemo(
    () => tasks.find((t) => t.id === selectedTaskId) || null,
    [tasks, selectedTaskId]
  );

  const selectedEmployee = useMemo(
    () => employees.find((e) => e.id === selectedEmployeeId) || null,
    [employees, selectedEmployeeId]
  );

  const unreadNotificationsCount = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications]
  );

  const departmentNames = useMemo(() => {
    const names = departments.map((d) => d.name);
    return names.length > 0
      ? names
      : ['Programmes', 'Outreach', 'Logistics', 'Finance', 'Executive'];
  }, [departments]);

  // Dashboard Metrics
  const myWorkStats = useMemo(() => {
    if (currentRole === 'Top Management') {
      return {
        assigned: tasks.filter((t) => t.status === 'ASSIGNED').length,
        inProgress: tasks.filter((t) => t.status === 'IN PROGRESS').length,
        awaitingReview: tasks.filter(
          (t) => t.status === 'UNDER REVIEW' || t.status === 'SUBMITTED'
        ).length,
        completed: tasks.filter((t) => t.status === 'COMPLETED').length,
      };
    }
    const myTasks = tasks.filter(
      (t) => t.assignees.includes(currentUserName) || t.owner === currentUserName
    );
    const reviewTasks = tasks.filter(
      (t) =>
        (t.reviewer === currentUserName || currentRole === 'Supervisor') &&
        (t.status === 'UNDER REVIEW' || t.status === 'SUBMITTED')
    );
    return {
      assigned: myTasks.filter((t) => t.status === 'ASSIGNED').length,
      inProgress: myTasks.filter((t) => t.status === 'IN PROGRESS').length,
      awaitingReview: reviewTasks.length,
      completed: myTasks.filter((t) => t.status === 'COMPLETED').length,
    };
  }, [tasks, currentUserName, currentRole]);

  const upcomingDeadlines = useMemo(() => {
    const scoped =
      currentRole === 'Employee'
        ? tasks.filter(
            (t) =>
              (t.assignees.includes(currentUserName) || t.owner === currentUserName) &&
              t.status !== 'COMPLETED' &&
              t.status !== 'CANCELLED'
          )
        : tasks.filter((t) => t.status !== 'COMPLETED' && t.status !== 'CANCELLED');
    return [...scoped].sort((a, b) => (b.deadlineIso > a.deadlineIso ? -1 : 1)).slice(0, 4);
  }, [tasks, currentUserName, currentRole]);

  const filteredTasks = useMemo(() => {
    const matched = tasks.filter((t) => {
      const matchesSearch =
        !taskSearch.trim() ||
        t.title.toLowerCase().includes(taskSearch.toLowerCase()) ||
        t.department.toLowerCase().includes(taskSearch.toLowerCase()) ||
        t.owner.toLowerCase().includes(taskSearch.toLowerCase());
      const matchesStatus = taskStatusFilter === 'ALL' || t.status === taskStatusFilter;
      const matchesDept = taskDeptFilter === 'ALL' || t.department === taskDeptFilter;
      const matchesPerson =
        taskPersonFilter === 'ALL' ||
        t.assignees.includes(taskPersonFilter) ||
        t.owner === taskPersonFilter ||
        t.reviewer === taskPersonFilter;
      return matchesSearch && matchesStatus && matchesDept && matchesPerson;
    });

    const dirMultiplier = taskSort.dir === 'asc' ? 1 : -1;
    return [...matched].sort((a, b) => {
      const getVal = (item: TaskRecord) => {
        switch (taskSort.key) {
          case 'title':
            return item.title.toLowerCase();
          case 'status':
            return item.status;
          case 'department':
            return item.department.toLowerCase();
          case 'deadline':
            return item.deadlineIso || '9999-12-31';
          default:
            return '';
        }
      };
      const valA = getVal(a);
      const valB = getVal(b);
      if (valA > valB) return dirMultiplier;
      if (valA < valB) return -dirMultiplier;
      return 0;
    });
  }, [tasks, taskSearch, taskStatusFilter, taskDeptFilter, taskPersonFilter, taskSort]);

  const toggleTaskSort = (key: 'title' | 'status' | 'department' | 'deadline') => {
    setTaskSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
        : { key, dir: 'asc' }
    );
  };

  const filteredEmployees = useMemo(() => {
    return employees.filter((e) => {
      const q = empSearch.trim().toLowerCase();
      const matchesSearch =
        !q ||
        e.fullName.toLowerCase().includes(q) ||
        e.role.toLowerCase().includes(q) ||
        e.email.toLowerCase().includes(q) ||
        (e.staffId && e.staffId.toLowerCase().includes(q)) ||
        (e.nationalId && e.nationalId.toLowerCase().includes(q));
      const matchesDept = empDeptFilter === 'ALL' || e.department === empDeptFilter;
      const matchesRole = empRoleFilter === 'ALL' || e.accessLevel === empRoleFilter;
      const matchesStatus =
        empStatusFilter === 'ALL' || e.onboardingStatus === empStatusFilter;
      return matchesSearch && matchesDept && matchesRole && matchesStatus;
    });
  }, [employees, empSearch, empDeptFilter, empRoleFilter, empStatusFilter]);

  // Dual-Mode Mutation Handlers (Optimistic Local Persistence + Cloud Firestore when active)
  const logActivityAndNotify = async (
    headline: string,
    subtext: string,
    notification?: {
      title: string;
      message: string;
      recipient: string;
      category: 'task_status' | 'feedback' | 'instruction' | 'deadline' | 'announcement';
      relatedTaskId?: string;
    },
    actorOverride?: string
  ) => {
    const uid = auth.currentUser?.uid || sessionUser.uid || defaultUid;
    const nowIso = new Date().toISOString();
    const logId = `log_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`;
    const newLog: ActivityLogRecord = {
      id: logId,
      workspaceOwnerId: uid,
      headline: headline.slice(0, 240),
      subtext: subtext.slice(0, 240),
      actorName: actorOverride || currentUserName || 'ATDP System',
      createdAt: nowIso,
    };

    setActivityLogs((prev) => {
      const updated = [newLog, ...prev];
      saveLocal(STORAGE_KEYS.ACTIVITY_LOGS, updated);
      return updated;
    });

    let newNotif: NotificationRecord | null = null;
    if (notification) {
      const notifId = `notif_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`;
      const displayTime = new Date().toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      });
      newNotif = {
        id: notifId,
        workspaceOwnerId: uid,
        title: notification.title.slice(0, 160),
        message: notification.message.slice(0, 500),
        category: notification.category,
        recipientName: notification.recipient.slice(0, 120),
        read: false,
        relatedTaskId: notification.relatedTaskId || '',
        createdAt: displayTime,
        updatedAt: nowIso,
      };
      setNotifications((prev) => {
        const updated = [newNotif!, ...prev];
        saveLocal(STORAGE_KEYS.NOTIFICATIONS, updated);
        return updated;
      });
      triggerPushAlert(notification.title, notification.message);
    }

    if (cloudActive && auth.currentUser) {
      try {
        const { id: _lid, ...logData } = newLog;
        await setDoc(doc(db, 'activityLogs', logId), logData);
        if (newNotif) {
          const { id: _nid, ...notifData } = newNotif;
          await setDoc(doc(db, 'notifications', newNotif.id), notifData);
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, 'activityLogs_notifications');
      }
    }
  };

  const handleUpdateTask = async (
    taskId: string,
    updates: Partial<TaskRecord>,
    activityHeadline?: string,
    notificationMsg?: {
      title: string;
      message: string;
      recipient: string;
      category: 'task_status' | 'feedback';
    }
  ) => {
    const target = tasks.find((t) => t.id === taskId);
    if (!target) return;
    const nowIso = new Date().toISOString();

    setTasks((prev) => {
      const updated = prev.map((t) =>
        t.id === taskId ? { ...t, ...updates, updatedAt: nowIso } : t
      );
      saveLocal(STORAGE_KEYS.TASKS, updated);
      return updated;
    });

    if (cloudActive && auth.currentUser) {
      try {
        await updateDoc(doc(db, 'tasks', taskId), {
          ...updates,
          updatedAt: nowIso,
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `tasks/${taskId}`);
      }
    }

    if (activityHeadline) {
      const displayTime = new Date().toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      });
      await logActivityAndNotify(
        activityHeadline,
        `${displayTime} · ${target.title}`,
        notificationMsg
          ? {
              ...notificationMsg,
              relatedTaskId: taskId,
            }
          : undefined
      );
    }
  };

  const handleCreateTask = async (
    newTask: Omit<TaskRecord, 'id' | 'workspaceOwnerId' | 'createdAt' | 'updatedAt'>
  ) => {
    const uid = auth.currentUser?.uid || sessionUser.uid || defaultUid;
    const nowIso = new Date().toISOString();
    const taskId = `task_${Date.now()}`;
    const fullTask: TaskRecord = {
      id: taskId,
      ...newTask,
      workspaceOwnerId: uid,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    setTasks((prev) => {
      const updated = [fullTask, ...prev];
      saveLocal(STORAGE_KEYS.TASKS, updated);
      return updated;
    });

    if (cloudActive && auth.currentUser) {
      try {
        const { id: _id, ...taskData } = fullTask;
        await setDoc(doc(db, 'tasks', taskId), taskData);
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `tasks/${taskId}`);
      }
    }

    const displayTime = new Date().toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
    await logActivityAndNotify(
      `New task assigned to ${newTask.assignees.join(', ')}`,
      `${displayTime} · ${newTask.title}`,
      {
        title: `New Task Assigned: ${newTask.title}`,
        message: `${currentUserName} assigned "${newTask.title}" (Due ${newTask.deadline}).`,
        recipient: newTask.assignees[0] || newTask.owner,
        category: 'task_status',
        relatedTaskId: taskId,
      }
    );
  };

  const handleSaveInstruction = async (
    inst: Omit<InstructionRecord, 'id' | 'workspaceOwnerId' | 'createdAt' | 'updatedAt'>
  ) => {
    const uid = auth.currentUser?.uid || sessionUser.uid || defaultUid;
    const nowIso = new Date().toISOString();
    const displayTime = new Date().toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
    const instId = `inst_${Date.now()}`;
    const fullInst: InstructionRecord = {
      id: instId,
      ...inst,
      workspaceOwnerId: uid,
      createdAt: displayTime,
      updatedAt: nowIso,
    };

    setInstructions((prev) => {
      const updated = [fullInst, ...prev];
      saveLocal(STORAGE_KEYS.INSTRUCTIONS, updated);
      return updated;
    });

    if (cloudActive && auth.currentUser) {
      try {
        const { id: _id, ...instData } = fullInst;
        await setDoc(doc(db, 'instructions', instId), instData);
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `instructions/${instId}`);
      }
    }

    await logActivityAndNotify(
      `Instruction recorded by ${currentUserName} (pending confirmation)`,
      `${displayTime} · ${inst.title}`,
      {
        title: 'New Recorded Instruction Pending Confirmation',
        message: `${currentUserName} recorded "${inst.title}" for ${inst.assignedTo}.`,
        recipient: inst.assignedTo,
        category: 'instruction',
      }
    );
  };

  const handleConfirmInstruction = async (inst: InstructionRecord) => {
    const nowIso = new Date().toISOString();
    setInstructions((prev) => {
      const updated = prev.map((item) =>
        item.id === inst.id ? { ...item, status: 'CONFIRMED' as const, updatedAt: nowIso } : item
      );
      saveLocal(STORAGE_KEYS.INSTRUCTIONS, updated);
      return updated;
    });

    if (cloudActive && auth.currentUser) {
      try {
        await updateDoc(doc(db, 'instructions', inst.id), {
          status: 'CONFIRMED',
          updatedAt: nowIso,
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `instructions/${inst.id}`);
      }
    }

    setCreateTaskPrefill({
      title: inst.title,
      description: inst.notes,
      department: inst.department,
      assignee: inst.assignedTo,
      taskSource: 'Verbal/in-person instruction',
    });
    setIsCreateTaskOpen(true);
    triggerPushAlert(
      'Instruction Confirmed',
      `Converting "${inst.title}" into an active assigned task.`
    );
  };

  const handleAddEmployee = async (
    emp: Omit<EmployeeRecord, 'id' | 'workspaceOwnerId' | 'createdAt' | 'updatedAt'>
  ): Promise<void> => {
    const uid = auth.currentUser?.uid || sessionUser.uid || defaultUid;
    const nowIso = new Date().toISOString();
    const empId = `emp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const fullEmp: EmployeeRecord = {
      id: empId,
      ...emp,
      workspaceOwnerId: uid,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    setEmployees((prev) => {
      const updated = [...prev, fullEmp];
      saveLocal(STORAGE_KEYS.EMPLOYEES, updated);
      return updated;
    });

    // If department head is not assigned yet and this user is a Supervisor or Top Management in that dept, update department head
    if (emp.accessLevel === 'Supervisor' || emp.accessLevel === 'Top Management') {
      setDepartments((prev) => {
        const updated = prev.map((d) =>
          d.name === emp.department && (d.headName === 'Unassigned' || !d.headName)
            ? { ...d, headName: emp.fullName }
            : d
        );
        saveLocal(STORAGE_KEYS.DEPARTMENTS, updated);
        return updated;
      });
    }

    if (cloudActive && auth.currentUser) {
      try {
        const { id: _id, ...empData } = fullEmp;
        await setDoc(doc(db, 'employees', empId), empData);
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `employees/${empId}`);
      }
    }

    const displayTime = new Date().toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });

    await logActivityAndNotify(
      emp.onboardingStatus === 'INVITED'
        ? `Employee invitation created for ${emp.fullName} (${emp.email})`
        : `Employee profile registered: ${emp.fullName} (${emp.role})`,
      `${displayTime} · ${emp.department} · ${emp.staffId}`,
      {
        title:
          emp.onboardingStatus === 'INVITED'
            ? `Onboarding Invite Issued: ${emp.fullName}`
            : `Employee Added: ${emp.fullName}`,
        message: `${emp.fullName} (${emp.role}, ${emp.department}) registered with status ${emp.onboardingStatus}.`,
        recipient: emp.fullName,
        category: 'announcement',
      }
    );
  };

  const handleBulkAddEmployees = async (
    newEmps: Omit<EmployeeRecord, 'id' | 'workspaceOwnerId' | 'createdAt' | 'updatedAt'>[]
  ): Promise<void> => {
    if (newEmps.length === 0) return;
    const uid = auth.currentUser?.uid || sessionUser.uid || defaultUid;
    const nowIso = new Date().toISOString();

    const createdRecords: EmployeeRecord[] = newEmps.map((emp, idx) => ({
      id: `emp_${Date.now()}_${idx + 1}`,
      ...emp,
      workspaceOwnerId: uid,
      createdAt: nowIso,
      updatedAt: nowIso,
    }));

    setEmployees((prev) => {
      const updated = [...prev, ...createdRecords];
      saveLocal(STORAGE_KEYS.EMPLOYEES, updated);
      return updated;
    });

    if (cloudActive && auth.currentUser) {
      try {
        const batch = writeBatch(db);
        createdRecords.forEach((rec) => {
          const { id, ...data } = rec;
          batch.set(doc(db, 'employees', id), data);
        });
        await batch.commit();
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, 'employees_bulk_import');
      }
    }

    const displayTime = new Date().toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
    await logActivityAndNotify(
      `Bulk imported ${createdRecords.length} employee records into database`,
      `${displayTime} · CSV Batch Import`,
      {
        title: `Bulk Import Complete (${createdRecords.length} Staff)`,
        message: `${createdRecords.length} employee records were imported into the ATDP Employee Database.`,
        recipient: currentUserName || 'Top Management',
        category: 'announcement',
      }
    );
  };

  const handleUpdateEmployee = async (empId: string, updates: Partial<EmployeeRecord>) => {
    const nowIso = new Date().toISOString();
    setEmployees((prev) => {
      const updated = prev.map((e) =>
        e.id === empId ? { ...e, ...updates, updatedAt: nowIso } : e
      );
      saveLocal(STORAGE_KEYS.EMPLOYEES, updated);
      return updated;
    });

    if (cloudActive && auth.currentUser) {
      try {
        await updateDoc(doc(db, 'employees', empId), {
          ...updates,
          updatedAt: nowIso,
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `employees/${empId}`);
      }
    }

    triggerPushAlert('Employee Record Updated', 'Profile and performance changes saved.');
  };

  // Onboarding Handlers
  const handleCompleteExecutiveSetup = async (
    execProfile: Omit<EmployeeRecord, 'id' | 'workspaceOwnerId' | 'createdAt' | 'updatedAt'>
  ): Promise<EmployeeRecord> => {
    const uid = auth.currentUser?.uid || sessionUser.uid || defaultUid;
    const nowIso = new Date().toISOString();
    const empId = `emp_exec_${Date.now()}`;
    const fullEmp: EmployeeRecord = {
      id: empId,
      ...execProfile,
      workspaceOwnerId: uid,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    setEmployees((prev) => {
      const updated = [fullEmp, ...prev];
      saveLocal(STORAGE_KEYS.EMPLOYEES, updated);
      return updated;
    });

    setDepartments((prev) => {
      const updated = prev.map((d) =>
        d.name === fullEmp.department || d.name === 'Executive'
          ? { ...d, headName: fullEmp.fullName }
          : d
      );
      saveLocal(STORAGE_KEYS.DEPARTMENTS, updated);
      return updated;
    });

    if (cloudActive && auth.currentUser) {
      try {
        const { id: _id, ...empData } = fullEmp;
        await setDoc(doc(db, 'employees', empId), empData);
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `employees/${empId}`);
      }
    }

    selectActiveEmployee(empId);
    setIsOnboardingPortalOpen(false);

    const displayTime = new Date().toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
    await logActivityAndNotify(
      `Executive workspace initialized by ${fullEmp.fullName}`,
      `${displayTime} · ${fullEmp.role} (${fullEmp.staffId})`,
      undefined,
      fullEmp.fullName
    );
    triggerPushAlert(
      'ATDP Workspace Ready',
      `Signed in as ${fullEmp.fullName} (Top Management).`
    );
    return fullEmp;
  };

  const handleClaimInvitedProfile = async (
    employeeId: string,
    updates: Partial<EmployeeRecord>
  ): Promise<EmployeeRecord> => {
    const nowIso = new Date().toISOString();
    let claimedRecord: EmployeeRecord | null = null;

    setEmployees((prev) => {
      const updated = prev.map((e) => {
        if (e.id === employeeId) {
          claimedRecord = {
            ...e,
            ...updates,
            onboardingStatus: 'ACTIVE',
            updatedAt: nowIso,
          };
          return claimedRecord;
        }
        return e;
      });
      saveLocal(STORAGE_KEYS.EMPLOYEES, updated);
      return updated;
    });

    if (cloudActive && auth.currentUser) {
      try {
        await updateDoc(doc(db, 'employees', employeeId), {
          ...updates,
          onboardingStatus: 'ACTIVE',
          updatedAt: nowIso,
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `employees/${employeeId}`);
      }
    }

    const finalEmp =
      claimedRecord ||
      (employees.find((e) => e.id === employeeId) as EmployeeRecord);

    selectActiveEmployee(employeeId);
    setIsOnboardingPortalOpen(false);
    setActiveNav('dashboard');

    const displayTime = new Date().toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
    await logActivityAndNotify(
      `${finalEmp.fullName} completed employee onboarding and activated their account`,
      `${displayTime} · ${finalEmp.department} (${finalEmp.role})`,
      {
        title: `Employee Onboarded: ${finalEmp.fullName}`,
        message: `${finalEmp.fullName} (${finalEmp.staffId}) has verified their profile and HR documents.`,
        recipient: finalEmp.managerName || 'Top Management',
        category: 'announcement',
      },
      finalEmp.fullName
    );

    return finalEmp;
  };

  const handleScheduleMeeting = async (
    mtg: Omit<MeetingRecord, 'id' | 'workspaceOwnerId' | 'createdAt'>
  ) => {
    const uid = auth.currentUser?.uid || sessionUser.uid || defaultUid;
    const nowIso = new Date().toISOString();
    const mtgId = `mtg_${Date.now()}`;
    const fullMtg: MeetingRecord = {
      id: mtgId,
      ...mtg,
      workspaceOwnerId: uid,
      createdAt: nowIso,
    };

    setMeetings((prev) => {
      const updated = [fullMtg, ...prev];
      saveLocal(STORAGE_KEYS.MEETINGS, updated);
      return updated;
    });

    if (cloudActive && auth.currentUser) {
      try {
        const { id: _id, ...mtgData } = fullMtg;
        await setDoc(doc(db, 'meetings', mtgId), mtgData);
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `meetings/${mtgId}`);
      }
    }

    triggerPushAlert(
      'Meeting Scheduled',
      `"${mtg.title}" scheduled for ${mtg.date} at ${mtg.time}.`
    );
  };

  const handleCreateDepartment = async (
    dept: Omit<DepartmentRecord, 'id' | 'workspaceOwnerId' | 'createdAt'>
  ) => {
    const uid = auth.currentUser?.uid || sessionUser.uid || defaultUid;
    const nowIso = new Date().toISOString();
    const deptId = `dept_${Date.now()}`;
    const fullDept: DepartmentRecord = {
      id: deptId,
      ...dept,
      workspaceOwnerId: uid,
      createdAt: nowIso,
    };

    setDepartments((prev) => {
      const updated = [...prev, fullDept];
      saveLocal(STORAGE_KEYS.DEPARTMENTS, updated);
      return updated;
    });

    if (cloudActive && auth.currentUser) {
      try {
        const { id: _id, ...deptData } = fullDept;
        await setDoc(doc(db, 'departments', deptId), deptData);
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `departments/${deptId}`);
      }
    }

    const displayTime = new Date().toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
    await logActivityAndNotify(
      `New department created: ${dept.name}`,
      `${displayTime} · Head: ${dept.headName} · Desks: ${dept.desks.join(', ')}`
    );
    triggerPushAlert(
      'Department Created',
      `${dept.name} has been added to ATDP Departments.`
    );
  };

  const handlePublishAnnouncement = async (
    ann: Omit<AnnouncementRecord, 'id' | 'workspaceOwnerId' | 'createdAt'>
  ) => {
    const uid = auth.currentUser?.uid || sessionUser.uid || defaultUid;
    const displayDate = new Date().toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
    const annId = `ann_${Date.now()}`;
    const fullAnn: AnnouncementRecord = {
      id: annId,
      ...ann,
      workspaceOwnerId: uid,
      createdAt: displayDate,
    };

    setAnnouncements((prev) => {
      const updated = [fullAnn, ...prev];
      saveLocal(STORAGE_KEYS.ANNOUNCEMENTS, updated);
      return updated;
    });

    if (cloudActive && auth.currentUser) {
      try {
        const { id: _id, ...annData } = fullAnn;
        await setDoc(doc(db, 'announcements', annId), annData);
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `announcements/${annId}`);
      }
    }

    await logActivityAndNotify(
      `Announcement posted: ${ann.title}`,
      `${displayDate} · ${ann.department}`,
      {
        title: `Announcement: ${ann.title}`,
        message: ann.body.slice(0, 180),
        recipient: 'All Staff',
        category: 'announcement',
      }
    );
  };

  const handleMarkNotificationRead = async (notifId: string) => {
    const nowIso = new Date().toISOString();
    setNotifications((prev) => {
      const updated = prev.map((n) =>
        n.id === notifId ? { ...n, read: true, updatedAt: nowIso } : n
      );
      saveLocal(STORAGE_KEYS.NOTIFICATIONS, updated);
      return updated;
    });

    if (cloudActive && auth.currentUser) {
      try {
        await updateDoc(doc(db, 'notifications', notifId), {
          read: true,
          updatedAt: nowIso,
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `notifications/${notifId}`);
      }
    }
  };

  const handleMarkAllNotificationsRead = async () => {
    const unread = notifications.filter((n) => !n.read);
    if (unread.length === 0) return;
    const nowIso = new Date().toISOString();

    setNotifications((prev) => {
      const updated = prev.map((n) => ({ ...n, read: true, updatedAt: nowIso }));
      saveLocal(STORAGE_KEYS.NOTIFICATIONS, updated);
      return updated;
    });

    if (cloudActive && auth.currentUser) {
      try {
        const batch = writeBatch(db);
        unread.forEach((n) => {
          batch.update(doc(db, 'notifications', n.id), {
            read: true,
            updatedAt: nowIso,
          });
        });
        await batch.commit();
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, 'notifications_batch_read');
      }
    }
  };

  const selectEmployeeByName = (name: string) => {
    const found = employees.find(
      (e) => e.fullName.toLowerCase() === name.trim().toLowerCase()
    );
    if (found) {
      setSelectedEmployeeId(found.id);
    }
  };

  const handleGoogleSignIn = async (): Promise<{ email: string; displayName: string } | null> => {
    try {
      const cred = await signInWithPopup(auth, googleProvider, browserPopupRedirectResolver);
      const email = cred.user.email || '';
      const displayName = cred.user.displayName || '';
      triggerPushAlert('Google Account Connected', `Verified ${email}`);
      return { email, displayName };
    } catch {
      triggerPushAlert(
        'Email Verification Mode',
        'Enter your official ATDP email address below to sign in or claim your invitation.'
      );
      return null;
    }
  };

  const handleExportEmployeeDatabaseCsv = () => {
    const headers = [
      'StaffID',
      'FullName',
      'Email',
      'Phone',
      'NationalID',
      'JobTitle',
      'AccessLevel',
      'Department',
      'Desk',
      'ManagerName',
      'Location',
      'JoinDate',
      'OnboardingStatus',
      'PerformanceScore',
      'OnTimeRate',
    ];
    const rows = employees.map((e) =>
      [
        e.staffId || '',
        `"${(e.fullName || '').replace(/"/g, '""')}"`,
        e.email || '',
        `"${(e.phone || '').replace(/"/g, '""')}"`,
        e.nationalId || '',
        `"${(e.role || '').replace(/"/g, '""')}"`,
        e.accessLevel || 'Employee',
        e.department || '',
        `"${(e.desk || '').replace(/"/g, '""')}"`,
        `"${(e.managerName || '').replace(/"/g, '""')}"`,
        `"${(e.location || '').replace(/"/g, '""')}"`,
        e.joinDate || '',
        e.onboardingStatus || 'ACTIVE',
        String(e.performanceScore ?? 100),
        String(e.onTimeRate ?? 100),
      ].join(',')
    );
    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ATDP_Employee_Database_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // If no active employee is signed in or the user opened the Onboarding / Account Portal, show OnboardingFlow
  if (!currentEmployee || isOnboardingPortalOpen) {
    return (
      <div className="relative">
        {currentEmployee && isOnboardingPortalOpen && (
          <div className="bg-slate-900 text-white px-4 py-2.5 text-xs flex items-center justify-between">
            <span>
              Currently signed in as <strong>{currentEmployee.fullName}</strong> ({currentEmployee.accessLevel}). You can switch accounts or test claiming a pending employee invitation below.
            </span>
            <button
              type="button"
              onClick={() => setIsOnboardingPortalOpen(false)}
              className="px-3 py-1 rounded-lg bg-white/10 hover:bg-white/20 font-semibold transition-colors"
            >
              Return to Workspace →
            </button>
          </div>
        )}
        <OnboardingFlow
          employees={employees}
          departments={departmentNames}
          defaultEmail={sessionUser.email}
          onCompleteExecutiveSetup={handleCompleteExecutiveSetup}
          onClaimInvitedProfile={handleClaimInvitedProfile}
          onSelectExistingActiveUser={(emp) => {
            selectActiveEmployee(emp.id);
            setIsOnboardingPortalOpen(false);
            triggerPushAlert('Signed In', `Welcome back, ${emp.fullName} (${emp.accessLevel}).`);
          }}
          onGoogleSignIn={handleGoogleSignIn}
        />
      </div>
    );
  }

  const invitedCount = employees.filter((e) => e.onboardingStatus === 'INVITED').length;
  const activeStaffCount = employees.filter((e) => e.onboardingStatus === 'ACTIVE').length;

  // Unified Navigation items (all employee tools merged under Employees)
  const navItems: { id: NavSection; label: string; icon: React.ReactNode; badge?: number }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: <LayoutGrid className="w-4 h-4" /> },
    { id: 'tasks', label: 'Tasks', icon: <ListTodo className="w-4 h-4" /> },
    {
      id: 'employees',
      label: 'Employees',
      icon: <Users className="w-4 h-4" />,
      badge: invitedCount > 0 ? invitedCount : undefined,
    },
    { id: 'departments', label: 'Departments', icon: <Building2 className="w-4 h-4" /> },
    { id: 'meetings', label: 'Meetings', icon: <Calendar className="w-4 h-4" /> },
    { id: 'announcements', label: 'Announcements', icon: <Megaphone className="w-4 h-4" /> },
    {
      id: 'notifications',
      label: 'Notifications',
      icon: <Bell className="w-4 h-4" />,
      badge: unreadNotificationsCount > 0 ? unreadNotificationsCount : undefined,
    },
    { id: 'profile', label: 'My Profile', icon: <UserIcon className="w-4 h-4" /> },
  ];

  const pendingInstructions = instructions.filter((i) => i.status === 'PENDING');
  const sortedActivityLogs = [...activityLogs]
    .sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1))
    .slice(0, 6);

  return (
    <div className="min-h-screen flex bg-[#F8FAFC] text-[#0F172A]">
      {/* Real-time Push Toast Stack */}
      {toasts.length > 0 && (
        <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
          {toasts.map((t) => (
            <div
              key={t.id}
              className="pointer-events-auto bg-slate-900 text-white px-4 py-3 rounded-xl shadow-lg border border-slate-700 flex items-start justify-between gap-3"
            >
              <div className="space-y-0.5">
                <p className="text-xs font-semibold">{t.title}</p>
                <p className="text-[11px] text-slate-300 leading-snug">{t.message}</p>
              </div>
              <button
                type="button"
                onClick={() => setToasts((prev) => prev.filter((item) => item.id !== t.id))}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Desktop Left Sidebar */}
      <aside className="hidden md:flex md:w-60 lg:w-64 flex-col bg-white border-r border-slate-200/90 shrink-0 select-none">
        {/* Brand Header */}
        <div className="h-16 px-5 flex items-center gap-3 border-b border-slate-100">
          <div className="w-9 h-9 rounded-xl bg-[#0F172A] text-white font-display font-bold flex items-center justify-center text-sm shrink-0">
            A
          </div>
          <div className="leading-tight">
            <div className="font-display font-bold text-sm text-slate-900">ATDP</div>
            <div className="text-xs text-slate-500">Workforce Management</div>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 px-3 py-5 space-y-1">
          {navItems.map((item) => {
            const isActive = activeNav === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveNav(item.id)}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-[#0F172A] text-white font-semibold shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
                }`}
              >
                <span className="flex items-center gap-3">
                  {item.icon}
                  <span>{item.label}</span>
                </span>
                {item.badge !== undefined && (
                  <span
                    className={`px-1.5 py-0.5 text-[10px] font-mono-tabular font-bold rounded-full ${
                      isActive
                        ? 'bg-white text-slate-900'
                        : item.id === 'employees'
                        ? 'bg-amber-500 text-white'
                        : 'bg-rose-500 text-white'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Bottom Verified Account Summary */}
        <div className="p-4 m-3 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1.5">
          <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500">
            <span>Verified Session</span>
            <span className="font-mono-tabular text-slate-700">{currentEmployee.staffId}</span>
          </div>
          <div className="text-xs font-bold text-slate-900 truncate">
            {currentEmployee.fullName}
          </div>
          <div className="text-[11px] text-slate-500 flex items-center justify-between">
            <span>{currentEmployee.accessLevel}</span>
            <span>{currentEmployee.department}</span>
          </div>
        </div>
      </aside>

      {/* Mobile Drawer Overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div
            className="fixed inset-0 bg-slate-900/40"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside className="relative w-64 max-w-[80vw] bg-white h-full flex flex-col z-10 shadow-xl">
            <div className="h-16 px-5 flex items-center justify-between border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-[#0F172A] text-white font-display font-bold flex items-center justify-center text-sm">
                  A
                </div>
                <div>
                  <div className="font-display font-bold text-sm text-slate-900">ATDP</div>
                  <div className="text-[11px] text-slate-500">Workforce Management</div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
              {navItems.map((item) => {
                const isActive = activeNav === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setActiveNav(item.id);
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium ${
                      isActive
                        ? 'bg-[#0F172A] text-white font-semibold'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <span className="flex items-center gap-3">
                      {item.icon}
                      <span>{item.label}</span>
                    </span>
                    {item.badge !== undefined && (
                      <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-rose-500 text-white">
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          </aside>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar (No Demo Switcher; clean live workspace status & actions) */}
        <header className="h-16 bg-white border-b border-slate-200/90 px-4 sm:px-8 flex items-center justify-between gap-4 sticky top-0 z-30">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="md:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-100"
              aria-label="Open menu"
            >
              <Menu className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2.5">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-100 text-slate-800 text-xs font-semibold">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>{currentEmployee.accessLevel}</span>
              </span>
              <span className="hidden sm:inline-block text-xs text-slate-500">
                {currentEmployee.department} · {currentEmployee.desk}
              </span>
              <span className="hidden md:inline-block text-xs font-mono-tabular text-slate-400">
                ({currentEmployee.staffId})
              </span>
            </div>
          </div>

          {/* Right Notification Bell & Profile Menu */}
          <div className="flex items-center gap-3 sm:gap-4">
            {currentRole === 'Top Management' && (
              <button
                type="button"
                onClick={() => {
                  setEmpWorkspaceTab('register');
                  setActiveNav('employees');
                }}
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-800 transition-colors"
              >
                <UserPlus className="w-3.5 h-3.5 text-slate-600" />
                <span>Invite Staff</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setActiveNav('notifications')}
              className="relative p-2 rounded-full text-slate-600 hover:bg-slate-100 transition-colors"
              aria-label="Notifications"
            >
              <Bell className="w-5 h-5" />
              {unreadNotificationsCount > 0 && (
                <span className="absolute top-1 right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white text-[10px] font-mono-tabular font-bold flex items-center justify-center">
                  {unreadNotificationsCount}
                </span>
              )}
            </button>

            <div className="relative">
              <button
                type="button"
                onClick={() => setUserMenuOpen((o) => !o)}
                className="flex items-center gap-2.5 pl-1.5 pr-3 py-1 rounded-full border border-slate-200 hover:bg-slate-50 transition-colors"
              >
                <Avatar
                  name={currentEmployee.fullName}
                  color={currentEmployee.avatarColor}
                  size="sm"
                />
                <div className="text-left hidden sm:block leading-tight">
                  <div className="text-xs font-bold text-slate-900">
                    {currentEmployee.fullName}
                  </div>
                  <div className="text-[11px] text-slate-500">{currentEmployee.role}</div>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </button>

              {userMenuOpen && (
                <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-lg border border-slate-200 py-1.5 z-40">
                  <div className="px-4 py-2.5 border-b border-slate-100 space-y-0.5">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold text-slate-900">
                        {currentEmployee.fullName}
                      </p>
                      <span className="text-[10px] font-mono-tabular font-semibold bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded">
                        {currentEmployee.staffId}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 truncate">{currentEmployee.email}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveNav('profile');
                      setUserMenuOpen(false);
                    }}
                    className="w-full px-4 py-2 text-left text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                  >
                    <UserIcon className="w-3.5 h-3.5" />
                    My Profile & Documents
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEmpWorkspaceTab('directory');
                      setActiveNav('employees');
                      setUserMenuOpen(false);
                    }}
                    className="w-full px-4 py-2 text-left text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                  >
                    <Users className="w-3.5 h-3.5" />
                    Employees & Database
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setUserMenuOpen(false);
                      setIsOnboardingPortalOpen(true);
                    }}
                    className="w-full px-4 py-2 text-left text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2 border-t border-slate-100"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    Switch Account / Onboarding Portal
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Main Viewport Container */}
        <main className="flex-1 px-4 sm:px-8 py-7 max-w-7xl w-full mx-auto">
          {/* ================================================================
           * VIEW 1: DASHBOARD
           * ================================================================ */}
          {activeNav === 'dashboard' && (
            <div className="space-y-6">
              {/* Top Greeting & Primary Action */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-display font-bold text-slate-900">
                    Welcome, {firstName}
                  </h1>
                  <p className="text-sm text-slate-500 mt-0.5">
                    {currentEmployee.role} · {currentEmployee.department} ({currentEmployee.desk})
                  </p>
                </div>
                <div className="flex items-center gap-2.5 self-start sm:self-auto">
                  {currentRole === 'Top Management' && (
                    <button
                      type="button"
                      onClick={() => {
                        setEmpWorkspaceTab('register');
                        setActiveNav('employees');
                      }}
                      className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-800 text-xs font-semibold hover:bg-slate-50 transition-colors shadow-2xs whitespace-nowrap"
                    >
                      <UserPlus className="w-4 h-4" />
                      <span>Add / Invite Employee</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setCreateTaskPrefill(undefined);
                      setIsCreateTaskOpen(true);
                    }}
                    className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#0F172A] text-white text-xs font-semibold hover:bg-slate-800 transition-colors shadow-xs whitespace-nowrap"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Create Task</span>
                  </button>
                </div>
              </div>

              {/* Quick Action Buttons (5-Button Row Inspired by ATDP Workforce Flow) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                <button
                  type="button"
                  onClick={() => setIsRecordInstOpen(true)}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white border border-slate-200/90 hover:border-slate-300 hover:bg-slate-50/60 text-xs font-semibold text-slate-800 transition-colors shadow-2xs"
                >
                  <Mic className="w-4 h-4 text-slate-600 shrink-0" />
                  <span>Record an Instruction</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCreateTaskPrefill(undefined);
                    setIsCreateTaskOpen(true);
                  }}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white border border-slate-200/90 hover:border-slate-300 hover:bg-slate-50/60 text-xs font-semibold text-slate-800 transition-colors shadow-2xs"
                >
                  <Plus className="w-4 h-4 text-slate-600 shrink-0" />
                  <span>Create Task</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEmpWorkspaceTab('directory');
                    setActiveNav('employees');
                  }}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white border border-slate-200/90 hover:border-slate-300 hover:bg-slate-50/60 text-xs font-semibold text-slate-800 transition-colors shadow-2xs"
                >
                  <Users className="w-4 h-4 text-slate-600 shrink-0" />
                  <span>View Employees ({employees.length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsCreateAnnouncementOpen(true)}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white border border-slate-200/90 hover:border-slate-300 hover:bg-slate-50/60 text-xs font-semibold text-slate-800 transition-colors shadow-2xs"
                >
                  <Megaphone className="w-4 h-4 text-slate-600 shrink-0" />
                  <span>Send Announcement</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsScheduleMeetingOpen(true)}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white border border-slate-200/90 hover:border-slate-300 hover:bg-slate-50/60 text-xs font-semibold text-slate-800 transition-colors shadow-2xs"
                >
                  <Calendar className="w-4 h-4 text-slate-600 shrink-0" />
                  <span>Schedule Meeting</span>
                </button>
              </div>

              {/* MY WORK / ORGANIZATION WORKLOAD Section */}
              <div className="space-y-3">
                <h2 className="text-xs font-bold tracking-wider text-slate-500">
                  {currentRole === 'Top Management' ? 'ORGANIZATION WORKLOAD' : 'MY WORK'}
                </h2>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <button
                    type="button"
                    onClick={() => {
                      setTaskStatusFilter('ASSIGNED');
                      setActiveNav('tasks');
                    }}
                    className="p-5 rounded-2xl bg-white border border-slate-200/90 shadow-2xs text-left hover:border-slate-300 transition-colors"
                  >
                    <div className="text-xs text-slate-500">Assigned to me</div>
                    <div className="text-2xl font-display font-bold font-mono-tabular text-slate-900 mt-2">
                      {myWorkStats.assigned}
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTaskStatusFilter('IN PROGRESS');
                      setActiveNav('tasks');
                    }}
                    className="p-5 rounded-2xl bg-white border border-slate-200/90 shadow-2xs text-left hover:border-slate-300 transition-colors"
                  >
                    <div className="text-xs text-slate-500">In progress</div>
                    <div className="text-2xl font-display font-bold font-mono-tabular text-slate-900 mt-2">
                      {myWorkStats.inProgress}
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTaskStatusFilter('UNDER REVIEW');
                      setActiveNav('tasks');
                    }}
                    className="p-5 rounded-2xl bg-white border border-slate-200/90 shadow-2xs text-left hover:border-slate-300 transition-colors"
                  >
                    <div className="text-xs text-slate-500">Awaiting my review</div>
                    <div className="text-2xl font-display font-bold font-mono-tabular text-slate-900 mt-2">
                      {myWorkStats.awaitingReview}
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTaskStatusFilter('COMPLETED');
                      setActiveNav('tasks');
                    }}
                    className="p-5 rounded-2xl bg-white border border-slate-200/90 shadow-2xs text-left hover:border-slate-300 transition-colors"
                  >
                    <div className="text-xs text-slate-500">Completed</div>
                    <div className="text-2xl font-display font-bold font-mono-tabular text-slate-900 mt-2">
                      {myWorkStats.completed}
                    </div>
                  </button>
                </div>
              </div>

              {/* Upcoming Deadlines Card */}
              <div className="p-6 rounded-2xl bg-white border border-slate-200/90 shadow-2xs space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-display font-bold text-slate-900">
                    Upcoming Deadlines
                  </h3>
                  <button
                    type="button"
                    onClick={() => setActiveNav('tasks')}
                    className="text-xs font-medium text-blue-600 hover:underline"
                  >
                    View all →
                  </button>
                </div>
                <div className="divide-y divide-slate-100">
                  {upcomingDeadlines.length === 0 ? (
                    <div className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <p className="text-xs text-slate-400">
                        No open task deadlines yet. Assign a task to begin tracking deadlines.
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setCreateTaskPrefill(undefined);
                          setIsCreateTaskOpen(true);
                        }}
                        className="text-xs font-semibold text-slate-900 hover:underline self-start sm:self-auto"
                      >
                        + Assign first task
                      </button>
                    </div>
                  ) : (
                    upcomingDeadlines.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setSelectedTaskId(t.id)}
                        className="w-full py-3.5 first:pt-1 last:pb-1 flex items-center justify-between gap-4 text-left hover:bg-slate-50/70 rounded-lg px-2 -mx-2 transition-colors"
                      >
                        <span className="text-sm font-semibold text-slate-900">{t.title}</span>
                        <div className="flex items-center gap-4 shrink-0">
                          <span
                            className={`px-3 py-0.5 rounded-full text-[11px] font-semibold ${getStatusBadgeStyle(
                              t.status
                            )}`}
                          >
                            {t.status}
                          </span>
                          <span className="text-xs text-slate-500 font-mono-tabular">
                            {t.deadline}
                          </span>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>

              {/* Bottom 2-Column Split: Recent Activity & Organisation Activity / Pending Confirmation */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Recent Activity */}
                <div className="p-6 rounded-2xl bg-white border border-slate-200/90 shadow-2xs space-y-4">
                  <h3 className="text-sm font-display font-bold text-slate-900">
                    Recent Activity
                  </h3>
                  <div className="divide-y divide-slate-100">
                    {sortedActivityLogs.length === 0 ? (
                      <p className="text-xs text-slate-400 py-4">
                        Workspace activity will appear here as tasks, staff, and reviews are logged.
                      </p>
                    ) : (
                      sortedActivityLogs.map((log) => (
                        <div key={log.id} className="py-3 first:pt-0 last:pb-0 space-y-1">
                          <p className="text-sm text-slate-800">{log.headline}</p>
                          <p className="text-xs text-slate-400">{log.subtext}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Organisation Activity & Pending Confirmation (Merged from ATDP Workforce Flow) */}
                <div className="p-6 rounded-2xl bg-white border border-slate-200/90 shadow-2xs space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-display font-bold text-slate-900">
                      {currentRole === 'Employee'
                        ? 'Pending Confirmation'
                        : 'Organisation Activity & Confirmations'}
                    </h3>
                    <button
                      type="button"
                      onClick={() => setIsRecordInstOpen(true)}
                      className="text-xs font-medium text-slate-600 hover:text-slate-900"
                    >
                      + Record instruction
                    </button>
                  </div>

                  {/* 3-Box Org Summary (Active, Awaiting Review, Completed) */}
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div className="rounded-xl bg-slate-50 border border-slate-100 p-3">
                      <div className="text-xl font-display font-bold font-mono-tabular text-slate-900">
                        {
                          tasks.filter(
                            (t) =>
                              t.status === 'ASSIGNED' ||
                              t.status === 'IN PROGRESS' ||
                              t.status === 'BACKLOG'
                          ).length
                        }
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">Active tasks</div>
                    </div>
                    <div className="rounded-xl bg-slate-50 border border-slate-100 p-3">
                      <div className="text-xl font-display font-bold font-mono-tabular text-slate-900">
                        {
                          tasks.filter(
                            (t) => t.status === 'UNDER REVIEW' || t.status === 'SUBMITTED'
                          ).length
                        }
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">Awaiting review</div>
                    </div>
                    <div className="rounded-xl bg-slate-50 border border-slate-100 p-3">
                      <div className="text-xl font-display font-bold font-mono-tabular text-emerald-700">
                        {tasks.filter((t) => t.status === 'COMPLETED').length}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">Completed</div>
                    </div>
                  </div>

                  {/* Tasks with status === 'PENDING CONFIRMATION' */}
                  {tasks.filter((t) => t.status === 'PENDING CONFIRMATION').length > 0 && (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-3.5 space-y-2">
                      <div className="text-xs font-semibold text-amber-800">
                        {tasks.filter((t) => t.status === 'PENDING CONFIRMATION').length} task(s)
                        awaiting confirmation
                      </div>
                      <ul className="space-y-1.5">
                        {tasks
                          .filter((t) => t.status === 'PENDING CONFIRMATION')
                          .map((t) => (
                            <li
                              key={t.id}
                              className="flex items-center justify-between gap-2 text-xs"
                            >
                              <button
                                type="button"
                                onClick={() => setSelectedTaskId(t.id)}
                                className="font-medium text-amber-900 hover:underline text-left"
                              >
                                {t.title} →
                              </button>
                              {(currentRole === 'Supervisor' ||
                                currentRole === 'Top Management') && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleUpdateTask(
                                      t.id,
                                      { status: 'ASSIGNED' },
                                      `Confirmed task: ${t.title}`
                                    )
                                  }
                                  className="px-2 py-0.5 rounded bg-amber-800 text-white text-[10px] font-semibold hover:bg-amber-900 shrink-0"
                                >
                                  Confirm
                                </button>
                              )}
                            </li>
                          ))}
                      </ul>
                    </div>
                  )}

                  {/* Recorded Voice Instructions Pending Confirmation */}
                  <div className="divide-y divide-slate-100">
                    {pendingInstructions.length === 0 &&
                    tasks.filter((t) => t.status === 'PENDING CONFIRMATION').length === 0 ? (
                      <p className="text-xs text-slate-400 py-2">
                        No tasks or voice instructions awaiting confirmation.
                      </p>
                    ) : (
                      pendingInstructions.map((inst) => (
                        <div
                          key={inst.id}
                          className="py-3 first:pt-0 last:pb-0 flex flex-col gap-2"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-semibold text-slate-900">{inst.title}</p>
                              <p className="text-xs text-slate-400 mt-0.5">
                                Recorded by {inst.recordedBy} · {inst.department}
                              </p>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <button
                                type="button"
                                onClick={() =>
                                  setPlayingInstructionId(
                                    playingInstructionId === inst.id ? null : inst.id
                                  )
                                }
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-medium transition-colors"
                              >
                                <Volume2 className="w-3.5 h-3.5" />
                                <span>
                                  {playingInstructionId === inst.id
                                    ? 'Hide Note'
                                    : `${inst.durationSec}s Audio`}
                                </span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleConfirmInstruction(inst)}
                                className="px-2.5 py-1 rounded-lg bg-slate-900 text-white hover:bg-slate-800 text-[11px] font-semibold transition-colors"
                              >
                                Confirm & Assign
                              </button>
                            </div>
                          </div>

                          {playingInstructionId === inst.id && (
                            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 text-xs text-slate-700 space-y-2">
                              <p className="font-medium text-slate-900">
                                Recorded Transcript / Instruction Note:
                              </p>
                              <p>{inst.notes}</p>
                              {inst.audioDataUrl && (
                                <audio controls src={inst.audioDataUrl} className="w-full h-8" />
                              )}
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>

                  {/* View all departments footer link */}
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                    <span className="text-slate-500">View all departments</span>
                    <button
                      type="button"
                      onClick={() => setActiveNav('departments')}
                      className="font-semibold text-slate-800 hover:text-blue-600"
                    >
                      Open →
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ================================================================
           * VIEW 2: TASKS
           * ================================================================ */}
          {activeNav === 'tasks' && (
            <div className="space-y-6">
              {/* Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-display font-bold text-slate-900">Tasks</h1>
                  <p className="text-sm text-slate-500 mt-0.5 font-mono-tabular">
                    {filteredTasks.length} of {tasks.length} tasks
                  </p>
                </div>
                <div className="flex items-center gap-2 self-start sm:self-auto">
                  <button
                    type="button"
                    onClick={() => setIsRecordInstOpen(true)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 text-xs font-semibold hover:bg-slate-50 transition-colors"
                  >
                    <Mic className="w-3.5 h-3.5" />
                    <span>Record Instruction</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setCreateTaskPrefill(undefined);
                      setIsCreateTaskOpen(true);
                    }}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#0F172A] text-white text-xs font-semibold hover:bg-slate-800 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Create Task</span>
                  </button>
                </div>
              </div>

              {/* Filter Bar */}
              <div className="flex flex-wrap items-center gap-3">
                <div className="relative flex-1 min-w-[220px] max-w-sm">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={taskSearch}
                    onChange={(e) => setTaskSearch(e.target.value)}
                    placeholder="Search tasks..."
                    className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                </div>

                <select
                  value={taskStatusFilter}
                  onChange={(e) => setTaskStatusFilter(e.target.value)}
                  className="px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-900"
                >
                  <option value="ALL">All statuses</option>
                  {ALL_TASK_STATUSES.map((st) => (
                    <option key={st} value={st}>
                      {st}
                    </option>
                  ))}
                </select>

                <select
                  value={taskDeptFilter}
                  onChange={(e) => setTaskDeptFilter(e.target.value)}
                  className="px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-900"
                >
                  <option value="ALL">All departments</option>
                  {departmentNames.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>

                <select
                  value={taskPersonFilter}
                  onChange={(e) => setTaskPersonFilter(e.target.value)}
                  className="px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-900"
                >
                  <option value="ALL">All people</option>
                  {employees.map((e) => (
                    <option key={e.id} value={e.fullName}>
                      {e.fullName}
                    </option>
                  ))}
                </select>

                {(taskSearch ||
                  taskStatusFilter !== 'ALL' ||
                  taskDeptFilter !== 'ALL' ||
                  taskPersonFilter !== 'ALL') && (
                  <button
                    type="button"
                    onClick={() => {
                      setTaskSearch('');
                      setTaskStatusFilter('ALL');
                      setTaskDeptFilter('ALL');
                      setTaskPersonFilter('ALL');
                    }}
                    className="text-xs font-medium text-slate-500 hover:text-slate-900 px-2 py-1"
                  >
                    Reset filters
                  </button>
                )}
              </div>

              {/* Tasks Table (Sortable Headers Inspired by ATDP Workforce Flow) */}
              <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 text-xs font-semibold text-slate-500 bg-slate-50/50">
                        <th className="py-3.5 px-5">
                          <button
                            type="button"
                            onClick={() => toggleTaskSort('title')}
                            className="inline-flex items-center gap-1 hover:text-slate-900"
                          >
                            <span>Task</span>
                            <ArrowUpDown className="w-3 h-3" />
                          </button>
                        </th>
                        <th className="py-3.5 px-4">
                          <button
                            type="button"
                            onClick={() => toggleTaskSort('status')}
                            className="inline-flex items-center gap-1 hover:text-slate-900"
                          >
                            <span>Status</span>
                            <ArrowUpDown className="w-3 h-3" />
                          </button>
                        </th>
                        <th className="py-3.5 px-4">
                          <button
                            type="button"
                            onClick={() => toggleTaskSort('department')}
                            className="inline-flex items-center gap-1 hover:text-slate-900"
                          >
                            <span>Department</span>
                            <ArrowUpDown className="w-3 h-3" />
                          </button>
                        </th>
                        <th className="py-3.5 px-4">Assignees</th>
                        <th className="py-3.5 px-4">Reviewer</th>
                        <th className="py-3.5 px-5">
                          <button
                            type="button"
                            onClick={() => toggleTaskSort('deadline')}
                            className="inline-flex items-center gap-1 hover:text-slate-900"
                          >
                            <span>Deadline</span>
                            <ArrowUpDown className="w-3 h-3" />
                          </button>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-sm">
                      {filteredTasks.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-12 text-center">
                            <p className="text-xs font-medium text-slate-600">
                              {tasks.length === 0
                                ? 'No tasks have been created yet.'
                                : 'No tasks match the current filters.'}
                            </p>
                            {tasks.length === 0 && (
                              <button
                                type="button"
                                onClick={() => {
                                  setCreateTaskPrefill(undefined);
                                  setIsCreateTaskOpen(true);
                                }}
                                className="mt-2 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800"
                              >
                                <Plus className="w-3.5 h-3.5" />
                                Assign First Task
                              </button>
                            )}
                          </td>
                        </tr>
                      ) : (
                        filteredTasks.map((t) => {
                          const doneSub = t.subtasks.filter((s) => s.completed).length;
                          const totalSub = t.subtasks.length;
                          const fileCount = t.deliverables.length;
                          return (
                            <tr
                              key={t.id}
                              onClick={() => setSelectedTaskId(t.id)}
                              className="hover:bg-slate-50/80 cursor-pointer transition-colors"
                            >
                              <td className="py-4 px-5">
                                <div className="font-semibold text-slate-900 hover:text-blue-700">
                                  {t.title}
                                </div>
                                {(totalSub > 0 || fileCount > 0) && (
                                  <div className="flex items-center gap-3 text-xs text-slate-400 font-mono-tabular mt-0.5">
                                    {totalSub > 0 && (
                                      <span>
                                        {doneSub} of {totalSub} subtasks
                                      </span>
                                    )}
                                    {fileCount > 0 && (
                                      <span className="inline-flex items-center gap-1 text-slate-500">
                                        <Paperclip className="w-3 h-3" />
                                        {fileCount} {fileCount === 1 ? 'file' : 'files'}
                                      </span>
                                    )}
                                  </div>
                                )}
                              </td>
                              <td className="py-4 px-4 whitespace-nowrap">
                                <span
                                  className={`inline-block px-3 py-0.5 rounded-full text-[11px] font-semibold tracking-wide ${getStatusBadgeStyle(
                                    t.status
                                  )}`}
                                >
                                  {t.status}
                                </span>
                              </td>
                              <td className="py-4 px-4 text-xs text-slate-600 whitespace-nowrap">
                                {t.department}
                              </td>
                              <td className="py-4 px-4 whitespace-nowrap">
                                <AvatarStack
                                  names={t.assignees}
                                  onSelectPerson={(name) => selectEmployeeByName(name)}
                                />
                              </td>
                              <td className="py-4 px-4 text-xs text-slate-600 whitespace-nowrap">
                                {t.reviewer}
                              </td>
                              <td className="py-4 px-5 text-xs text-slate-600 font-mono-tabular whitespace-nowrap">
                                {t.deadline}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ================================================================
           * VIEW 3: UNIFIED EMPLOYEES HUB (Directory, Database, Registration, Invites, CSV & Roles/Permissions)
           * ================================================================ */}
          {activeNav === 'employees' && (
            <div className="space-y-6">
              {/* Unified Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-display font-bold text-slate-900">
                    Employees
                  </h1>
                  <p className="text-sm text-slate-500 mt-0.5">
                    {filteredEmployees.length} of {employees.length} people · Unified directory, database, onboarding invites, and role permissions
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
                  <button
                    type="button"
                    onClick={handleExportEmployeeDatabaseCsv}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 text-xs font-semibold hover:bg-slate-50 transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Export CSV</span>
                  </button>
                  {currentRole === 'Top Management' && (
                    <button
                      type="button"
                      onClick={() =>
                        setEmpWorkspaceTab((t) => (t === 'register' ? 'directory' : 'register'))
                      }
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#0F172A] text-white text-xs font-semibold hover:bg-slate-800 transition-colors"
                    >
                      <UserPlus className="w-4 h-4" />
                      <span>
                        {empWorkspaceTab === 'register'
                          ? 'Back to Employee Directory'
                          : '+ Add / Invite Employee'}
                      </span>
                    </button>
                  )}
                </div>
              </div>

              {/* Unified Sub-Navigation Bar (Directory & Database | Register & Invite | Bulk CSV Import | Roles & Permissions) */}
              <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-200/70 rounded-xl w-fit">
                <button
                  type="button"
                  onClick={() => setEmpWorkspaceTab('directory')}
                  className={`px-4 py-2 rounded-lg text-xs font-semibold transition-colors ${
                    empWorkspaceTab === 'directory'
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Directory & Database ({employees.length})
                </button>
                {currentRole === 'Top Management' && (
                  <>
                    <button
                      type="button"
                      onClick={() => setEmpWorkspaceTab('register')}
                      className={`px-4 py-2 rounded-lg text-xs font-semibold transition-colors ${
                        empWorkspaceTab === 'register'
                          ? 'bg-white text-slate-900 shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      + Register & Invite Employee
                    </button>
                    <button
                      type="button"
                      onClick={() => setEmpWorkspaceTab('csv')}
                      className={`px-4 py-2 rounded-lg text-xs font-semibold transition-colors ${
                        empWorkspaceTab === 'csv'
                          ? 'bg-white text-slate-900 shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Bulk CSV Import & Export
                    </button>
                  </>
                )}
                <button
                  type="button"
                  onClick={() => setEmpWorkspaceTab('governance')}
                  className={`px-4 py-2 rounded-lg text-xs font-semibold transition-colors ${
                    empWorkspaceTab === 'governance'
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Roles & Permissions Matrix
                </button>
              </div>

              {empWorkspaceTab === 'register' || empWorkspaceTab === 'csv' ? (
                <CreateEmployeeSection
                  employees={employees}
                  departments={departmentNames}
                  currentUserName={currentUserName}
                  mode={empWorkspaceTab === 'csv' ? 'csv' : 'single'}
                  hideHeader={true}
                  onAddEmployee={handleAddEmployee}
                  onBulkAddEmployees={async (emps) => {
                    await handleBulkAddEmployees(emps);
                    setEmpWorkspaceTab('directory');
                  }}
                  onNavigateToDirectory={() => setEmpWorkspaceTab('directory')}
                />
              ) : empWorkspaceTab === 'governance' ? (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {ROLE_PERMISSIONS_MATRIX.map((item) => (
                      <div
                        key={item.role}
                        className="p-5 rounded-2xl bg-white border border-slate-200/90 shadow-2xs space-y-3"
                      >
                        <div className="flex items-center justify-between">
                          <h3 className="text-sm font-display font-bold text-slate-900">
                            {item.role}
                          </h3>
                          <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[11px] font-semibold">
                            {item.tierLabel}
                          </span>
                        </div>
                        <ul className="space-y-1.5 text-xs text-slate-600">
                          {item.permissions.map((perm) => (
                            <li key={perm} className="flex items-center gap-2">
                              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                              <span>{perm}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>

                  <div className="p-5 rounded-2xl bg-white border border-slate-200/90 shadow-2xs space-y-3">
                    <h3 className="text-sm font-display font-bold text-slate-900">
                      Configured ATDP Task Categories
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {TASK_CATEGORIES.map((cat) => (
                        <span
                          key={cat}
                          className="px-3 py-1 rounded-full border border-slate-200 bg-slate-50 text-xs font-medium text-slate-700"
                        >
                          {cat}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  {/* Database Summary KPI Bar */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <button
                      type="button"
                      onClick={() => setEmpStatusFilter('ALL')}
                      className={`p-4 rounded-2xl border text-left transition-colors ${
                        empStatusFilter === 'ALL'
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'bg-white text-slate-900 border-slate-200/90 hover:border-slate-300'
                      }`}
                    >
                      <div
                        className={`text-xs ${
                          empStatusFilter === 'ALL' ? 'text-slate-300' : 'text-slate-500'
                        }`}
                      >
                        Total Staff Records
                      </div>
                      <div className="text-2xl font-display font-bold font-mono-tabular mt-1">
                        {employees.length}
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setEmpStatusFilter('ACTIVE')}
                      className={`p-4 rounded-2xl border text-left transition-colors ${
                        empStatusFilter === 'ACTIVE'
                          ? 'bg-emerald-700 text-white border-emerald-700'
                          : 'bg-white text-slate-900 border-slate-200/90 hover:border-slate-300'
                      }`}
                    >
                      <div
                        className={`text-xs ${
                          empStatusFilter === 'ACTIVE' ? 'text-emerald-100' : 'text-slate-500'
                        }`}
                      >
                        Active Onboarded Staff
                      </div>
                      <div className="text-2xl font-display font-bold font-mono-tabular mt-1">
                        {activeStaffCount}
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setEmpStatusFilter('INVITED')}
                      className={`p-4 rounded-2xl border text-left transition-colors ${
                        empStatusFilter === 'INVITED'
                          ? 'bg-amber-600 text-white border-amber-600'
                          : 'bg-white text-slate-900 border-slate-200/90 hover:border-slate-300'
                      }`}
                    >
                      <div
                        className={`text-xs ${
                          empStatusFilter === 'INVITED' ? 'text-amber-100' : 'text-slate-500'
                        }`}
                      >
                        Pending Email Invites
                      </div>
                      <div className="text-2xl font-display font-bold font-mono-tabular mt-1">
                        {invitedCount}
                      </div>
                    </button>

                    <div className="p-4 rounded-2xl bg-white border border-slate-200/90">
                      <div className="text-xs text-slate-500">Departments Active</div>
                      <div className="text-2xl font-display font-bold font-mono-tabular text-slate-900 mt-1">
                        {departments.length}
                      </div>
                    </div>
                  </div>

                  {/* Filters & View Mode Switcher */}
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-3 flex-1">
                      <div className="relative flex-1 min-w-[220px] max-w-sm">
                        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          value={empSearch}
                          onChange={(e) => setEmpSearch(e.target.value)}
                          placeholder="Search by name, Staff ID, National ID, role, email..."
                          className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
                        />
                      </div>
                      <select
                        value={empDeptFilter}
                        onChange={(e) => setEmpDeptFilter(e.target.value)}
                        className="px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-700"
                      >
                        <option value="ALL">All departments</option>
                        {departmentNames.map((d) => (
                          <option key={d} value={d}>
                            {d}
                          </option>
                        ))}
                      </select>
                      <select
                        value={empRoleFilter}
                        onChange={(e) => setEmpRoleFilter(e.target.value)}
                        className="px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-700"
                      >
                        <option value="ALL">All access levels</option>
                        <option value="Employee">Employee</option>
                        <option value="Supervisor">Supervisor</option>
                        <option value="Top Management">Top Management</option>
                      </select>
                      <select
                        value={empStatusFilter}
                        onChange={(e) =>
                          setEmpStatusFilter(e.target.value as 'ALL' | 'ACTIVE' | 'INVITED')
                        }
                        className="px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-700"
                      >
                        <option value="ALL">All onboarding statuses</option>
                        <option value="ACTIVE">ACTIVE (Onboarded)</option>
                        <option value="INVITED">INVITED (Pending Sign-Up)</option>
                      </select>
                    </div>

                    <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1">
                      <button
                        type="button"
                        onClick={() => setEmpViewMode('table')}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                          empViewMode === 'table'
                            ? 'bg-slate-900 text-white'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        <TableIcon className="w-3.5 h-3.5" />
                        <span>Table</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setEmpViewMode('cards')}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                          empViewMode === 'cards'
                            ? 'bg-slate-900 text-white'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        <LayoutGrid className="w-3.5 h-3.5" />
                        <span>Cards</span>
                      </button>
                    </div>
                  </div>

                  {/* Structured Table View */}
                  {empViewMode === 'table' ? (
                    <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="border-b border-slate-200 text-xs font-semibold text-slate-500 bg-slate-50/60">
                              <th className="py-3.5 px-4">Staff ID</th>
                              <th className="py-3.5 px-4">Employee</th>
                              <th className="py-3.5 px-4">Department & Desk</th>
                              <th className="py-3.5 px-4">Role & Tier</th>
                              <th className="py-3.5 px-4">Contact & National ID</th>
                              <th className="py-3.5 px-4">Manager</th>
                              <th className="py-3.5 px-4">Status</th>
                              <th className="py-3.5 px-4">Performance</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 text-xs">
                            {filteredEmployees.length === 0 ? (
                              <tr>
                                <td colSpan={8} className="py-12 text-center text-slate-400">
                                  No employee records match your current filter.
                                </td>
                              </tr>
                            ) : (
                              filteredEmployees.map((emp) => {
                                const empTasks = tasks.filter(
                                  (t) =>
                                    t.assignees.includes(emp.fullName) ||
                                    t.owner === emp.fullName
                                );
                                const completed = empTasks.filter(
                                  (t) => t.status === 'COMPLETED'
                                ).length;

                                return (
                                  <tr
                                    key={emp.id}
                                    onClick={() => setSelectedEmployeeId(emp.id)}
                                    className="hover:bg-slate-50/80 cursor-pointer transition-colors"
                                  >
                                    <td className="py-3.5 px-4 font-mono-tabular font-semibold text-slate-700 whitespace-nowrap">
                                      {emp.staffId || 'ATDP-STAFF'}
                                    </td>
                                    <td className="py-3.5 px-4">
                                      <div className="flex items-center gap-2.5">
                                        <Avatar
                                          name={emp.fullName}
                                          color={emp.avatarColor}
                                          size="sm"
                                        />
                                        <div>
                                          <div className="font-semibold text-slate-900">
                                            {emp.fullName}
                                          </div>
                                          <div className="text-[11px] text-slate-400">
                                            Joined {emp.joinDate}
                                          </div>
                                        </div>
                                      </div>
                                    </td>
                                    <td className="py-3.5 px-4 whitespace-nowrap">
                                      <div className="font-medium text-slate-800">
                                        {emp.department}
                                      </div>
                                      <div className="text-[11px] text-slate-400">{emp.desk}</div>
                                    </td>
                                    <td className="py-3.5 px-4 whitespace-nowrap">
                                      <div className="font-medium text-slate-800">{emp.role}</div>
                                      <div className="text-[11px] text-slate-500">
                                        {emp.accessLevel}
                                      </div>
                                    </td>
                                    <td className="py-3.5 px-4">
                                      <div className="text-slate-700">{emp.email}</div>
                                      <div className="text-[11px] font-mono-tabular text-slate-400">
                                        {emp.phone} · ID: {emp.nationalId || 'Pending'}
                                      </div>
                                    </td>
                                    <td className="py-3.5 px-4 text-slate-600 whitespace-nowrap">
                                      {emp.managerName}
                                    </td>
                                    <td className="py-3.5 px-4 whitespace-nowrap">
                                      {emp.onboardingStatus === 'INVITED' ? (
                                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                                          <Clock className="w-3 h-3" />
                                          INVITED
                                        </span>
                                      ) : (
                                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                          <CheckCircle2 className="w-3 h-3" />
                                          ACTIVE
                                        </span>
                                      )}
                                    </td>
                                    <td className="py-3.5 px-4 font-mono-tabular whitespace-nowrap">
                                      <div className="font-bold text-slate-900">
                                        {emp.performanceScore}% score
                                      </div>
                                      <div className="text-[11px] text-slate-500">
                                        {completed}/{empTasks.length} tasks done
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : (
                    /* Employee Cards Grid */
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                      {filteredEmployees.map((emp) => {
                        const empTasks = tasks.filter(
                          (t) =>
                            t.assignees.includes(emp.fullName) || t.owner === emp.fullName
                        );
                        const completed = empTasks.filter(
                          (t) => t.status === 'COMPLETED'
                        ).length;
                        const inProgress = empTasks.filter(
                          (t) =>
                            t.status === 'IN PROGRESS' ||
                            t.status === 'ASSIGNED' ||
                            t.status === 'UNDER REVIEW' ||
                            t.status === 'SUBMITTED'
                        ).length;

                        return (
                          <div
                            key={emp.id}
                            onClick={() => setSelectedEmployeeId(emp.id)}
                            className="p-5 rounded-2xl bg-white border border-slate-200/90 hover:border-slate-300 shadow-2xs cursor-pointer transition-all flex flex-col justify-between space-y-4"
                          >
                            <div className="space-y-3">
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex items-center gap-3">
                                  <Avatar
                                    name={emp.fullName}
                                    color={emp.avatarColor}
                                    size="md"
                                  />
                                  <div>
                                    <div className="flex items-center gap-1.5">
                                      <h3 className="text-sm font-display font-bold text-slate-900">
                                        {emp.fullName}
                                      </h3>
                                    </div>
                                    <p className="text-xs text-slate-500">{emp.role}</p>
                                    <p className="text-[10px] font-mono-tabular text-slate-400">
                                      {emp.staffId}
                                    </p>
                                  </div>
                                </div>
                                {emp.onboardingStatus === 'INVITED' ? (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                                    INVITED
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                    ACTIVE
                                  </span>
                                )}
                              </div>

                              <div className="space-y-1.5 text-xs text-slate-600 pt-1">
                                <div className="flex items-center gap-2">
                                  <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                  <span>
                                    {emp.department}, {emp.desk}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Briefcase className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                  <span>
                                    Manager: {emp.managerName} · {emp.accessLevel}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                  <span className="truncate">{emp.email}</span>
                                </div>
                              </div>
                            </div>

                            <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                              <div className="text-slate-500 font-mono-tabular">
                                <span className="font-semibold text-slate-900">
                                  {inProgress}
                                </span>{' '}
                                active ·{' '}
                                <span className="font-semibold text-emerald-700">
                                  {completed}
                                </span>{' '}
                                done
                              </div>
                              <div className="font-mono-tabular font-semibold text-slate-900">
                                Score: {emp.performanceScore}%
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* ================================================================
           * VIEW 4: DEPARTMENTS (with + Create Department button & Interactive Inspector)
           * ================================================================ */}
          {activeNav === 'departments' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-display font-bold text-slate-900">Departments</h1>
                  <p className="text-sm text-slate-500 mt-0.5">
                    Departmental structure, desk leads, members, and active/completed work across ATDP
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsCreateDeptOpen(true)}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#0F172A] text-white text-xs font-semibold hover:bg-slate-800 transition-colors self-start sm:self-auto"
                >
                  <Plus className="w-4 h-4" />
                  <span>Create Department</span>
                </button>
              </div>

              {/* Department Cards Grid (Click to inspect Members & Recent Work) */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {departments.map((dept) => {
                  const deptTasks = tasks.filter((t) => t.department === dept.name);
                  const deptActive = deptTasks.filter(
                    (t) =>
                      t.status === 'ASSIGNED' ||
                      t.status === 'IN PROGRESS' ||
                      t.status === 'BACKLOG'
                  ).length;
                  const deptReview = deptTasks.filter(
                    (t) => t.status === 'UNDER REVIEW' || t.status === 'SUBMITTED'
                  ).length;
                  const deptCompleted = deptTasks.filter((t) => t.status === 'COMPLETED').length;
                  const deptStaff = employees.filter((e) => e.department === dept.name);
                  const isSelected =
                    (selectedDeptId && selectedDeptId === dept.id) ||
                    (!departments.some((d) => d.id === selectedDeptId) &&
                      departments[0]?.id === dept.id);

                  return (
                    <div
                      key={dept.id}
                      onClick={() => setSelectedDeptId(dept.id)}
                      className={`p-5 rounded-2xl bg-white border cursor-pointer transition-all space-y-3.5 ${
                        isSelected
                          ? 'border-slate-900 ring-2 ring-slate-900 shadow-xs'
                          : 'border-slate-200/90 hover:border-slate-300 shadow-2xs'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h2 className="text-base font-display font-bold text-slate-900">
                            {dept.name}
                          </h2>
                          <p className="text-xs text-slate-500 mt-0.5">
                            Lead: <strong className="text-slate-800">{dept.headName}</strong>
                          </p>
                        </div>
                        <span className="text-xs font-mono-tabular text-slate-400 shrink-0">
                          {deptStaff.length} people
                        </span>
                      </div>

                      <p className="text-xs text-slate-600 line-clamp-2">{dept.description}</p>

                      <div className="grid grid-cols-3 gap-2 pt-1 text-center text-xs">
                        <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                          <div className="font-display font-bold font-mono-tabular text-slate-900">
                            {deptActive}
                          </div>
                          <div className="text-[11px] text-slate-400">Active</div>
                        </div>
                        <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                          <div className="font-display font-bold font-mono-tabular text-slate-900">
                            {deptReview}
                          </div>
                          <div className="text-[11px] text-slate-400">Review</div>
                        </div>
                        <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                          <div className="font-display font-bold font-mono-tabular text-emerald-700">
                            {deptCompleted}
                          </div>
                          <div className="text-[11px] text-slate-400">Done</div>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                        <span className="truncate">Desks: {dept.desks.join(' · ')}</span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setTaskDeptFilter(dept.name);
                            setActiveNav('tasks');
                          }}
                          className="font-semibold text-blue-600 hover:underline shrink-0 ml-2"
                        >
                          All tasks →
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Interactive Selected Department Inspector (Members & Recent Work — Inspired by ATDP Workforce Flow) */}
              {(() => {
                const activeDept =
                  departments.find((d) => d.id === selectedDeptId) || departments[0];
                if (!activeDept) return null;
                const deptMembers = employees.filter((e) => e.department === activeDept.name);
                const deptActiveTasks = tasks.filter(
                  (t) =>
                    t.department === activeDept.name &&
                    t.status !== 'COMPLETED' &&
                    t.status !== 'CANCELLED'
                );
                const deptCompletedTasks = tasks.filter(
                  (t) => t.department === activeDept.name && t.status === 'COMPLETED'
                );

                return (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-2">
                    {/* Left: Members in Selected Department */}
                    <div className="p-6 rounded-2xl bg-white border border-slate-200/90 shadow-2xs space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-base font-display font-bold text-slate-900">
                            Members — {activeDept.name}
                          </h3>
                          <p className="text-xs text-slate-500">
                            Desks: {activeDept.desks.join(', ')}
                          </p>
                        </div>
                        {currentRole === 'Top Management' && (
                          <button
                            type="button"
                            onClick={() => {
                              setEmpWorkspaceTab('register');
                              setActiveNav('employees');
                            }}
                            className="text-xs font-semibold text-blue-600 hover:underline"
                          >
                            + Add staff
                          </button>
                        )}
                      </div>

                      {deptMembers.length === 0 ? (
                        <p className="text-xs text-slate-400 py-4">
                          No employees assigned to {activeDept.name} yet.
                        </p>
                      ) : (
                        <ul className="divide-y divide-slate-100">
                          {deptMembers.map((emp) => (
                            <li key={emp.id} className="py-2.5 first:pt-0 last:pb-0">
                              <button
                                type="button"
                                onClick={() => setSelectedEmployeeId(emp.id)}
                                className="w-full flex items-center justify-between gap-3 text-left hover:text-blue-700"
                              >
                                <div className="flex items-center gap-2.5">
                                  <Avatar
                                    name={emp.fullName}
                                    color={emp.avatarColor}
                                    size="sm"
                                  />
                                  <div>
                                    <span className="text-sm font-medium text-slate-900">
                                      {emp.fullName}
                                    </span>
                                    <span className="text-xs text-slate-400 ml-1.5">
                                      · {emp.role} ({emp.desk})
                                    </span>
                                  </div>
                                </div>
                                <span
                                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                    emp.onboardingStatus === 'ACTIVE'
                                      ? 'bg-emerald-50 text-emerald-700'
                                      : 'bg-amber-50 text-amber-700'
                                  }`}
                                >
                                  {emp.onboardingStatus}
                                </span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>

                    {/* Right: Recent Work in Selected Department */}
                    <div className="p-6 rounded-2xl bg-white border border-slate-200/90 shadow-2xs space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-base font-display font-bold text-slate-900">
                          Recent Work — {activeDept.name}
                        </h3>
                        <button
                          type="button"
                          onClick={() => {
                            setCreateTaskPrefill({ department: activeDept.name });
                            setIsCreateTaskOpen(true);
                          }}
                          className="text-xs font-semibold text-slate-800 hover:text-blue-600"
                        >
                          + Assign task
                        </button>
                      </div>

                      <div className="space-y-3">
                        <div>
                          <div className="text-xs font-semibold text-slate-500 mb-1.5">
                            Active ({deptActiveTasks.length})
                          </div>
                          <ul className="divide-y divide-slate-100">
                            {deptActiveTasks.length === 0 ? (
                              <li className="text-xs text-slate-400 py-2">No active work.</li>
                            ) : (
                              deptActiveTasks.slice(0, 5).map((t) => (
                                <li
                                  key={t.id}
                                  className="py-2 flex items-center justify-between gap-2"
                                >
                                  <button
                                    type="button"
                                    onClick={() => setSelectedTaskId(t.id)}
                                    className="text-xs font-medium text-slate-800 hover:text-blue-700 text-left"
                                  >
                                    {t.title}
                                  </button>
                                  <span
                                    className={`px-2 py-0.5 rounded-full text-[10px] font-semibold shrink-0 ${getStatusBadgeStyle(
                                      t.status
                                    )}`}
                                  >
                                    {t.status}
                                  </span>
                                </li>
                              ))
                            )}
                          </ul>
                        </div>

                        <div className="pt-2 border-t border-slate-100">
                          <div className="text-xs font-semibold text-slate-500 mb-1.5">
                            Recently completed ({deptCompletedTasks.length})
                          </div>
                          <ul className="divide-y divide-slate-100">
                            {deptCompletedTasks.length === 0 ? (
                              <li className="text-xs text-slate-400 py-2">
                                No completed work yet.
                              </li>
                            ) : (
                              deptCompletedTasks.slice(0, 5).map((t) => (
                                <li
                                  key={t.id}
                                  className="py-2 flex items-center justify-between gap-2"
                                >
                                  <button
                                    type="button"
                                    onClick={() => setSelectedTaskId(t.id)}
                                    className="text-xs text-slate-700 hover:text-blue-700 text-left"
                                  >
                                    {t.title}
                                  </button>
                                  <span className="text-[11px] font-mono-tabular text-slate-400">
                                    {t.deadline}
                                  </span>
                                </li>
                              ))
                            )}
                          </ul>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* ================================================================
           * VIEW 5: MEETINGS (Lightweight Coordination + Action Item -> Task)
           * ================================================================ */}
          {activeNav === 'meetings' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-display font-bold text-slate-900">Meetings</h1>
                  <p className="text-sm text-slate-500 mt-0.5">
                    Virtual Google Meet rooms, department syncs, agendas, and action item task conversion
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
                  <a
                    href="https://meet.google.com/new"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-blue-200 bg-blue-50 text-blue-700 text-xs font-semibold hover:bg-blue-100 transition-colors"
                  >
                    <Video className="w-4 h-4" />
                    <span>Instant Google Meet</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                  <button
                    type="button"
                    onClick={() => setIsScheduleMeetingOpen(true)}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#0F172A] text-white text-xs font-semibold hover:bg-slate-800 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Schedule Meeting</span>
                  </button>
                </div>
              </div>

              {meetings.length === 0 ? (
                <div className="p-12 rounded-2xl bg-white border border-slate-200/90 text-center space-y-3">
                  <p className="text-sm font-semibold text-slate-800">No meetings scheduled yet</p>
                  <p className="text-xs text-slate-500">
                    Schedule virtual Google Meet sessions or in-person syncs to notify staff.
                  </p>
                  <button
                    type="button"
                    onClick={() => setIsScheduleMeetingOpen(true)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800"
                  >
                    <Video className="w-3.5 h-3.5" />
                    <span>Schedule Virtual Google Meet</span>
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {meetings.map((mtg) => {
                    const meetUrlMatch = mtg.locationOrLink.match(
                      /https?:\/\/meet\.google\.com\/[a-zA-Z0-9-]+/i
                    );
                    const extractedMeetUrl = meetUrlMatch
                      ? meetUrlMatch[0]
                      : mtg.locationOrLink.toLowerCase().includes('google meet')
                      ? 'https://meet.google.com/new'
                      : null;

                    return (
                      <div
                        key={mtg.id}
                        className="p-6 rounded-2xl bg-white border border-slate-200/90 shadow-2xs space-y-3.5"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <span className="text-xs font-semibold text-blue-700">
                              {mtg.department} · Organized by {mtg.organizer}
                            </span>
                            <h3 className="text-base font-display font-bold text-slate-900 mt-1">
                              {mtg.title}
                            </h3>
                          </div>
                          <span className="text-xs font-mono-tabular font-semibold text-slate-700 bg-slate-100 px-2.5 py-1 rounded-lg shrink-0">
                            {mtg.date}
                          </span>
                        </div>

                        <div className="space-y-1">
                          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                            Agenda & Notes
                          </div>
                          <p className="text-xs text-slate-600 leading-relaxed">{mtg.agenda}</p>
                        </div>

                        <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                          <div className="flex flex-wrap items-center gap-2">
                            <span>{mtg.time}</span>
                            <span>·</span>
                            {extractedMeetUrl ? (
                              <a
                                href={extractedMeetUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 border border-blue-200 font-semibold hover:bg-blue-100 transition-colors"
                              >
                                <Video className="w-3.5 h-3.5" />
                                <span>Join Google Meet</span>
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            ) : (
                              <span className="text-slate-700 font-medium">
                                {mtg.locationOrLink}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3">
                            <AvatarStack
                              names={mtg.attendees}
                              onSelectPerson={(name) => selectEmployeeByName(name)}
                            />
                            <button
                              type="button"
                              onClick={() => {
                                setCreateTaskPrefill({
                                  title: `Action Item: ${mtg.title}`,
                                  description: `Follow-up action item from meeting "${mtg.title}" (${mtg.date}): ${mtg.agenda}`,
                                  department: mtg.department,
                                  assignee: mtg.attendees[0] || currentUserName,
                                  taskSource: 'Meeting action item',
                                });
                                setIsCreateTaskOpen(true);
                              }}
                              className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-semibold hover:bg-emerald-100 transition-colors"
                            >
                              → Convert to Task
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ================================================================
           * VIEW 6: ANNOUNCEMENTS
           * ================================================================ */}
          {activeNav === 'announcements' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-display font-bold text-slate-900">Announcements</h1>
                  <p className="text-sm text-slate-500 mt-0.5">
                    Executive broadcasts, deadline notices, and policy updates across ATDP
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsCreateAnnouncementOpen(true)}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#0F172A] text-white text-xs font-semibold hover:bg-slate-800 transition-colors self-start sm:self-auto"
                >
                  <Plus className="w-4 h-4" />
                  <span>Post Announcement</span>
                </button>
              </div>

              {announcements.length === 0 ? (
                <div className="p-12 rounded-2xl bg-white border border-slate-200/90 text-center space-y-2">
                  <p className="text-sm font-semibold text-slate-800">
                    No announcements published yet
                  </p>
                  <p className="text-xs text-slate-500">
                    Broadcast organization-wide updates or departmental notices to all employees.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {announcements.map((ann) => (
                    <div
                      key={ann.id}
                      className="p-6 rounded-2xl bg-white border border-slate-200/90 shadow-2xs space-y-2.5"
                    >
                      <div className="flex items-center justify-between gap-4 flex-wrap">
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-xs font-bold ${
                              ann.priority === 'Urgent'
                                ? 'text-rose-700'
                                : ann.priority === 'Important'
                                ? 'text-amber-700'
                                : 'text-slate-600'
                            }`}
                          >
                            [{ann.priority}]
                          </span>
                          <h3 className="text-base font-display font-bold text-slate-900">
                            {ann.title}
                          </h3>
                        </div>
                        <span className="text-xs text-slate-400 font-mono-tabular">
                          {ann.createdAt}
                        </span>
                      </div>
                      <p className="text-sm text-slate-600 leading-relaxed">{ann.body}</p>
                      <div className="pt-2 text-xs text-slate-400">
                        Posted by <strong className="text-slate-700">{ann.authorName}</strong> (
                        {ann.authorRole}) · Audience: {ann.department}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ================================================================
           * VIEW 7: NOTIFICATIONS & PUSH ALERTS
           * ================================================================ */}
          {activeNav === 'notifications' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-display font-bold text-slate-900">Notifications</h1>
                  <p className="text-sm text-slate-500 mt-0.5">
                    Real-time status updates, deliverable alerts, and supervisor feedback notifications
                  </p>
                </div>
                <div className="flex items-center gap-2.5">
                  {!browserPushEnabled && typeof Notification !== 'undefined' && (
                    <button
                      type="button"
                      onClick={requestBrowserPushPermission}
                      className="px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-800 transition-colors"
                    >
                      Enable Browser Push Alerts
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleMarkAllNotificationsRead}
                    className="px-3.5 py-2 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 transition-colors"
                  >
                    Mark all as read
                  </button>
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs divide-y divide-slate-100 overflow-hidden">
                {notifications.length === 0 ? (
                  <p className="p-10 text-center text-xs text-slate-400">
                    No notifications yet.
                  </p>
                ) : (
                  notifications.map((n) => (
                    <div
                      key={n.id}
                      onClick={() => {
                        if (!n.read) handleMarkNotificationRead(n.id);
                        if (n.relatedTaskId) setSelectedTaskId(n.relatedTaskId);
                      }}
                      className={`p-5 flex items-start justify-between gap-4 cursor-pointer transition-colors ${
                        n.read
                          ? 'bg-white hover:bg-slate-50/70'
                          : 'bg-blue-50/30 hover:bg-blue-50/60'
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          {!n.read && (
                            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 bg-blue-100 px-2 py-0.5 rounded">
                              New
                            </span>
                          )}
                          <h3 className="text-sm font-semibold text-slate-900">{n.title}</h3>
                        </div>
                        <p className="text-xs text-slate-600">{n.message}</p>
                        <p className="text-[11px] text-slate-400">
                          For: {n.recipientName} · {n.createdAt}
                        </p>
                      </div>
                      {!n.read && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleMarkNotificationRead(n.id);
                          }}
                          className="text-xs font-medium text-blue-600 hover:underline shrink-0"
                        >
                          Mark read
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* ================================================================
           * VIEW 8: MY PROFILE (Clean production view without any demo labels)
           * ================================================================ */}
          {activeNav === 'profile' && currentEmployee && (
            <div className="space-y-6">
              <div>
                <h1 className="text-2xl font-display font-bold text-slate-900">My Profile</h1>
                <p className="text-sm text-slate-500 mt-0.5">
                  {currentEmployee.staffId} · {currentEmployee.accessLevel} ·{' '}
                  {currentEmployee.department}
                </p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* Left Card with Profile Picture Upload */}
                <div className="lg:col-span-5 p-8 rounded-2xl bg-white border border-slate-200/90 shadow-2xs flex flex-col items-center text-center space-y-4">
                  <div className="relative group">
                    <Avatar
                      name={currentEmployee.fullName}
                      src={currentEmployee.avatarUrl}
                      color={currentEmployee.avatarColor}
                      size="xl"
                    />
                    <input
                      ref={profilePhotoInputRef}
                      type="file"
                      accept="image/*"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const compressed = await compressProfileImage(file);
                        await handleUpdateEmployee(currentEmployee.id, {
                          avatarUrl: compressed,
                        });
                        if (profilePhotoInputRef.current) {
                          profilePhotoInputRef.current.value = '';
                        }
                      }}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => profilePhotoInputRef.current?.click()}
                      title="Upload or change profile picture"
                      className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center shadow-sm hover:bg-slate-700 transition-colors"
                    >
                      <Camera className="w-4 h-4" />
                    </button>
                  </div>
                  <div>
                    <h2 className="text-lg font-display font-bold text-slate-900">
                      {currentEmployee.fullName}
                    </h2>
                    <p className="text-sm text-slate-500 mt-0.5">{currentEmployee.role}</p>
                    <button
                      type="button"
                      onClick={() => profilePhotoInputRef.current?.click()}
                      className="text-xs font-semibold text-blue-600 hover:underline mt-1"
                    >
                      {currentEmployee.avatarUrl ? 'Change Profile Photo' : '+ Upload Profile Photo'}
                    </button>
                  </div>

                  {/* Role Badges */}
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    {currentEmployee.badges.map((b) => (
                      <span
                        key={b}
                        className="px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-medium"
                      >
                        {b}
                      </span>
                    ))}
                  </div>

                  {/* Verified Access Pill */}
                  <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    <span>
                      Verified {currentEmployee.accessLevel} · {currentEmployee.staffId}
                    </span>
                  </div>
                </div>

                {/* Right Card */}
                <div className="lg:col-span-7 p-8 rounded-2xl bg-white border border-slate-200/90 shadow-2xs space-y-6">
                  <div className="space-y-3.5 text-sm text-slate-700">
                    <div className="flex items-center gap-3">
                      <Mail className="w-4 h-4 text-slate-400 shrink-0" />
                      <span>{currentEmployee.email}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <Phone className="w-4 h-4 text-slate-400 shrink-0" />
                      <span className="font-mono-tabular">{currentEmployee.phone}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <Building2 className="w-4 h-4 text-slate-400 shrink-0" />
                      <span>
                        {currentEmployee.department}, {currentEmployee.desk}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <Briefcase className="w-4 h-4 text-slate-400 shrink-0" />
                      <span>Manager: {currentEmployee.managerName}</span>
                    </div>
                  </div>

                  {/* Documents Section with Upload & Download */}
                  <div className="pt-5 border-t border-slate-100 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="text-xs font-semibold text-slate-500">
                        HR Documents ({currentEmployee.documents.length})
                      </h3>
                      <div className="flex items-center gap-2">
                        <select
                          value={profileDocCategory}
                          onChange={(e) => setProfileDocCategory(e.target.value)}
                          className="px-2.5 py-1 text-xs bg-slate-50 border border-slate-200 rounded-lg"
                        >
                          <option value="CV">CV / Resume</option>
                          <option value="Contract">Contract</option>
                          <option value="Identification">National ID</option>
                          <option value="Certificate">Certificate</option>
                        </select>
                        <input
                          ref={profileDocInputRef}
                          type="file"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (!file || currentEmployee.documents.length >= 10) return;
                            const processed = await processUploadedFile(file);
                            const newDoc = {
                              id: `doc-${Date.now()}`,
                              fileName: processed.fileName.slice(0, 100),
                              category: profileDocCategory,
                              fileSize: processed.fileSize,
                              fileUrl: processed.fileUrl,
                              uploadedAt: new Date().toLocaleDateString('en-GB', {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric',
                              }),
                            };
                            await handleUpdateEmployee(currentEmployee.id, {
                              documents: [newDoc, ...currentEmployee.documents].slice(0, 10),
                            });
                            if (profileDocInputRef.current) {
                              profileDocInputRef.current.value = '';
                            }
                          }}
                          className="hidden"
                        />
                        <button
                          type="button"
                          onClick={() => profileDocInputRef.current?.click()}
                          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800"
                        >
                          <Upload className="w-3.5 h-3.5" />
                          <span>Upload Document</span>
                        </button>
                      </div>
                    </div>

                    <div className="space-y-2.5 text-sm">
                      {currentEmployee.documents.map((docItem) => (
                        <div
                          key={docItem.id}
                          className="flex items-center justify-between group py-1 border-b border-slate-50 last:border-0"
                        >
                          <div>
                            <span className="font-medium text-slate-800">
                              {docItem.fileName}
                            </span>
                            <span className="text-xs text-slate-400 ml-1.5">
                              · {docItem.category} ({docItem.fileSize})
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              downloadOrOpenFile(
                                docItem.fileName,
                                docItem.fileUrl,
                                `ATDP HR Document\nEmployee: ${currentEmployee.fullName} (${currentEmployee.staffId})\nCategory: ${docItem.category}\nUploaded: ${docItem.uploadedAt}`
                              )
                            }
                            className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>Download / View</span>
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* View my public work profile link */}
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => setShowPublicWorkProfile((v) => !v)}
                      className="text-sm font-medium text-blue-600 hover:text-blue-700 inline-flex items-center gap-1"
                    >
                      <span>
                        {showPublicWorkProfile
                          ? 'Hide my public work profile'
                          : 'View my public work profile →'}
                      </span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Expanded Public Work Profile & Performance History */}
              {showPublicWorkProfile && (
                <div className="p-6 rounded-2xl bg-white border border-slate-200/90 shadow-2xs space-y-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-4">
                    <div>
                      <h3 className="text-base font-display font-bold text-slate-900">
                        Public Work Profile & Performance History — {currentEmployee.fullName}
                      </h3>
                      <p className="text-xs text-slate-500">
                        Visible to Supervisors and Top Management for real-time workload transparency
                      </p>
                    </div>
                    <div className="flex items-center gap-4 text-xs font-mono-tabular">
                      <span>
                        Performance Score:{' '}
                        <strong className="text-slate-900">
                          {currentEmployee.performanceScore}%
                        </strong>
                      </span>
                      <span>
                        On-Time Rate:{' '}
                        <strong className="text-emerald-700">
                          {currentEmployee.onTimeRate}%
                        </strong>
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-3">
                      <h4 className="text-xs font-semibold text-slate-500">
                        Assigned & Owned Tasks
                      </h4>
                      <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                        {tasks.filter(
                          (t) =>
                            t.assignees.includes(currentEmployee.fullName) ||
                            t.owner === currentEmployee.fullName
                        ).length === 0 ? (
                          <p className="p-4 text-xs text-slate-400">
                            No tasks assigned yet.
                          </p>
                        ) : (
                          tasks
                            .filter(
                              (t) =>
                                t.assignees.includes(currentEmployee.fullName) ||
                                t.owner === currentEmployee.fullName
                            )
                            .map((t) => (
                              <button
                                key={t.id}
                                type="button"
                                onClick={() => setSelectedTaskId(t.id)}
                                className="w-full px-4 py-3 text-left hover:bg-slate-50 flex items-center justify-between gap-3"
                              >
                                <div>
                                  <div className="text-xs font-semibold text-slate-900">
                                    {t.title}
                                  </div>
                                  <div className="text-[11px] text-slate-400">
                                    Due {t.deadline} · Reviewer: {t.reviewer}
                                  </div>
                                </div>
                                <span
                                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold ${getStatusBadgeStyle(
                                    t.status
                                  )}`}
                                >
                                  {t.status}
                                </span>
                              </button>
                            ))
                        )}
                      </div>
                    </div>

                    <div className="space-y-3">
                      <h4 className="text-xs font-semibold text-slate-500">
                        Supervisor Performance Evaluations
                      </h4>
                      <div className="space-y-2.5">
                        {currentEmployee.performanceReviews.length === 0 ? (
                          <p className="p-4 text-xs text-slate-400 border border-dashed border-slate-200 rounded-xl">
                            No supervisor evaluations recorded yet.
                          </p>
                        ) : (
                          currentEmployee.performanceReviews.map((rev) => (
                            <div
                              key={rev.id}
                              className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-1"
                            >
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-slate-900">
                                  {rev.period} · {rev.reviewerName}
                                </span>
                                <span className="text-[11px] text-slate-400 font-mono-tabular">
                                  {rev.date}
                                </span>
                              </div>
                              <p className="text-xs text-slate-600">{rev.summary}</p>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {/* Slide-Over Task Detail & Review Drawer */}
      <TaskDetailDrawer
        task={selectedTask}
        currentUserName={currentUserName}
        currentRole={currentRole}
        onClose={() => setSelectedTaskId(null)}
        onUpdateTask={handleUpdateTask}
        onSelectEmployeeByName={(name) => {
          setSelectedTaskId(null);
          selectEmployeeByName(name);
        }}
      />

      {/* Interactive Modals */}
      <CreateTaskModal
        isOpen={isCreateTaskOpen}
        employees={employees}
        departments={departmentNames}
        currentUserName={currentUserName}
        initialValues={createTaskPrefill}
        onClose={() => setIsCreateTaskOpen(false)}
        onCreateTask={handleCreateTask}
      />

      <RecordInstructionModal
        isOpen={isRecordInstOpen}
        employees={employees}
        departments={departmentNames}
        currentUserName={currentUserName}
        onClose={() => setIsRecordInstOpen(false)}
        onSaveInstruction={handleSaveInstruction}
      />

      <EmployeeDetailModal
        employee={selectedEmployee}
        tasks={tasks}
        currentUserName={currentUserName}
        currentRole={currentRole}
        onClose={() => setSelectedEmployeeId(null)}
        onSelectTask={(t) => setSelectedTaskId(t.id)}
        onUpdateEmployee={handleUpdateEmployee}
      />

      <ScheduleMeetingModal
        isOpen={isScheduleMeetingOpen}
        departments={departmentNames}
        employees={employees}
        currentUserName={currentUserName}
        onClose={() => setIsScheduleMeetingOpen(false)}
        onSchedule={handleScheduleMeeting}
      />

      <CreateAnnouncementModal
        isOpen={isCreateAnnouncementOpen}
        departments={departmentNames}
        currentUserName={currentUserName}
        currentRole={currentRole}
        onClose={() => setIsCreateAnnouncementOpen(false)}
        onPublish={handlePublishAnnouncement}
      />

      <CreateDepartmentModal
        isOpen={isCreateDeptOpen}
        employees={employees}
        currentUserName={currentUserName}
        onClose={() => setIsCreateDeptOpen(false)}
        onCreateDepartment={handleCreateDepartment}
      />
    </div>
  );
}
