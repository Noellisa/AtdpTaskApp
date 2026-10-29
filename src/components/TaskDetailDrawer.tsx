import React, { useRef, useState } from 'react';
import {
  CheckCircle2,
  Circle,
  Clock,
  Download,
  FileText,
  History,
  MessageSquare,
  Paperclip,
  Plus,
  RotateCcw,
  Send,
  ShieldCheck,
  Upload,
  X,
} from 'lucide-react';
import {
  ALL_TASK_STATUSES,
  DeliverableVersion,
  RolePerspective,
  SubtaskItem,
  TaskComment,
  TaskHistoryEntry,
  TaskRecord,
  TaskStatus,
} from '../types';
import { Avatar } from './Avatar';
import { downloadOrOpenFile, processUploadedFile } from '../utils/fileUpload';

interface TaskDetailDrawerProps {
  task: TaskRecord | null;
  currentUserName: string;
  currentRole: RolePerspective;
  onClose: () => void;
  onUpdateTask: (
    taskId: string,
    updates: Partial<TaskRecord>,
    activityHeadline?: string,
    notificationMsg?: {
      title: string;
      message: string;
      recipient: string;
      category: 'task_status' | 'feedback';
    }
  ) => Promise<void>;
  onSelectEmployeeByName: (name: string) => void;
}

const STATUS_OPTIONS: TaskStatus[] = ALL_TASK_STATUSES;

export function getStatusBadgeStyle(status: TaskStatus): string {
  switch (status) {
    case 'PENDING CONFIRMATION':
      return 'bg-amber-50 text-amber-700 border border-amber-200';
    case 'BACKLOG':
      return 'bg-slate-100 text-slate-600 border border-slate-200';
    case 'ASSIGNED':
      return 'bg-blue-50 text-blue-700 border border-blue-200';
    case 'IN PROGRESS':
      return 'bg-indigo-50 text-indigo-700 border border-indigo-200';
    case 'SUBMITTED':
      return 'bg-violet-50 text-violet-700 border border-violet-200';
    case 'UNDER REVIEW':
      return 'bg-purple-50 text-purple-700 border border-purple-200';
    case 'COMPLETED':
      return 'bg-emerald-50 text-emerald-700 border border-emerald-200';
    case 'ON HOLD':
      return 'bg-gray-100 text-gray-600 border border-gray-200';
    case 'BLOCKED':
      return 'bg-rose-50 text-rose-700 border border-rose-200';
    case 'CANCELLED':
      return 'bg-zinc-200 text-zinc-500 border border-zinc-300 line-through';
    default:
      return 'bg-slate-100 text-slate-700 border border-slate-200';
  }
}

export const TaskDetailDrawer: React.FC<TaskDetailDrawerProps> = ({
  task,
  currentUserName,
  currentRole,
  onClose,
  onUpdateTask,
  onSelectEmployeeByName,
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'deliverables' | 'feedback' | 'history'>(
    'overview'
  );
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [uploadFileName, setUploadFileName] = useState('');
  const [uploadFileUrl, setUploadFileUrl] = useState('');
  const [uploadFileSize, setUploadFileSize] = useState('');
  const [uploadNotes, setUploadNotes] = useState('');
  const [commentText, setCommentText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const quickFileInputRef = useRef<HTMLInputElement | null>(null);

  if (!task) return null;

  const isLocked = task.status === 'CANCELLED';
  const canSupervise = currentRole === 'Supervisor' || currentRole === 'Top Management';
  const primaryAssignee = task.assignees[0] || task.owner || currentUserName;

  const completedSubtasks = task.subtasks.filter((s) => s.completed).length;
  const totalSubtasks = task.subtasks.length;

  const formatTimestamp = () => {
    const d = new Date();
    return d.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleToggleSubtask = async (subtaskId: string) => {
    if (isLocked) return;
    const updatedSubtasks = task.subtasks.map((st) =>
      st.id === subtaskId ? { ...st, completed: !st.completed } : st
    );
    const toggled = updatedSubtasks.find((s) => s.id === subtaskId);
    const historyEntry: TaskHistoryEntry = {
      id: `h-${Date.now()}`,
      action: `${toggled?.completed ? 'Completed' : 'Reopened'} subtask: "${toggled?.title}"`,
      actorName: currentUserName,
      timestamp: formatTimestamp(),
    };
    const nextHistory = [historyEntry, ...task.history].slice(0, 10);
    const nextStatus: TaskStatus =
      task.status === 'ASSIGNED' && toggled?.completed ? 'IN PROGRESS' : task.status;

    await onUpdateTask(task.id, {
      subtasks: updatedSubtasks,
      status: nextStatus,
      history: nextHistory,
    });
  };

  const handleAddSubtask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubtaskTitle.trim() || task.subtasks.length >= 10 || isLocked) return;
    const newItem: SubtaskItem = {
      id: `st-${Date.now()}`,
      title: newSubtaskTitle.trim().slice(0, 140),
      completed: false,
    };
    const historyEntry: TaskHistoryEntry = {
      id: `h-${Date.now()}`,
      action: `Added subtask: "${newItem.title}"`,
      actorName: currentUserName,
      timestamp: formatTimestamp(),
    };
    setNewSubtaskTitle('');
    await onUpdateTask(task.id, {
      subtasks: [...task.subtasks, newItem].slice(0, 10),
      history: [historyEntry, ...task.history].slice(0, 10),
    });
  };

  const handleStatusChange = async (nextStatus: TaskStatus) => {
    if (isLocked || nextStatus === task.status) return;
    const historyEntry: TaskHistoryEntry = {
      id: `h-${Date.now()}`,
      action: `Status changed to ${nextStatus}`,
      actorName: currentUserName,
      timestamp: formatTimestamp(),
    };
    await onUpdateTask(
      task.id,
      {
        status: nextStatus,
        history: [historyEntry, ...task.history].slice(0, 10),
      },
      `Status changed to ${nextStatus}`,
      {
        title: `Task status updated: ${nextStatus}`,
        message: `${currentUserName} updated "${task.title}" to ${nextStatus}.`,
        recipient: task.reviewer,
        category: 'task_status',
      }
    );
  };

  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const processed = await processUploadedFile(file);
    setUploadFileName(processed.fileName);
    setUploadFileSize(processed.fileSize);
    setUploadFileUrl(processed.fileUrl);
  };

  const handleQuickFileAttach = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || isLocked) return;
    setIsSubmitting(true);
    try {
      const processed = await processUploadedFile(file);
      const nextVersionNum = task.deliverables.length + 1;
      const versionLabel = `v${nextVersionNum}`;
      const newDeliv: DeliverableVersion = {
        id: `del-${Date.now()}`,
        version: versionLabel,
        fileName: processed.fileName.slice(0, 120),
        fileSize: processed.fileSize,
        fileUrl: processed.fileUrl,
        notes: 'Uploaded file attachment from task overview.',
        submittedBy: currentUserName,
        submittedAt: formatTimestamp(),
      };
      const historyEntry: TaskHistoryEntry = {
        id: `h-${Date.now()}`,
        action: `${currentUserName} uploaded file "${processed.fileName}" (${versionLabel})`,
        actorName: currentUserName,
        timestamp: formatTimestamp(),
      };
      const nextStatus: TaskStatus =
        task.status === 'ASSIGNED' || task.status === 'IN PROGRESS' ? 'UNDER REVIEW' : task.status;

      await onUpdateTask(
        task.id,
        {
          deliverables: [newDeliv, ...task.deliverables].slice(0, 10),
          status: nextStatus,
          history: [historyEntry, ...task.history].slice(0, 10),
        },
        `${currentUserName} uploaded file (${versionLabel})`,
        {
          title: `File ${versionLabel} uploaded on "${task.title}"`,
          message: `${currentUserName} attached "${newDeliv.fileName}" (${newDeliv.fileSize}).`,
          recipient: task.reviewer,
          category: 'task_status',
        }
      );
    } finally {
      setIsSubmitting(false);
      if (quickFileInputRef.current) {
        quickFileInputRef.current.value = '';
      }
    }
  };

  const handleUploadDeliverable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFileName.trim() || isLocked) return;
    setIsSubmitting(true);
    try {
      const nextVersionNum = task.deliverables.length + 1;
      const versionLabel = `v${nextVersionNum}`;
      const newDeliv: DeliverableVersion = {
        id: `del-${Date.now()}`,
        version: versionLabel,
        fileName: uploadFileName.trim().slice(0, 120),
        fileSize: uploadFileSize || '240 KB',
        fileUrl: uploadFileUrl.trim(),
        notes:
          uploadNotes.trim().slice(0, 300) ||
          'Submitted deliverable file for supervisor review.',
        submittedBy: currentUserName,
        submittedAt: formatTimestamp(),
      };
      const historyEntry: TaskHistoryEntry = {
        id: `h-${Date.now()}`,
        action: `${currentUserName} submitted work (${versionLabel}: ${newDeliv.fileName})`,
        actorName: currentUserName,
        timestamp: formatTimestamp(),
      };
      const nextStatus: TaskStatus =
        task.status === 'ASSIGNED' || task.status === 'IN PROGRESS' ? 'UNDER REVIEW' : task.status;

      await onUpdateTask(
        task.id,
        {
          deliverables: [newDeliv, ...task.deliverables].slice(0, 10),
          status: nextStatus,
          history: [historyEntry, ...task.history].slice(0, 10),
        },
        `${currentUserName} submitted work (${versionLabel})`,
        {
          title: `Deliverable ${versionLabel} submitted for review`,
          message: `${currentUserName} uploaded "${newDeliv.fileName}" on "${task.title}".`,
          recipient: task.reviewer,
          category: 'task_status',
        }
      );
      setUploadFileName('');
      setUploadFileUrl('');
      setUploadFileSize('');
      setUploadNotes('');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSupervisorDecision = async (decision: 'approve' | 'revision') => {
    if (isLocked) return;
    const nextStatus: TaskStatus = decision === 'approve' ? 'COMPLETED' : 'IN PROGRESS';
    const feedbackNote =
      commentText.trim() ||
      (decision === 'approve'
        ? 'Deliverable reviewed and approved by supervisor. Marked as COMPLETED.'
        : 'Revision requested by supervisor. Please address feedback and upload the next version.');

    const newComment: TaskComment = {
      id: `c-${Date.now()}`,
      authorName: currentUserName,
      authorRole: currentRole,
      text: feedbackNote.slice(0, 500),
      type: decision === 'approve' ? 'approval' : 'revision_request',
      createdAt: formatTimestamp(),
    };

    const historyEntry: TaskHistoryEntry = {
      id: `h-${Date.now()}`,
      action:
        decision === 'approve'
          ? `Approved and marked COMPLETED by ${currentUserName}`
          : `Revision requested by ${currentUserName} (returned to IN PROGRESS)`,
      actorName: currentUserName,
      timestamp: formatTimestamp(),
    };

    setCommentText('');
    await onUpdateTask(
      task.id,
      {
        status: nextStatus,
        comments: [newComment, ...task.comments].slice(0, 10),
        history: [historyEntry, ...task.history].slice(0, 10),
      },
      decision === 'approve'
        ? `Task approved & COMPLETED by ${currentUserName}`
        : `Revision requested on ${task.title}`,
      {
        title:
          decision === 'approve'
            ? `Task Approved: ${task.title}`
            : `Revision Requested: ${task.title}`,
        message: feedbackNote.slice(0, 200),
        recipient: primaryAssignee,
        category: 'feedback',
      }
    );
  };

  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim() || isLocked) return;
    const newComment: TaskComment = {
      id: `c-${Date.now()}`,
      authorName: currentUserName,
      authorRole: currentRole,
      text: commentText.trim().slice(0, 500),
      type: canSupervise ? 'supervisor_feedback' : 'comment',
      createdAt: formatTimestamp(),
    };
    const historyEntry: TaskHistoryEntry = {
      id: `h-${Date.now()}`,
      action: `${canSupervise ? 'Supervisor feedback' : 'Comment'} posted by ${currentUserName}`,
      actorName: currentUserName,
      timestamp: formatTimestamp(),
    };
    setCommentText('');
    await onUpdateTask(
      task.id,
      {
        comments: [newComment, ...task.comments].slice(0, 10),
        history: [historyEntry, ...task.history].slice(0, 10),
      },
      `Feedback posted by ${currentUserName}`,
      {
        title: `New feedback on "${task.title}"`,
        message: `${currentUserName}: "${newComment.text.slice(0, 120)}"`,
        recipient: primaryAssignee,
        category: 'feedback',
      }
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-[1px]">
      <div className="relative w-full max-w-2xl bg-white h-full shadow-2xl border-l border-slate-200 flex flex-col overflow-hidden">
        {/* Top Header */}
        <div className="px-6 py-5 border-b border-slate-200 flex items-start justify-between gap-4 bg-white">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span
                className={`px-2.5 py-0.5 rounded-full text-xs font-semibold tracking-wide ${getStatusBadgeStyle(
                  task.status
                )}`}
              >
                {task.status}
              </span>
              <span className="text-xs text-slate-500">
                {task.department} · Priority: {task.priority} · Due {task.deadline}
              </span>
            </div>
            <h2 className="text-lg font-display font-bold text-slate-900 leading-snug">
              {task.title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            aria-label="Close task details"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Simplified People & Status Bar (Assignees + Reviewer, no separate Owner) */}
        <div className="px-6 py-3.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-4 text-xs">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-slate-500">Assignees:</span>
              {task.assignees.map((person, idx) => (
                <React.Fragment key={person}>
                  <button
                    type="button"
                    onClick={() => onSelectEmployeeByName(person)}
                    className="font-semibold text-slate-800 hover:text-blue-600 underline-offset-2 hover:underline"
                  >
                    {person}
                  </button>
                  {idx < task.assignees.length - 1 && <span className="text-slate-400">,</span>}
                </React.Fragment>
              ))}
            </div>
            <span className="text-slate-300">·</span>
            <div>
              <span className="text-slate-500 mr-1.5">Reviewer:</span>
              <button
                type="button"
                onClick={() => onSelectEmployeeByName(task.reviewer)}
                className="font-semibold text-slate-800 hover:text-blue-600 underline-offset-2 hover:underline"
              >
                {task.reviewer}
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <label htmlFor="task-status-select" className="text-slate-500 font-medium">
              Update Status:
            </label>
            <select
              id="task-status-select"
              disabled={isLocked}
              value={task.status}
              onChange={(e) => handleStatusChange(e.target.value as TaskStatus)}
              className="bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900 disabled:opacity-50"
            >
              {STATUS_OPTIONS.map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Quick Workflow Action Buttons */}
        {!isLocked && (
          <div className="px-6 py-3 bg-white border-b border-slate-100 flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              {task.status === 'PENDING CONFIRMATION' && canSupervise && (
                <button
                  type="button"
                  onClick={() => handleStatusChange('ASSIGNED')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 transition-colors"
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Confirm & Assign</span>
                </button>
              )}
              {task.status === 'PENDING CONFIRMATION' && !canSupervise && (
                <span className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-3 py-1 font-medium">
                  Awaiting confirmation by a Team Lead / Supervisor
                </span>
              )}
              {(task.status === 'ASSIGNED' || task.status === 'BACKLOG') && (
                <button
                  type="button"
                  onClick={() => handleStatusChange('IN PROGRESS')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-800 text-xs font-semibold hover:bg-slate-50 transition-colors"
                >
                  <span>Start Work</span>
                </button>
              )}
              {(task.status === 'ASSIGNED' || task.status === 'IN PROGRESS') && (
                <button
                  type="button"
                  onClick={() => setActiveTab('deliverables')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 transition-colors"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Submit / Upload Work</span>
                </button>
              )}
              {(task.status === 'SUBMITTED' || task.status === 'UNDER REVIEW') && canSupervise && (
                <>
                  <button
                    type="button"
                    onClick={() => handleSupervisorDecision('revision')}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-800 text-xs font-semibold hover:bg-slate-50 transition-colors"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Request Revision</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSupervisorDecision('approve')}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 transition-colors"
                  >
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>Approve</span>
                  </button>
                </>
              )}
            </div>
            <span className="text-[11px] text-slate-400 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" />
              Audit log preserved for organisational memory
            </span>
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="px-6 border-b border-slate-200 flex items-center gap-6 bg-white overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('overview')}
            className={`py-3 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'overview'
                ? 'border-slate-900 text-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Subtasks & Brief ({completedSubtasks}/{totalSubtasks})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('deliverables')}
            className={`py-3 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'deliverables'
                ? 'border-slate-900 text-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Files & Deliverables ({task.deliverables.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('feedback')}
            className={`py-3 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'feedback'
                ? 'border-slate-900 text-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Supervisor Feedback ({task.comments.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`py-3 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'history'
                ? 'border-slate-900 text-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Task History ({task.history.length})
          </button>
        </div>

        {/* Tab Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {activeTab === 'overview' && (
            <>
              <div className="space-y-2">
                <h3 className="text-xs font-semibold text-slate-500">
                  Task Description & Instructions
                </h3>
                <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line bg-slate-50 p-4 rounded-xl border border-slate-200/80">
                  {task.description || 'No additional instructions provided.'}
                </p>
              </div>

              <div className="space-y-2">
                <h3 className="text-xs font-semibold text-slate-500">Assigned Team Members</h3>
                <div className="flex flex-wrap gap-2">
                  {task.assignees.map((person) => (
                    <button
                      key={person}
                      type="button"
                      onClick={() => onSelectEmployeeByName(person)}
                      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-medium text-slate-800 transition-colors"
                    >
                      <Avatar name={person} size="xs" />
                      <span>{person}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Quick Task Files & Attachments Section */}
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <h3 className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                      <Paperclip className="w-3.5 h-3.5 text-slate-600" />
                      Task Files & Deliverable Attachments ({task.deliverables.length})
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      Attach documents, PDFs, spreadsheets, or images directly to this task
                    </p>
                  </div>
                  {!isLocked && (
                    <div>
                      <input
                        ref={quickFileInputRef}
                        type="file"
                        onChange={handleQuickFileAttach}
                        className="hidden"
                      />
                      <button
                        type="button"
                        disabled={isSubmitting}
                        onClick={() => quickFileInputRef.current?.click()}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 transition-colors"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        <span>{isSubmitting ? 'Uploading...' : 'Upload File'}</span>
                      </button>
                    </div>
                  )}
                </div>

                {task.deliverables.length > 0 && (
                  <div className="space-y-1.5 pt-1">
                    {task.deliverables.slice(0, 3).map((del) => (
                      <div
                        key={del.id}
                        className="px-3 py-2 rounded-lg bg-white border border-slate-200 flex items-center justify-between gap-3 text-xs"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="px-1.5 py-0.5 text-[10px] font-mono-tabular font-semibold bg-slate-900 text-white rounded shrink-0">
                            {del.version}
                          </span>
                          <span className="font-medium text-slate-800 truncate">
                            {del.fileName}
                          </span>
                          <span className="text-slate-400 font-mono-tabular shrink-0">
                            ({del.fileSize})
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            downloadOrOpenFile(
                              del.fileName,
                              del.fileUrl,
                              `Task: ${task.title}\nVersion: ${del.version}\nSubmitted By: ${del.submittedBy}\nNotes: ${del.notes}`
                            )
                          }
                          className="inline-flex items-center gap-1 text-blue-600 hover:underline font-medium shrink-0"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Download</span>
                        </button>
                      </div>
                    ))}
                    {task.deliverables.length > 3 && (
                      <button
                        type="button"
                        onClick={() => setActiveTab('deliverables')}
                        className="text-xs font-semibold text-blue-600 hover:underline"
                      >
                        View all {task.deliverables.length} files →
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Subtasks Checklist */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold text-slate-500">Subtask Checklist</h3>
                  <span className="text-xs font-mono-tabular text-slate-600">
                    {completedSubtasks} of {totalSubtasks} completed
                  </span>
                </div>

                {totalSubtasks > 0 && (
                  <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-slate-900 transition-all duration-200"
                      style={{
                        width: `${Math.round(
                          (completedSubtasks / Math.max(1, totalSubtasks)) * 100
                        )}%`,
                      }}
                    />
                  </div>
                )}

                <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden bg-white">
                  {task.subtasks.length === 0 ? (
                    <p className="p-4 text-xs text-slate-400 text-center">
                      No subtasks added yet. Add a checklist item below.
                    </p>
                  ) : (
                    task.subtasks.map((st) => (
                      <button
                        key={st.id}
                        type="button"
                        disabled={isLocked}
                        onClick={() => handleToggleSubtask(st.id)}
                        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 transition-colors disabled:opacity-60"
                      >
                        {st.completed ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        ) : (
                          <Circle className="w-4 h-4 text-slate-400 shrink-0" />
                        )}
                        <span
                          className={`text-sm ${
                            st.completed ? 'line-through text-slate-400' : 'text-slate-800'
                          }`}
                        >
                          {st.title}
                        </span>
                      </button>
                    ))
                  )}
                </div>

                {!isLocked && task.subtasks.length < 10 && (
                  <form onSubmit={handleAddSubtask} className="flex gap-2">
                    <input
                      type="text"
                      value={newSubtaskTitle}
                      onChange={(e) => setNewSubtaskTitle(e.target.value)}
                      placeholder="Add a subtask milestone..."
                      className="flex-1 px-3.5 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                    />
                    <button
                      type="submit"
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 text-white text-xs font-medium rounded-lg hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add Subtask
                    </button>
                  </form>
                )}
              </div>
            </>
          )}

          {activeTab === 'deliverables' && (
            <div className="space-y-6">
              {/* Upload Deliverable Form */}
              {!isLocked && (
                <form
                  onSubmit={handleUploadDeliverable}
                  className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-3.5"
                >
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                      <Upload className="w-4 h-4 text-slate-600" />
                      Upload Task File / Deliverable (Version v{task.deliverables.length + 1})
                    </h3>
                    <span className="text-[11px] text-slate-500">
                      Automatically sets status to UNDER REVIEW
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 mb-1">
                        Choose File from Computer / Device
                      </label>
                      <input
                        ref={fileInputRef}
                        type="file"
                        onChange={handleFileInputChange}
                        className="w-full text-xs text-slate-600 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-slate-900 file:text-white hover:file:bg-slate-800"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 mb-1">
                        File / Document Name *
                      </label>
                      <input
                        type="text"
                        required
                        value={uploadFileName}
                        onChange={(e) => setUploadFileName(e.target.value)}
                        placeholder="e.g., September_Report_v2.pdf"
                        className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">
                      External Cloud Link / Drive URL (Optional — or leave auto-attached file)
                    </label>
                    <input
                      type="text"
                      value={uploadFileUrl.startsWith('data:') ? '' : uploadFileUrl}
                      onChange={(e) => setUploadFileUrl(e.target.value)}
                      placeholder={
                        uploadFileUrl.startsWith('data:')
                          ? 'Local file attached and ready for download'
                          : 'https://drive.google.com/...'
                      }
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">
                      Submission Notes for Reviewer ({task.reviewer})
                    </label>
                    <textarea
                      rows={2}
                      value={uploadNotes}
                      onChange={(e) => setUploadNotes(e.target.value)}
                      placeholder="Summarize what was completed or updated in this version..."
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                    />
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 text-white text-xs font-medium rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-50"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      Submit File (v{task.deliverables.length + 1})
                    </button>
                  </div>
                </form>
              )}

              {/* Version History List */}
              <div className="space-y-3">
                <h3 className="text-xs font-semibold text-slate-500">
                  Uploaded Files & Deliverable Versions ({task.deliverables.length})
                </h3>
                {task.deliverables.length === 0 ? (
                  <div className="p-8 text-center border border-dashed border-slate-200 rounded-xl">
                    <FileText className="w-6 h-6 text-slate-400 mx-auto mb-2" />
                    <p className="text-xs font-medium text-slate-700">
                      No files or deliverables uploaded yet
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Choose a file from your device above to attach it to this task.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {task.deliverables.map((del) => (
                      <div
                        key={del.id}
                        className="p-4 rounded-xl border border-slate-200 bg-white flex items-start justify-between gap-4"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="px-2 py-0.5 text-[11px] font-mono-tabular font-semibold bg-slate-900 text-white rounded">
                              {del.version}
                            </span>
                            <span className="text-sm font-semibold text-slate-900">
                              {del.fileName}
                            </span>
                            <span className="text-xs text-slate-400 font-mono-tabular">
                              · {del.fileSize}
                            </span>
                          </div>
                          <p className="text-xs text-slate-600">{del.notes}</p>
                          <p className="text-[11px] text-slate-400">
                            Uploaded by {del.submittedBy} · {del.submittedAt}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            downloadOrOpenFile(
                              del.fileName,
                              del.fileUrl,
                              `Task: ${task.title}\nVersion: ${del.version}\nSubmitted By: ${del.submittedBy}\nNotes: ${del.notes}`
                            )
                          }
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-600 hover:bg-blue-50 border border-blue-200 rounded-lg transition-colors shrink-0"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Download / Open</span>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'feedback' && (
            <div className="space-y-6">
              {/* Supervisor Review Action Box */}
              {!isLocked && (
                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                      <MessageSquare className="w-4 h-4 text-slate-600" />
                      {canSupervise
                        ? 'Supervisor Review & Feedback Controls'
                        : 'Add Task Comment or Update for Reviewer'}
                    </span>
                    <span className="text-[11px] text-slate-500">
                      Posting as {currentUserName} ({currentRole})
                    </span>
                  </div>

                  <form onSubmit={handlePostComment} className="space-y-3">
                    <textarea
                      rows={3}
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      placeholder={
                        canSupervise
                          ? 'Write review feedback, approval notes, or specific revision requests...'
                          : 'Add a progress update or question for your supervisor...'
                      }
                      className="w-full px-3.5 py-2.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                    />
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      {canSupervise ? (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleSupervisorDecision('approve')}
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 text-white text-xs font-semibold rounded-lg hover:bg-emerald-700 transition-colors"
                          >
                            <ShieldCheck className="w-3.5 h-3.5" />
                            Approve & Mark Completed
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSupervisorDecision('revision')}
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-amber-600 text-white text-xs font-semibold rounded-lg hover:bg-amber-700 transition-colors"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            Request Revision
                          </button>
                        </div>
                      ) : (
                        <span className="text-[11px] text-slate-500">
                          Supervisor or Top Management access is required to approve or request
                          revisions.
                        </span>
                      )}

                      <button
                        type="submit"
                        className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 text-white text-xs font-medium rounded-lg hover:bg-slate-800 transition-colors"
                      >
                        <Send className="w-3.5 h-3.5" />
                        Post Comment
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* Comments & Feedback Feed */}
              <div className="space-y-3">
                <h3 className="text-xs font-semibold text-slate-500">
                  Feedback & Discussion Thread ({task.comments.length})
                </h3>
                {task.comments.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-6 border border-dashed border-slate-200 rounded-xl">
                    No comments or supervisor feedback recorded on this task yet.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {task.comments.map((c) => (
                      <div
                        key={c.id}
                        className="p-4 rounded-xl border border-slate-200 bg-white space-y-1.5"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Avatar name={c.authorName} size="xs" />
                            <span className="text-xs font-semibold text-slate-900">
                              {c.authorName}
                            </span>
                            <span className="text-[11px] text-slate-500">· {c.authorRole}</span>
                          </div>
                          <span className="text-[11px] text-slate-400 font-mono-tabular">
                            {c.createdAt}
                          </span>
                        </div>
                        <p className="text-xs text-slate-700 leading-relaxed pl-8">{c.text}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'history' && (
            <div className="space-y-4">
              <h3 className="text-xs font-semibold text-slate-500 flex items-center gap-1.5">
                <History className="w-4 h-4 text-slate-400" />
                Audit Log & Status History
              </h3>
              <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl bg-white">
                {task.history.map((item) => (
                  <div key={item.id} className="px-4 py-3 flex items-start justify-between gap-4">
                    <div className="space-y-0.5">
                      <p className="text-xs font-medium text-slate-800">{item.action}</p>
                      <p className="text-[11px] text-slate-500">By {item.actorName}</p>
                    </div>
                    <span className="text-[11px] text-slate-400 font-mono-tabular shrink-0 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {item.timestamp}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
