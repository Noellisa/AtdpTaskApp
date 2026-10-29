import React, { useRef, useState } from 'react';
import {
  Camera,
  Check,
  Copy,
  Download,
  FileSpreadsheet,
  FileText,
  Mail,
  Upload,
  UserCheck,
  UserPlus,
  X,
} from 'lucide-react';
import {
  EmployeeDocument,
  EmployeeRecord,
  OnboardingStatus,
  RolePerspective,
} from '../types';
import { Avatar } from './Avatar';
import { compressProfileImage, processUploadedFile } from '../utils/fileUpload';

interface CreateEmployeeSectionProps {
  employees: EmployeeRecord[];
  departments: string[];
  currentUserName: string;
  mode?: 'single' | 'csv';
  hideHeader?: boolean;
  onAddEmployee: (
    emp: Omit<EmployeeRecord, 'id' | 'workspaceOwnerId' | 'createdAt' | 'updatedAt'>
  ) => Promise<void>;
  onBulkAddEmployees: (
    emps: Omit<EmployeeRecord, 'id' | 'workspaceOwnerId' | 'createdAt' | 'updatedAt'>[]
  ) => Promise<void>;
  onNavigateToDirectory: () => void;
}

const AVATAR_COLORS = ['slate', 'blue', 'emerald', 'violet', 'amber', 'teal', 'rose', 'indigo', 'cyan'];

export const CreateEmployeeSection: React.FC<CreateEmployeeSectionProps> = ({
  employees,
  departments,
  currentUserName,
  mode,
  hideHeader = false,
  onAddEmployee,
  onBulkAddEmployees,
  onNavigateToDirectory,
}) => {
  const [internalMode, setInternalMode] = useState<'single' | 'csv'>(mode || 'single');
  const activeMode = mode || internalMode;

  const nextStaffNumber = employees.length + 1;
  const defaultStaffId = `ATDP-2026-${String(nextStaffNumber).padStart(3, '0')}`;

  // Single Employee Form State
  const [staffId, setStaffId] = useState(defaultStaffId);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('+233 ');
  const [nationalId, setNationalId] = useState('GHA-');
  const [location, setLocation] = useState('Accra HQ, Ghana');
  const [role, setRole] = useState('');
  const [accessLevel, setAccessLevel] = useState<RolePerspective>('Employee');
  const [department, setDepartment] = useState(departments[0] || 'Programmes');
  const [desk, setDesk] = useState('Global Desk');
  const [managerName, setManagerName] = useState(currentUserName);
  const [onboardingStatus, setOnboardingStatus] = useState<OnboardingStatus>('INVITED');
  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [documents, setDocuments] = useState<EmployeeDocument[]>([]);
  const [docCategory, setDocCategory] = useState('Contract');
  const [submitting, setSubmitting] = useState(false);

  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const docInputRef = useRef<HTMLInputElement | null>(null);

  // Recently Created Invite Banner State
  const [lastInvited, setLastInvited] = useState<{
    fullName: string;
    email: string;
    role: string;
    department: string;
    staffId: string;
  } | null>(null);
  const [copiedInvite, setCopiedInvite] = useState(false);

  // CSV Bulk Import State
  const [csvText, setCsvText] = useState('');
  const [csvError, setCsvError] = useState('');
  const [importingCsv, setImportingCsv] = useState(false);

  const managersList = employees.filter(
    (e) => e.accessLevel === 'Top Management' || e.accessLevel === 'Supervisor'
  );

  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const compressed = await compressProfileImage(file);
    setAvatarUrl(compressed);
    if (photoInputRef.current) photoInputRef.current.value = '';
  };

  const handleDocSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || documents.length >= 10) return;
    const processed = await processUploadedFile(file);
    const todayStr = new Date().toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
    setDocuments((prev) => [
      ...prev,
      {
        id: `doc-${Date.now()}`,
        fileName: processed.fileName.slice(0, 100),
        category: docCategory,
        fileSize: processed.fileSize,
        fileUrl: processed.fileUrl,
        uploadedAt: todayStr,
      },
    ]);
    if (docInputRef.current) docInputRef.current.value = '';
  };

  const handleSingleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !email.trim() || !role.trim()) return;
    setSubmitting(true);
    try {
      const todayStr = new Date().toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
      const computedStaffId =
        staffId.trim() || `ATDP-2026-${String(employees.length + 1).padStart(3, '0')}`;
      const color = AVATAR_COLORS[employees.length % AVATAR_COLORS.length];

      await onAddEmployee({
        staffId: computedStaffId.slice(0, 40),
        onboardingStatus,
        fullName: fullName.trim().slice(0, 120),
        email: email.trim().toLowerCase().slice(0, 150),
        phone: phone.trim().slice(0, 40) || '+233 50 000 0000',
        role: role.trim().slice(0, 100),
        accessLevel,
        department,
        desk: desk.trim().slice(0, 100) || 'Operations Desk',
        managerName: managerName.trim().slice(0, 120) || currentUserName,
        joinDate: todayStr,
        location: location.trim().slice(0, 100) || 'Accra HQ, Ghana',
        nationalId: nationalId.trim().slice(0, 60) || 'GHA-000000000-0',
        bio:
          bio.trim().slice(0, 600) ||
          `${role.trim()} assigned to ${department} (${desk.trim() || 'Operations Desk'}).`,
        avatarColor: color,
        avatarUrl,
        badges: [role.trim().slice(0, 40), department],
        documents,
        performanceScore: 100,
        onTimeRate: 100,
        performanceReviews: [],
      });

      setLastInvited({
        fullName: fullName.trim(),
        email: email.trim().toLowerCase(),
        role: role.trim(),
        department,
        staffId: computedStaffId,
      });

      // Reset form for next entry
      const nextNum = employees.length + 2;
      setStaffId(`ATDP-2026-${String(nextNum).padStart(3, '0')}`);
      setFullName('');
      setEmail('');
      setPhone('+233 ');
      setNationalId('GHA-');
      setRole('');
      setBio('');
      setAvatarUrl('');
      setDocuments([]);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopyInviteDetails = () => {
    if (!lastInvited) return;
    const text = `ATDP Workforce Flow Invitation\nName: ${lastInvited.fullName}\nOfficial Email: ${lastInvited.email}\nStaff ID: ${lastInvited.staffId}\nRole: ${lastInvited.role} (${lastInvited.department})\nInstructions: Open the ATDP Workforce Flow portal and sign up using ${lastInvited.email} to complete your onboarding profile.`;
    navigator.clipboard.writeText(text);
    setCopiedInvite(true);
    window.setTimeout(() => setCopiedInvite(false), 2500);
  };

  const handleDownloadCsvTemplate = () => {
    const headers =
      'FullName,Email,Phone,NationalID,JobTitle,AccessLevel,Department,Desk,ManagerName,Location';
    const exampleRow = `Kofi Mensah,kofi.mensah@atdp.org,+233 50 123 4567,GHA-123456789-0,Program Associate,Employee,Programmes,Global Desk,${currentUserName},Accra HQ`;
    const content = `${headers}\n${exampleRow}\n`;
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'ATDP_Employee_Import_Template.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleExportEmployeesCsv = () => {
    const headers = [
      'StaffID',
      'OnboardingStatus',
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
      'PerformanceScore',
      'OnTimeRate',
    ];
    const rows = employees.map((e) =>
      [
        e.staffId,
        e.onboardingStatus,
        `"${e.fullName.replace(/"/g, '""')}"`,
        e.email,
        `"${e.phone}"`,
        e.nationalId,
        `"${e.role.replace(/"/g, '""')}"`,
        e.accessLevel,
        e.department,
        `"${e.desk.replace(/"/g, '""')}"`,
        `"${e.managerName.replace(/"/g, '""')}"`,
        `"${e.location.replace(/"/g, '""')}"`,
        e.joinDate,
        e.performanceScore,
        e.onTimeRate,
      ].join(',')
    );
    const content = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ATDP_Employee_Database_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleCsvFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setCsvText(reader.result);
      }
    };
    reader.readAsText(file);
  };

  const handleProcessCsvImport = async (e: React.FormEvent) => {
    e.preventDefault();
    setCsvError('');
    const lines = csvText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);

    if (lines.length === 0) {
      setCsvError('Please upload a CSV file or paste CSV lines first.');
      return;
    }

    const dataLines =
      lines[0].toLowerCase().includes('fullname') || lines[0].toLowerCase().includes('email')
        ? lines.slice(1)
        : lines;

    if (dataLines.length === 0) {
      setCsvError('No data rows found below the header row.');
      return;
    }

    const todayStr = new Date().toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });

    const parsedRecords: Omit<
      EmployeeRecord,
      'id' | 'workspaceOwnerId' | 'createdAt' | 'updatedAt'
    >[] = [];

    for (let i = 0; i < dataLines.length; i++) {
      const cols = dataLines[i].split(',').map((c) => c.trim().replace(/^"|"$/g, ''));
      if (cols.length < 2 || !cols[0] || !cols[1]) {
        setCsvError(`Row ${i + 1} is missing FullName or Email.`);
        return;
      }
      const [
        rowName,
        rowEmail,
        rowPhone = '+233 50 000 0000',
        rowNatId = 'GHA-000000000-0',
        rowTitle = 'Program Associate',
        rowTier = 'Employee',
        rowDept = departments[0] || 'Programmes',
        rowDesk = 'General Desk',
        rowManager = currentUserName,
        rowLoc = 'Accra HQ, Ghana',
      ] = cols;

      const normalizedTier: RolePerspective =
        rowTier === 'Top Management' || rowTier === 'Supervisor' ? rowTier : 'Employee';

      parsedRecords.push({
        staffId: `ATDP-2026-${String(employees.length + i + 1).padStart(3, '0')}`,
        onboardingStatus: 'INVITED',
        fullName: rowName.slice(0, 120),
        email: rowEmail.toLowerCase().slice(0, 150),
        phone: rowPhone.slice(0, 40),
        nationalId: rowNatId.slice(0, 60),
        role: rowTitle.slice(0, 100),
        accessLevel: normalizedTier,
        department: rowDept.slice(0, 80),
        desk: rowDesk.slice(0, 100),
        managerName: rowManager.slice(0, 120),
        location: rowLoc.slice(0, 100),
        joinDate: todayStr,
        bio: `${rowTitle} in ${rowDept} (${rowDesk}).`,
        avatarColor: AVATAR_COLORS[(employees.length + i) % AVATAR_COLORS.length],
        avatarUrl: '',
        badges: [rowTitle.slice(0, 40), rowDept.slice(0, 40)],
        documents: [],
        performanceScore: 100,
        onTimeRate: 100,
        performanceReviews: [],
      });
    }

    setImportingCsv(true);
    try {
      await onBulkAddEmployees(parsedRecords);
      setCsvText('');
    } finally {
      setImportingCsv(false);
    }
  };

  return (
    <div className="space-y-6">
      {!hideHeader && (
        <>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-display font-bold text-slate-900">
                Create Employee & Staff Onboarding
              </h1>
              <p className="text-sm text-slate-500 mt-0.5">
                Register staff by email invite, upload photos & HR documents, or bulk import/export your employee database
              </p>
            </div>
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={handleExportEmployeesCsv}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-800 transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export Database (.CSV)</span>
              </button>
              <button
                type="button"
                onClick={onNavigateToDirectory}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 transition-colors"
              >
                <span>View Employee Database ({employees.length})</span>
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 p-1 bg-slate-200/70 rounded-xl w-fit">
            <button
              type="button"
              onClick={() => setInternalMode('single')}
              className={`px-4 py-2 rounded-lg text-xs font-semibold transition-colors ${
                activeMode === 'single'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Register Single Employee & Email Invite
            </button>
            <button
              type="button"
              onClick={() => setInternalMode('csv')}
              className={`px-4 py-2 rounded-lg text-xs font-semibold transition-colors ${
                activeMode === 'csv'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Bulk CSV Import & Export
            </button>
          </div>
        </>
      )}

      {/* Confirmation Banner when an Employee Invite is Created */}
      {lastInvited && (
        <div className="p-5 rounded-2xl bg-emerald-50/90 border border-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="text-xs font-bold text-emerald-900 flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-emerald-700" />
              <span>
                Employee Registered: {lastInvited.fullName} ({lastInvited.staffId})
              </span>
            </div>
            <p className="text-xs text-emerald-800">
              Invited email <strong>{lastInvited.email}</strong> for{' '}
              <strong>
                {lastInvited.role} ({lastInvited.department})
              </strong>
              . When {lastInvited.fullName} signs up on the Onboarding screen with{' '}
              <strong>{lastInvited.email}</strong>, their account will automatically link to this
              record.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <a
              href={`mailto:${encodeURIComponent(
                lastInvited.email
              )}?subject=${encodeURIComponent(
                'Invitation to Join ATDP Workforce Flow'
              )}&body=${encodeURIComponent(
                `Hello ${lastInvited.fullName},\n\nYou have been registered on the ATDP Workforce Flow platform as ${lastInvited.role} in the ${lastInvited.department} department (Staff ID: ${lastInvited.staffId}).\n\nPlease open the ATDP Workforce Flow portal and sign up using your official email (${lastInvited.email}) to complete your employee onboarding.\n\nBest regards,\n${currentUserName}`
              )}`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-emerald-300 text-emerald-900 text-xs font-semibold hover:bg-emerald-100 transition-colors"
            >
              <Mail className="w-3.5 h-3.5" />
              <span>Open Email Client</span>
            </a>
            <button
              type="button"
              onClick={handleCopyInviteDetails}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-800 text-white text-xs font-semibold hover:bg-emerald-900 transition-colors"
            >
              {copiedInvite ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Copied Invite</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy Invite Details</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {activeMode === 'single' ? (
        <form
          onSubmit={handleSingleSubmit}
          className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-6 sm:p-8 space-y-6"
        >
          {/* Section 1: Personal Info, Photo, Contact & National ID */}
          <div className="space-y-4">
            <div className="border-b border-slate-100 pb-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-display font-bold text-slate-900">
                  1. Personal Information, Profile Photo & National ID
                </h2>
                <p className="text-xs text-slate-500">
                  The employee’s official email address is used to match their invitation when they sign up
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Avatar name={fullName || 'ATDP'} src={avatarUrl} size="md" />
                <div>
                  <input
                    ref={photoInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoSelect}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => photoInputRef.current?.click()}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    <span>{avatarUrl ? 'Change Photo' : 'Upload Profile Photo'}</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g., Ama Mensah"
                  className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Official Email (Invite Address) *
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="employee@atdp.org"
                  className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Phone Number *
                </label>
                <input
                  type="text"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+233 50 111 2222"
                  className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-lg font-mono-tabular focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  National ID Number
                </label>
                <input
                  type="text"
                  value={nationalId}
                  onChange={(e) => setNationalId(e.target.value)}
                  placeholder="GHA-728491023-4"
                  className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-lg font-mono-tabular focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Staff ID Code
                </label>
                <input
                  type="text"
                  value={staffId}
                  onChange={(e) => setStaffId(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-lg font-mono-tabular focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Office / Duty Location
                </label>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Accra HQ, Ghana"
                  className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Employment Information, Department, Desk & Role Tier */}
          <div className="space-y-4">
            <div className="border-b border-slate-100 pb-2">
              <h2 className="text-sm font-display font-bold text-slate-900">
                2. Job Title, Department, Desk, Reporting Manager & Role Tier
              </h2>
              <p className="text-xs text-slate-500">
                Configure organizational placement and platform permissions
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Job Title / Position *
                </label>
                <input
                  type="text"
                  required
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  placeholder="e.g., Program Associate"
                  className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Role Permission Tier *
                </label>
                <select
                  value={accessLevel}
                  onChange={(e) => setAccessLevel(e.target.value as RolePerspective)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
                >
                  <option value="Employee">Employee (Task Execution & Uploads)</option>
                  <option value="Supervisor">Supervisor (Task Review & Approvals)</option>
                  <option value="Top Management">
                    Top Management (Full Admin & Staff Creation)
                  </option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Onboarding Status
                </label>
                <select
                  value={onboardingStatus}
                  onChange={(e) => setOnboardingStatus(e.target.value as OnboardingStatus)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
                >
                  <option value="INVITED">
                    Send Email Invite (Completes Onboarding on Sign-Up)
                  </option>
                  <option value="ACTIVE">Mark Active Immediately</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Department *
                </label>
                <select
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
                >
                  {departments.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Assigned Desk / Unit
                </label>
                <input
                  type="text"
                  value={desk}
                  onChange={(e) => setDesk(e.target.value)}
                  placeholder="e.g., Global Desk"
                  className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Reporting Manager / Supervisor
                </label>
                <input
                  type="text"
                  list="managers-suggestions"
                  value={managerName}
                  onChange={(e) => setManagerName(e.target.value)}
                  placeholder="Supervisor full name"
                  className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
                <datalist id="managers-suggestions">
                  {managersList.map((m) => (
                    <option key={m.id} value={m.fullName} />
                  ))}
                </datalist>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Role Mandate & Responsibilities Summary
              </label>
              <textarea
                rows={2}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Outline key responsibilities, reporting deliverables, and desk objectives..."
                className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>

            {/* Section 3: HR Document File Uploads (CV, Contract, Offer Letter, ID) */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-slate-600" />
                    Attach HR Documents (CV, Contract, Offer Letter, National ID)
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Upload files from your computer to store on the employee’s HR profile
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={docCategory}
                    onChange={(e) => setDocCategory(e.target.value)}
                    className="px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg"
                  >
                    <option value="Contract">Contract / Offer</option>
                    <option value="CV">CV / Resume</option>
                    <option value="Identification">National ID</option>
                    <option value="Certificate">Certificate</option>
                  </select>
                  <input
                    ref={docInputRef}
                    type="file"
                    onChange={handleDocSelect}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => docInputRef.current?.click()}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Upload File</span>
                  </button>
                </div>
              </div>

              {documents.length > 0 && (
                <div className="space-y-1.5">
                  {documents.map((doc) => (
                    <div
                      key={doc.id}
                      className="flex items-center justify-between px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                    >
                      <span className="font-medium text-slate-800">
                        {doc.fileName}{' '}
                        <span className="text-slate-400">
                          · {doc.category} ({doc.fileSize})
                        </span>
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setDocuments((prev) => prev.filter((item) => item.id !== doc.id))
                        }
                        className="text-slate-400 hover:text-rose-600"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-3">
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#0F172A] text-white text-xs font-semibold hover:bg-slate-800 transition-colors disabled:opacity-50"
            >
              <UserPlus className="w-4 h-4" />
              <span>
                {submitting
                  ? 'Saving Employee...'
                  : onboardingStatus === 'INVITED'
                  ? 'Register Employee & Generate Email Invite'
                  : 'Create Active Employee Record'}
              </span>
            </button>
          </div>
        </form>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-6 sm:p-8 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-base font-display font-bold text-slate-900">
                Bulk CSV Employee Import & Database Export
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Import multiple staff members into the ATDP Employee Database at once
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleDownloadCsvTemplate}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-700"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Download CSV Template</span>
              </button>
            </div>
          </div>

          <form onSubmit={handleProcessCsvImport} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Upload .CSV File from Computer
              </label>
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={handleCsvFileUpload}
                className="w-full text-xs text-slate-600 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-slate-900 file:text-white hover:file:bg-slate-800"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Or Paste CSV Rows Directly (`FullName,Email,Phone,NationalID,JobTitle,AccessLevel,Department,Desk,ManagerName,Location`)
              </label>
              <textarea
                rows={6}
                value={csvText}
                onChange={(e) => setCsvText(e.target.value)}
                placeholder={`Ama Mensah,ama.mensah@atdp.org,+233 50 111 2222,GHA-728491023-4,Program Associate,Employee,Programmes,Global Desk,${currentUserName},Accra HQ\nKwame Asante,kwame.asante@atdp.org,+233 50 222 3344,GHA-519203841-1,Director of Programmes,Supervisor,Programmes,Executive Desk,${currentUserName},Accra HQ`}
                className="w-full px-3.5 py-2.5 text-xs font-mono-tabular border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>

            {csvError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700">
                {csvError}
              </div>
            )}

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={importingCsv}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#0F172A] text-white text-xs font-semibold hover:bg-slate-800 transition-colors disabled:opacity-50"
              >
                <Upload className="w-4 h-4" />
                <span>{importingCsv ? 'Importing...' : 'Import Employees to Database'}</span>
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
