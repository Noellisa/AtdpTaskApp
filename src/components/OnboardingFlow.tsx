import React, { useRef, useState } from 'react';
import {
  ArrowRight,
  Camera,
  ShieldCheck,
  Upload,
  UserCheck,
  X,
} from 'lucide-react';
import { EmployeeDocument, EmployeeRecord } from '../types';
import { Avatar } from './Avatar';
import { compressProfileImage, processUploadedFile } from '../utils/fileUpload';

interface OnboardingFlowProps {
  employees: EmployeeRecord[];
  departments: string[];
  defaultEmail?: string;
  onCompleteExecutiveSetup: (
    execProfile: Omit<EmployeeRecord, 'id' | 'workspaceOwnerId' | 'createdAt' | 'updatedAt'>
  ) => Promise<EmployeeRecord>;
  onClaimInvitedProfile: (
    employeeId: string,
    updates: Partial<EmployeeRecord>
  ) => Promise<EmployeeRecord>;
  onSelectExistingActiveUser: (employee: EmployeeRecord) => void;
  onGoogleSignIn: () => Promise<{ email: string; displayName: string } | null>;
}

export const OnboardingFlow: React.FC<OnboardingFlowProps> = ({
  employees,
  departments,
  defaultEmail = '',
  onCompleteExecutiveSetup,
  onClaimInvitedProfile,
  onSelectExistingActiveUser,
  onGoogleSignIn,
}) => {
  const hasTopManagement = employees.some((e) => e.accessLevel === 'Top Management');

  const [mode, setMode] = useState<'executive_setup' | 'sign_in_or_claim' | 'complete_invite'>(
    hasTopManagement ? 'sign_in_or_claim' : 'executive_setup'
  );

  // Executive Setup Form State
  const [execName, setExecName] = useState('');
  const [execEmail, setExecEmail] = useState(defaultEmail);
  const [execPhone, setExecPhone] = useState('+233 ');
  const [execRole, setExecRole] = useState('Managing Director');
  const [execDept, setExecDept] = useState('Executive');
  const [execDesk, setExecDesk] = useState('Leadership Office');
  const [execNationalId, setExecNationalId] = useState('GHA-');
  const [execLocation, setExecLocation] = useState('Accra HQ, Ghana');
  const [execBio, setExecBio] = useState('');
  const [execAvatarUrl, setExecAvatarUrl] = useState('');
  const [execDocs, setExecDocs] = useState<EmployeeDocument[]>([]);
  const [execDocCategory, setExecDocCategory] = useState('Contract');

  const execPhotoInputRef = useRef<HTMLInputElement | null>(null);
  const execDocInputRef = useRef<HTMLInputElement | null>(null);

  // Email Lookup / Claim State
  const [lookupEmail, setLookupEmail] = useState('');
  const [lookupError, setLookupError] = useState('');
  const [matchedInvite, setMatchedInvite] = useState<EmployeeRecord | null>(null);

  // Invited Employee Onboarding Completion State
  const [claimPhone, setClaimPhone] = useState('');
  const [claimNationalId, setClaimNationalId] = useState('');
  const [claimLocation, setClaimLocation] = useState('Accra HQ, Ghana');
  const [claimBio, setClaimBio] = useState('');
  const [claimAvatarUrl, setClaimAvatarUrl] = useState('');
  const [claimDocs, setClaimDocs] = useState<EmployeeDocument[]>([]);
  const [newDocName, setNewDocName] = useState('');
  const [newDocCategory, setNewDocCategory] = useState('CV');
  const [submitting, setSubmitting] = useState(false);

  const claimPhotoInputRef = useRef<HTMLInputElement | null>(null);
  const claimDocInputRef = useRef<HTMLInputElement | null>(null);

  const handleExecPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const compressed = await compressProfileImage(file);
    setExecAvatarUrl(compressed);
    if (execPhotoInputRef.current) execPhotoInputRef.current.value = '';
  };

  const handleExecDocUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || execDocs.length >= 10) return;
    const processed = await processUploadedFile(file);
    const todayStr = new Date().toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
    setExecDocs((prev) => [
      ...prev,
      {
        id: `doc-${Date.now()}`,
        fileName: processed.fileName.slice(0, 100),
        category: execDocCategory,
        fileSize: processed.fileSize,
        fileUrl: processed.fileUrl,
        uploadedAt: todayStr,
      },
    ]);
    if (execDocInputRef.current) execDocInputRef.current.value = '';
  };

  const handleClaimPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const compressed = await compressProfileImage(file);
    setClaimAvatarUrl(compressed);
    if (claimPhotoInputRef.current) claimPhotoInputRef.current.value = '';
  };

  const handleClaimFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || claimDocs.length >= 10) return;
    const processed = await processUploadedFile(file);
    setClaimDocs((prev) => [
      ...prev,
      {
        id: `doc-${Date.now()}`,
        fileName: processed.fileName.slice(0, 100),
        category: newDocCategory,
        fileSize: processed.fileSize,
        fileUrl: processed.fileUrl,
        uploadedAt: new Date().toLocaleDateString('en-GB', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        }),
      },
    ]);
    if (claimDocInputRef.current) claimDocInputRef.current.value = '';
  };

  const handleExecSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!execName.trim() || !execEmail.trim()) return;
    setSubmitting(true);
    try {
      const todayStr = new Date().toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
      await onCompleteExecutiveSetup({
        staffId: 'ATDP-2026-001',
        onboardingStatus: 'ACTIVE',
        fullName: execName.trim().slice(0, 120),
        email: execEmail.trim().toLowerCase().slice(0, 150),
        phone: execPhone.trim().slice(0, 40) || '+233 50 000 0000',
        role: execRole.trim().slice(0, 100) || 'Managing Director',
        accessLevel: 'Top Management',
        department: execDept,
        desk: execDesk.trim().slice(0, 100) || 'Leadership Office',
        managerName: 'Board of Directors',
        joinDate: todayStr,
        location: execLocation.trim().slice(0, 100) || 'Accra HQ, Ghana',
        nationalId: execNationalId.trim().slice(0, 60) || 'GHA-000000000-0',
        bio:
          execBio.trim().slice(0, 600) ||
          'Top Management executive overseeing ATDP operations, departments, and workforce delivery.',
        avatarColor: 'slate',
        avatarUrl: execAvatarUrl,
        badges: [execRole.trim() || 'Executive', 'Top Management'],
        documents:
          execDocs.length > 0
            ? execDocs
            : [
                {
                  id: `doc-${Date.now()}`,
                  fileName: `Executive_Charter_${execName.trim().replace(/\s+/g, '_')}.pdf`,
                  category: 'Contract',
                  fileSize: '840 KB',
                  uploadedAt: todayStr,
                },
              ],
        performanceScore: 100,
        onTimeRate: 100,
        performanceReviews: [],
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleEmailCheck = (emailToVerify: string) => {
    setLookupError('');
    const normalized = emailToVerify.trim().toLowerCase();
    if (!normalized) {
      setLookupError('Please enter your official ATDP email address.');
      return;
    }

    const found = employees.find((e) => e.email.toLowerCase() === normalized);
    if (!found) {
      setLookupError(
        'No employee record or pending email invitation found for this address. Ask Top Management to register your email in the Employees section first, or set up a Top Management account below.'
      );
      return;
    }

    if (found.onboardingStatus === 'ACTIVE') {
      onSelectExistingActiveUser(found);
      return;
    }

    setMatchedInvite(found);
    setClaimPhone(found.phone || '+233 ');
    setClaimNationalId(found.nationalId || 'GHA-');
    setClaimLocation(found.location || 'Accra HQ, Ghana');
    setClaimBio(found.bio || '');
    setClaimAvatarUrl(found.avatarUrl || '');
    setClaimDocs(
      found.documents.length > 0
        ? found.documents
        : [
            {
              id: `doc-cv-${Date.now()}`,
              fileName: `CV - ${found.fullName}.pdf`,
              category: 'CV',
              fileSize: '450 KB',
              uploadedAt: new Date().toLocaleDateString('en-GB', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
              }),
            },
          ]
    );
    setMode('complete_invite');
  };

  const handleGoogleLookup = async () => {
    setLookupError('');
    const profile = await onGoogleSignIn();
    if (profile?.email) {
      setLookupEmail(profile.email);
      const found = employees.find(
        (e) => e.email.toLowerCase() === profile.email.toLowerCase()
      );
      if (found) {
        handleEmailCheck(profile.email);
      } else if (!hasTopManagement) {
        setExecName(profile.displayName || '');
        setExecEmail(profile.email);
        setMode('executive_setup');
      } else {
        setLookupError(
          `Signed in as ${profile.email}, but no invitation was found yet. Please enter an invited email or register as Top Management.`
        );
      }
    }
  };

  const handleAddClaimDoc = () => {
    if (!newDocName.trim() || claimDocs.length >= 10) return;
    setClaimDocs((prev) => [
      ...prev,
      {
        id: `doc-${Date.now()}`,
        fileName: newDocName.trim().slice(0, 100),
        category: newDocCategory,
        fileSize: '520 KB',
        uploadedAt: new Date().toLocaleDateString('en-GB', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        }),
      },
    ]);
    setNewDocName('');
  };

  const handleCompleteInviteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!matchedInvite) return;
    setSubmitting(true);
    try {
      const todayStr = new Date().toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
      await onClaimInvitedProfile(matchedInvite.id, {
        onboardingStatus: 'ACTIVE',
        phone: claimPhone.trim().slice(0, 40),
        nationalId: claimNationalId.trim().slice(0, 60),
        location: claimLocation.trim().slice(0, 100),
        bio: claimBio.trim().slice(0, 600) || `Member of the ATDP ${matchedInvite.department} team.`,
        avatarUrl: claimAvatarUrl,
        joinDate: todayStr,
        documents: claimDocs,
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col justify-between p-4 sm:p-8">
      {/* Top Brand Header */}
      <header className="max-w-5xl w-full mx-auto flex items-center justify-between py-2">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#0F172A] text-white font-display font-bold flex items-center justify-center text-base">
            A
          </div>
          <div>
            <span className="text-sm font-display font-bold text-slate-900 block leading-none">
              ATDP
            </span>
            <span className="text-[11px] text-slate-500">Workforce Management</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {hasTopManagement && mode !== 'sign_in_or_claim' && (
            <button
              type="button"
              onClick={() => setMode('sign_in_or_claim')}
              className="px-3.5 py-2 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-200/70 transition-colors"
            >
              Staff Sign-In / Claim Invite
            </button>
          )}
          {mode !== 'executive_setup' && (
            <button
              type="button"
              onClick={() => setMode('executive_setup')}
              className="px-3.5 py-2 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-800 hover:bg-slate-50 transition-colors"
            >
              Top Management Setup
            </button>
          )}
        </div>
      </header>

      {/* Main Onboarding Body */}
      <main className="max-w-5xl w-full mx-auto my-auto py-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Informational Column */}
        <div className="lg:col-span-5 space-y-5 lg:pt-4">
          <div className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 px-3 py-1.5 rounded-lg shadow-2xs">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>ATDP Official Workforce & Task Portal</span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-display font-bold text-slate-900 tracking-tight leading-tight text-balance">
            {mode === 'executive_setup'
              ? 'Initialize your ATDP Top Management profile'
              : mode === 'complete_invite'
              ? `Welcome to ATDP, ${matchedInvite?.fullName}`
              : 'Sign in or claim your ATDP email invitation'}
          </h1>

          <p className="text-sm text-slate-600 leading-relaxed">
            {mode === 'executive_setup'
              ? 'Set up your executive administrator profile, upload your profile photo & HR documents, and start registering employees and tasks across ATDP departments.'
              : mode === 'complete_invite'
              ? 'Top Management has pre-registered your position and department. Upload your profile picture, verify your National ID, and attach HR documents below to activate your workspace.'
              : 'Enter the official email address invited by Top Management (or continue with Google) to complete your staff onboarding and access your assigned tasks.'}
          </p>

          <div className="p-5 rounded-2xl bg-white border border-slate-200/90 space-y-3 shadow-2xs">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              How ATDP Onboarding Works
            </h2>
            <div className="space-y-2.5 text-xs text-slate-600">
              <div className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-slate-900 text-white font-mono-tabular font-bold flex items-center justify-center text-[11px] shrink-0">
                  1
                </span>
                <span>
                  <strong className="text-slate-900">Top Management Invites Staff:</strong> Registers employee emails, job titles, departments, and reporting managers in the Employee Database.
                </span>
              </div>
              <div className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-slate-900 text-white font-mono-tabular font-bold flex items-center justify-center text-[11px] shrink-0">
                  2
                </span>
                <span>
                  <strong className="text-slate-900">Employee Claims Email Invite:</strong> Staff sign up with their invited email, upload their profile picture, verify National ID records, and attach HR documents.
                </span>
              </div>
              <div className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-slate-900 text-white font-mono-tabular font-bold flex items-center justify-center text-[11px] shrink-0">
                  3
                </span>
                <span>
                  <strong className="text-slate-900">Real-Time Task Execution:</strong> Assign tasks, upload versioned files, launch Google Meet syncs, and track performance history.
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Interactive Onboarding Card */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200/90 shadow-xs p-6 sm:p-8">
          {mode === 'executive_setup' && (
            <form onSubmit={handleExecSubmit} className="space-y-4">
              <div className="border-b border-slate-100 pb-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <Avatar name={execName || 'ATDP'} src={execAvatarUrl} size="md" />
                    <input
                      ref={execPhotoInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleExecPhotoUpload}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => execPhotoInputRef.current?.click()}
                      title="Upload profile picture"
                      className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-slate-900 text-white flex items-center justify-center hover:bg-slate-700"
                    >
                      <Camera className="w-3 h-3" />
                    </button>
                  </div>
                  <div>
                    <h2 className="text-base font-display font-bold text-slate-900">
                      Top Management Onboarding
                    </h2>
                    <p className="text-xs text-slate-500">
                      Create your administrator account & upload profile photo
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleGoogleLookup}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-700 transition-colors shrink-0"
                >
                  Autofill with Google
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={execName}
                    onChange={(e) => setExecName(e.target.value)}
                    placeholder="e.g., Nana Owusu"
                    className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Official Email Address *
                  </label>
                  <input
                    type="email"
                    required
                    value={execEmail}
                    onChange={(e) => setExecEmail(e.target.value)}
                    placeholder="name@atdp.org"
                    className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Phone Number *
                  </label>
                  <input
                    type="text"
                    required
                    value={execPhone}
                    onChange={(e) => setExecPhone(e.target.value)}
                    placeholder="+233 50 100 9000"
                    className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-lg font-mono-tabular focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    National ID Number *
                  </label>
                  <input
                    type="text"
                    required
                    value={execNationalId}
                    onChange={(e) => setExecNationalId(e.target.value)}
                    placeholder="GHA-102938475-9"
                    className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-lg font-mono-tabular focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Position / Title *
                  </label>
                  <input
                    type="text"
                    required
                    value={execRole}
                    onChange={(e) => setExecRole(e.target.value)}
                    placeholder="Managing Director"
                    className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Department
                  </label>
                  <select
                    value={execDept}
                    onChange={(e) => setExecDept(e.target.value)}
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
                    Desk / Unit
                  </label>
                  <input
                    type="text"
                    value={execDesk}
                    onChange={(e) => setExecDesk(e.target.value)}
                    placeholder="Leadership Office"
                    className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Office Location
                </label>
                <input
                  type="text"
                  value={execLocation}
                  onChange={(e) => setExecLocation(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Executive Mandate & Summary
                </label>
                <textarea
                  rows={2}
                  value={execBio}
                  onChange={(e) => setExecBio(e.target.value)}
                  placeholder="Describe your executive responsibilities at ATDP..."
                  className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>

              {/* Optional Document Upload */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-700">
                    Upload HR / Charter Documents (Optional)
                  </span>
                  <div className="flex items-center gap-2">
                    <select
                      value={execDocCategory}
                      onChange={(e) => setExecDocCategory(e.target.value)}
                      className="px-2 py-1 text-xs bg-white border border-slate-200 rounded-lg"
                    >
                      <option value="Contract">Contract</option>
                      <option value="CV">CV</option>
                      <option value="Identification">ID</option>
                    </select>
                    <input
                      ref={execDocInputRef}
                      type="file"
                      onChange={handleExecDocUpload}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => execDocInputRef.current?.click()}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-900 text-white text-xs font-medium"
                    >
                      <Upload className="w-3 h-3" />
                      <span>Upload File</span>
                    </button>
                  </div>
                </div>
                {execDocs.length > 0 && (
                  <div className="space-y-1">
                    {execDocs.map((d) => (
                      <div
                        key={d.id}
                        className="flex items-center justify-between text-xs bg-white px-2.5 py-1 rounded border border-slate-200"
                      >
                        <span className="truncate">
                          {d.fileName} ({d.category} · {d.fileSize})
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setExecDocs((prev) => prev.filter((item) => item.id !== d.id))
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

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#0F172A] text-white text-xs font-semibold hover:bg-slate-800 transition-colors disabled:opacity-50"
                >
                  <span>Complete Setup & Enter Workspace</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </form>
          )}

          {mode === 'sign_in_or_claim' && (
            <div className="space-y-6">
              <div className="border-b border-slate-100 pb-4">
                <h2 className="text-base font-display font-bold text-slate-900">
                  Employee & Management Sign-In
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Sign in with your registered ATDP email or claim a pending email invitation
                </p>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleEmailCheck(lookupEmail);
                }}
                className="space-y-3"
              >
                <label className="block text-xs font-semibold text-slate-700">
                  Official Email Address
                </label>
                <div className="flex gap-2">
                  <input
                    type="email"
                    required
                    value={lookupEmail}
                    onChange={(e) => setLookupEmail(e.target.value)}
                    placeholder="Enter the email registered by Top Management..."
                    className="flex-1 px-3.5 py-2.5 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                  <button
                    type="submit"
                    className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#0F172A] text-white text-xs font-semibold hover:bg-slate-800 transition-colors shrink-0"
                  >
                    <span>Continue</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </form>

              {lookupError && (
                <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 leading-relaxed">
                  {lookupError}
                </div>
              )}

              <div className="flex items-center gap-3">
                <div className="h-px bg-slate-100 flex-1" />
                <span className="text-[11px] text-slate-400 font-medium">OR</span>
                <div className="h-px bg-slate-100 flex-1" />
              </div>

              <button
                type="button"
                onClick={handleGoogleLookup}
                className="w-full py-2.5 px-4 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-800 flex items-center justify-center gap-2 transition-colors"
              >
                <span>Continue with Google Sign-In</span>
              </button>

              {employees.length > 0 && (
                <div className="pt-4 border-t border-slate-100 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-semibold text-slate-500">
                      Registered Workspace Accounts & Pending Email Invites ({employees.length})
                    </h3>
                  </div>
                  <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden max-h-56 overflow-y-auto">
                    {employees.map((emp) => (
                      <div
                        key={emp.id}
                        className="px-4 py-3 flex items-center justify-between gap-3 bg-white hover:bg-slate-50 transition-colors"
                      >
                        <div className="flex items-center gap-2.5">
                          <Avatar
                            name={emp.fullName}
                            src={emp.avatarUrl}
                            color={emp.avatarColor}
                            size="sm"
                          />
                          <div>
                            <div className="text-xs font-bold text-slate-900">
                              {emp.fullName}{' '}
                              <span className="font-normal text-slate-500">
                                · {emp.role} ({emp.accessLevel})
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-400 font-mono-tabular">
                              {emp.email} · {emp.department}
                            </div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleEmailCheck(emp.email)}
                          className={`px-3 py-1 rounded-lg text-[11px] font-semibold transition-colors shrink-0 ${
                            emp.onboardingStatus === 'INVITED'
                              ? 'bg-amber-100 text-amber-900 hover:bg-amber-200'
                              : 'bg-slate-900 text-white hover:bg-slate-800'
                          }`}
                        >
                          {emp.onboardingStatus === 'INVITED'
                            ? 'Complete Onboarding →'
                            : 'Sign In →'}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {mode === 'complete_invite' && matchedInvite && (
            <form onSubmit={handleCompleteInviteSubmit} className="space-y-4">
              <div className="border-b border-slate-100 pb-4 flex items-center justify-between gap-3">
                <div className="space-y-1">
                  <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                    Invitation Verified · Staff ID: {matchedInvite.staffId}
                  </span>
                  <h2 className="text-base font-display font-bold text-slate-900 mt-1">
                    Complete Your Employee Onboarding Profile
                  </h2>
                  <p className="text-xs text-slate-500">
                    Assigned as <strong>{matchedInvite.role}</strong> ({matchedInvite.accessLevel}) in{' '}
                    <strong>
                      {matchedInvite.department}, {matchedInvite.desk}
                    </strong>{' '}
                    · Manager: <strong>{matchedInvite.managerName}</strong>
                  </p>
                </div>

                <div className="flex flex-col items-center gap-1 shrink-0">
                  <Avatar
                    name={matchedInvite.fullName}
                    src={claimAvatarUrl}
                    color={matchedInvite.avatarColor}
                    size="lg"
                  />
                  <input
                    ref={claimPhotoInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleClaimPhotoUpload}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => claimPhotoInputRef.current?.click()}
                    className="text-[11px] font-semibold text-blue-600 hover:underline flex items-center gap-1"
                  >
                    <Camera className="w-3 h-3" />
                    <span>{claimAvatarUrl ? 'Change Photo' : 'Upload Photo'}</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Phone Number *
                  </label>
                  <input
                    type="text"
                    required
                    value={claimPhone}
                    onChange={(e) => setClaimPhone(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-lg font-mono-tabular"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    National ID Number *
                  </label>
                  <input
                    type="text"
                    required
                    value={claimNationalId}
                    onChange={(e) => setClaimNationalId(e.target.value)}
                    placeholder="GHA-XXXXXXXXX-X"
                    className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-lg font-mono-tabular"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Residential / Office Location *
                </label>
                <input
                  type="text"
                  required
                  value={claimLocation}
                  onChange={(e) => setClaimLocation(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Professional Bio & Desk Focus
                </label>
                <textarea
                  rows={2}
                  value={claimBio}
                  onChange={(e) => setClaimBio(e.target.value)}
                  placeholder="Briefly summarize your background and desk responsibilities..."
                  className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-lg"
                />
              </div>

              {/* HR Onboarding Documents with Real File Upload */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-xs font-semibold text-slate-800">
                    HR Onboarding Documents (CV, Signed Contract, National ID)
                  </h3>
                  <div className="flex items-center gap-2">
                    <select
                      value={newDocCategory}
                      onChange={(e) => setNewDocCategory(e.target.value)}
                      className="px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg"
                    >
                      <option value="CV">CV</option>
                      <option value="Contract">Contract</option>
                      <option value="Identification">Identification</option>
                    </select>
                    <input
                      ref={claimDocInputRef}
                      type="file"
                      onChange={handleClaimFileUpload}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => claimDocInputRef.current?.click()}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 text-white text-xs font-medium rounded-lg hover:bg-slate-800"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>Upload File from Device</span>
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <input
                    type="text"
                    value={newDocName}
                    onChange={(e) => setNewDocName(e.target.value)}
                    placeholder="Or enter document title (e.g., National_ID_Card.pdf)"
                    className="flex-1 min-w-[160px] px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg"
                  />
                  <button
                    type="button"
                    onClick={handleAddClaimDoc}
                    className="px-3 py-1.5 bg-white border border-slate-200 text-slate-700 text-xs font-medium rounded-lg hover:bg-slate-100"
                  >
                    + Add Title
                  </button>
                </div>

                <div className="space-y-1.5">
                  {claimDocs.map((d) => (
                    <div
                      key={d.id}
                      className="flex items-center justify-between text-xs bg-white px-3 py-1.5 rounded-lg border border-slate-200"
                    >
                      <span className="font-medium text-slate-800">
                        {d.fileName} <span className="text-slate-400">· {d.category}</span>
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-slate-400 font-mono-tabular">{d.fileSize}</span>
                        <button
                          type="button"
                          onClick={() =>
                            setClaimDocs((prev) => prev.filter((item) => item.id !== d.id))
                          }
                          className="text-slate-400 hover:text-rose-600"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-2 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setMode('sign_in_or_claim')}
                  className="text-xs font-medium text-slate-500 hover:text-slate-800"
                >
                  ← Back
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 transition-colors"
                >
                  <UserCheck className="w-4 h-4" />
                  <span>Activate Account & Enter Workspace</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </main>

      <footer className="max-w-5xl w-full mx-auto text-xs text-slate-400 py-2 flex items-center justify-between">
        <span>ATDP Workforce Flow · Production Onboarding Portal</span>
        <span>Cloud Firestore & Local Sync Enabled</span>
      </footer>
    </div>
  );
};
