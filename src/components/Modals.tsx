import React, { useEffect, useRef, useState } from 'react';
import {
  Award,
  Briefcase,
  Building2,
  Calendar,
  Camera,
  Download,
  ExternalLink,
  Mail,
  Mic,
  Paperclip,
  Phone,
  RefreshCw,
  Square,
  Star,
  Upload,
  UserCheck,
  Video,
  X,
} from 'lucide-react';
import {
  AnnouncementRecord,
  DeliverableVersion,
  DepartmentRecord,
  EmployeeDocument,
  EmployeeRecord,
  InstructionRecord,
  MeetingRecord,
  PerformanceReviewItem,
  RolePerspective,
  TASK_CATEGORIES,
  TASK_SOURCES,
  TaskPriority,
  TaskRecord,
  TaskStatus,
} from '../types';
import { Avatar } from './Avatar';
import { getStatusBadgeStyle } from './TaskDetailDrawer';
import {
  compressProfileImage,
  downloadOrOpenFile,
  generateGoogleMeetRoomCode,
  ProcessedFileUpload,
  processUploadedFile,
} from '../utils/fileUpload';

/* ============================================================================
 * 1. CREATE TASK MODAL (Simplified to Assignees + File Upload Support)
 * ========================================================================== */
interface CreateTaskModalProps {
  isOpen: boolean;
  employees: EmployeeRecord[];
  departments: string[];
  currentUserName: string;
  initialValues?: Partial<{
    title: string;
    description: string;
    department: string;
    assignee: string;
    taskSource: string;
  }>;
  onClose: () => void;
  onCreateTask: (
    newTask: Omit<TaskRecord, 'id' | 'workspaceOwnerId' | 'createdAt' | 'updatedAt'>
  ) => Promise<void>;
}

export const CreateTaskModal: React.FC<CreateTaskModalProps> = ({
  isOpen,
  employees,
  departments,
  currentUserName,
  initialValues,
  onClose,
  onCreateTask,
}) => {
  const defaultPerson = employees[0]?.fullName || currentUserName;
  const [title, setTitle] = useState(initialValues?.title || '');
  const [description, setDescription] = useState(initialValues?.description || '');
  const [taskSource, setTaskSource] = useState<string>(
    initialValues?.taskSource || TASK_SOURCES[0]
  );
  const [taskCategory, setTaskCategory] = useState<string>(TASK_CATEGORIES[0]);
  const [constraints, setConstraints] = useState('');
  const [initialStatus, setInitialStatus] = useState<TaskStatus>('ASSIGNED');
  const [department, setDepartment] = useState(
    initialValues?.department || departments[0] || 'Programmes'
  );
  const [selectedAssignees, setSelectedAssignees] = useState<string[]>(
    initialValues?.assignee ? [initialValues.assignee] : [defaultPerson]
  );
  const [reviewer, setReviewer] = useState(currentUserName);
  const [priority, setPriority] = useState<TaskPriority>('High');
  const [deadlineIso, setDeadlineIso] = useState(
    new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)
  );
  const [subtaskText, setSubtaskText] = useState('');
  const [subtasks, setSubtasks] = useState<string[]>([]);
  const [attachedFiles, setAttachedFiles] = useState<ProcessedFileUpload[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      const fallbackAssignee = employees[0]?.fullName || currentUserName;
      setTitle(initialValues?.title || '');
      setDescription(initialValues?.description || '');
      setDepartment(initialValues?.department || departments[0] || 'Programmes');
      setSelectedAssignees(
        initialValues?.assignee ? [initialValues.assignee] : [fallbackAssignee]
      );
      setTaskSource(initialValues?.taskSource || TASK_SOURCES[0]);
      setInitialStatus('ASSIGNED');
      setReviewer(currentUserName);
      setAttachedFiles([]);
    }
  }, [isOpen, initialValues, employees, departments, currentUserName]);

  if (!isOpen) return null;

  const toggleAssignee = (name: string) => {
    setSelectedAssignees((prev) =>
      prev.includes(name)
        ? prev.length > 1
          ? prev.filter((n) => n !== name)
          : prev
        : [...prev, name].slice(0, 5)
    );
  };

  const handleAddSubtask = () => {
    if (!subtaskText.trim() || subtasks.length >= 10) return;
    setSubtasks((prev) => [...prev, subtaskText.trim()]);
    setSubtaskText('');
  };

  const handleAttachTaskFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;
    const processedList: ProcessedFileUpload[] = [];
    for (let i = 0; i < fileList.length && attachedFiles.length + i < 5; i++) {
      const processed = await processUploadedFile(fileList[i]);
      processedList.push(processed);
    }
    setAttachedFiles((prev) => [...prev, ...processedList].slice(0, 5));
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setSubmitting(true);
    try {
      const formattedDeadline = new Date(deadlineIso + 'T12:00:00').toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
      const nowDisplay = new Date().toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });

      const finalAssignees =
        selectedAssignees.length > 0 ? selectedAssignees : [currentUserName];

      const baseDesc =
        description.trim() || 'Complete assigned deliverables and submit for review.';
      const metaPrefix = `[Source: ${taskSource} · Category: ${taskCategory}]`;
      const constraintsSuffix = constraints.trim()
        ? `\n\nConstraints: ${constraints.trim()}`
        : '';
      const fullDescription = `${metaPrefix}\n${baseDesc}${constraintsSuffix}`.slice(0, 2000);

      const initialDeliverables: DeliverableVersion[] = attachedFiles.map((f, idx) => ({
        id: `del-init-${Date.now()}-${idx}`,
        version: `v${idx + 1}`,
        fileName: f.fileName.slice(0, 120),
        fileSize: f.fileSize,
        fileUrl: f.fileUrl,
        notes: 'Attached task brief / reference document during task creation.',
        submittedBy: currentUserName,
        submittedAt: nowDisplay,
      }));

      await onCreateTask({
        title: title.trim().slice(0, 200),
        description: fullDescription,
        status: initialStatus,
        priority,
        department,
        assignees: finalAssignees,
        reviewer: reviewer || currentUserName,
        owner: finalAssignees[0],
        deadline: formattedDeadline,
        deadlineIso,
        subtasks: subtasks.map((st, idx) => ({
          id: `st-${Date.now()}-${idx}`,
          title: st.slice(0, 140),
          completed: false,
        })),
        deliverables: initialDeliverables,
        comments: [],
        history: [
          {
            id: `h-${Date.now()}`,
            action: `Task created (${initialStatus}, ${taskSource}) and assigned to ${finalAssignees.join(', ')}${
              initialDeliverables.length > 0
                ? ` with ${initialDeliverables.length} attached file(s)`
                : ''
            }`,
            actorName: currentUserName,
            timestamp: nowDisplay,
          },
        ],
      });
      setTitle('');
      setDescription('');
      setConstraints('');
      setSubtasks([]);
      setAttachedFiles([]);
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-[1px] p-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xl w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="text-base font-display font-bold text-slate-900">
              Create & Assign New Task
            </h2>
            <p className="text-xs text-slate-500">
              Assign team members, attach reference files, and set deadlines
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Task Title *</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Prepare the September partnership activity report"
              className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Task Source</label>
              <select
                value={taskSource}
                onChange={(e) => {
                  setTaskSource(e.target.value);
                  if (e.target.value === 'Verbal/in-person instruction') {
                    setInitialStatus('PENDING CONFIRMATION');
                  }
                }}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
              >
                {TASK_SOURCES.map((src) => (
                  <option key={src} value={src}>
                    {src}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Category</label>
              <select
                value={taskCategory}
                onChange={(e) => setTaskCategory(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
              >
                {TASK_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Initial Status
              </label>
              <select
                value={initialStatus}
                onChange={(e) => setInitialStatus(e.target.value as TaskStatus)}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
              >
                <option value="ASSIGNED">ASSIGNED</option>
                <option value="PENDING CONFIRMATION">PENDING CONFIRMATION</option>
                <option value="BACKLOG">BACKLOG</option>
                <option value="IN PROGRESS">IN PROGRESS</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Department</label>
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
              <label className="block text-xs font-semibold text-slate-700 mb-1">Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as TaskPriority)}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
              >
                {(['Low', 'Medium', 'High', 'Critical'] as TaskPriority[]).map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Deadline *</label>
              <input
                type="date"
                required
                value={deadlineIso}
                onChange={(e) => setDeadlineIso(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>
          </div>

          {/* Simplified Assignees + Reviewer (No redundant Primary Owner column) */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-start">
            <div className="sm:col-span-8">
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Assignees (Select one or more employees) *
              </label>
              <div className="flex flex-wrap gap-1.5">
                {employees.map((emp) => {
                  const selected = selectedAssignees.includes(emp.fullName);
                  return (
                    <button
                      key={emp.id}
                      type="button"
                      onClick={() => toggleAssignee(emp.fullName)}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
                        selected
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <Avatar name={emp.fullName} src={emp.avatarUrl} color={emp.avatarColor} size="xs" />
                      <span>{emp.fullName}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="sm:col-span-4">
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Supervisor / Reviewer
              </label>
              <select
                value={reviewer}
                onChange={(e) => setReviewer(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
              >
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.fullName}>
                    {emp.fullName} ({emp.role})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Instructions & Scope
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe deliverables, formatting guidelines, or review criteria..."
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Additional Constraints (Optional)
            </label>
            <input
              type="text"
              value={constraints}
              onChange={(e) => setConstraints(e.target.value)}
              placeholder="Include activities, partner interactions, and outcomes..."
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
          </div>

          {/* Task File Upload (Reference Briefs, Templates, Supporting Docs) */}
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                <Paperclip className="w-3.5 h-3.5 text-slate-600" />
                Attach Reference Files / Brief Documents (Optional)
              </label>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                onChange={handleAttachTaskFiles}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-xs font-semibold text-slate-800 transition-colors"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Choose Files</span>
              </button>
            </div>

            {attachedFiles.length > 0 && (
              <div className="space-y-1.5">
                {attachedFiles.map((f, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                  >
                    <span className="font-medium text-slate-800 truncate">
                      {f.fileName}{' '}
                      <span className="text-slate-400 font-mono-tabular">({f.fileSize})</span>
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setAttachedFiles((prev) => prev.filter((_, i) => i !== idx))
                      }
                      className="text-slate-400 hover:text-rose-600 ml-2"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Subtask Checklist
            </label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={subtaskText}
                onChange={(e) => setSubtaskText(e.target.value)}
                placeholder="Add subtask item..."
                className="flex-1 px-3 py-1.5 text-xs border border-slate-200 rounded-lg"
              />
              <button
                type="button"
                onClick={handleAddSubtask}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-medium rounded-lg"
              >
                Add
              </button>
            </div>
            <div className="space-y-1">
              {subtasks.map((st, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between px-3 py-1.5 bg-slate-50 rounded-lg text-xs text-slate-700"
                >
                  <span>
                    {idx + 1}. {st}
                  </span>
                  <button
                    type="button"
                    onClick={() => setSubtasks((prev) => prev.filter((_, i) => i !== idx))}
                    className="text-slate-400 hover:text-rose-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-2 flex justify-end gap-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg disabled:opacity-50"
            >
              {submitting ? 'Creating...' : '+ Create Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

/* ============================================================================
 * 2. RECORD AN INSTRUCTION MODAL (Voice + Text Queue)
 * ========================================================================== */
interface RecordInstructionModalProps {
  isOpen: boolean;
  employees: EmployeeRecord[];
  departments: string[];
  currentUserName: string;
  onClose: () => void;
  onSaveInstruction: (
    inst: Omit<InstructionRecord, 'id' | 'workspaceOwnerId' | 'createdAt' | 'updatedAt'>
  ) => Promise<void>;
}

export const RecordInstructionModal: React.FC<RecordInstructionModalProps> = ({
  isOpen,
  employees,
  departments,
  currentUserName,
  onClose,
  onSaveInstruction,
}) => {
  const [title, setTitle] = useState('');
  const [department, setDepartment] = useState(departments[0] || 'Programmes');
  const [assignedTo, setAssignedTo] = useState(employees[0]?.fullName || currentUserName);
  const [notes, setNotes] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [durationSec, setDurationSec] = useState(0);
  const [audioDataUrl, setAudioDataUrl] = useState('');
  const [micStatusMessage, setMicStatusMessage] = useState('');
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  if (!isOpen) return null;

  const startRecording = async () => {
    setMicStatusMessage('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: BlobPart[] = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64 = typeof reader.result === 'string' ? reader.result : '';
          if (base64.length <= 450000) {
            setAudioDataUrl(base64);
          }
        };
        reader.readAsDataURL(blob);
        stream.getTracks().forEach((t) => t.stop());
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
      setDurationSec(0);
      timerRef.current = window.setInterval(() => {
        setDurationSec((s) => s + 1);
      }, 1000);
    } catch {
      setMicStatusMessage(
        'Recording timer active — add written notes below if microphone is unavailable.'
      );
      setIsRecording(true);
      setDurationSec(0);
      timerRef.current = window.setInterval(() => {
        setDurationSec((s) => s + 1);
      }, 1000);
    }
  };

  const stopRecording = () => {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    if (isRecording) stopRecording();

    await onSaveInstruction({
      title: title.trim().slice(0, 200),
      department,
      recordedBy: currentUserName,
      assignedTo: assignedTo || currentUserName,
      notes: notes.trim().slice(0, 1500) || 'Voice instruction recorded for confirmation.',
      durationSec: durationSec || 15,
      hasAudio: true,
      audioDataUrl,
      status: 'PENDING',
    });
    setTitle('');
    setNotes('');
    setDurationSec(0);
    setAudioDataUrl('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-[1px] p-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xl w-full max-w-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Mic className="w-4 h-4 text-slate-800" />
            <h2 className="text-base font-display font-bold text-slate-900">
              Record an Instruction
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col items-center text-center space-y-3">
            <div className="text-xs font-medium text-slate-600">
              {isRecording
                ? 'Recording voice instruction...'
                : durationSec > 0
                ? 'Voice clip captured and ready to attach'
                : 'Tap below to record a voice instruction for your team'}
            </div>

            <div className="text-2xl font-mono-tabular font-bold text-slate-900">
              {String(Math.floor(durationSec / 60)).padStart(2, '0')}:
              {String(durationSec % 60).padStart(2, '0')}
            </div>

            {!isRecording ? (
              <button
                type="button"
                onClick={startRecording}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 transition-colors"
              >
                <Mic className="w-3.5 h-3.5" />
                {durationSec > 0 ? 'Re-record Voice Note' : 'Start Voice Recording'}
              </button>
            ) : (
              <button
                type="button"
                onClick={stopRecording}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-rose-600 text-white text-xs font-semibold hover:bg-rose-700 transition-colors"
              >
                <Square className="w-3.5 h-3.5" />
                Stop Recording
              </button>
            )}

            {micStatusMessage && (
              <p className="text-[11px] text-amber-700">{micStatusMessage}</p>
            )}

            {audioDataUrl && <audio controls src={audioDataUrl} className="w-full h-8 mt-2" />}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Instruction Title *
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter instruction summary..."
              className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Department</label>
              <select
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white"
              >
                {departments.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Assign To</label>
              <select
                value={assignedTo}
                onChange={(e) => setAssignedTo(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white"
              >
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.fullName}>
                    {emp.fullName} ({emp.department})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Written Summary / Transcript Notes
            </label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Key deliverables mentioned in the instruction..."
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
          </div>

          <div className="pt-2 flex justify-end gap-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg"
            >
              Send to Pending Confirmation
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

/* ============================================================================
 * 3. EMPLOYEE FULL PROFILE & PUBLIC WORK PROFILE MODAL (with Photo & Doc Upload)
 * ========================================================================== */
interface EmployeeDetailModalProps {
  employee: EmployeeRecord | null;
  tasks: TaskRecord[];
  currentUserName: string;
  currentRole: RolePerspective;
  onClose: () => void;
  onSelectTask: (task: TaskRecord) => void;
  onUpdateEmployee: (empId: string, updates: Partial<EmployeeRecord>) => Promise<void>;
}

export const EmployeeDetailModal: React.FC<EmployeeDetailModalProps> = ({
  employee,
  tasks,
  currentUserName,
  currentRole,
  onClose,
  onSelectTask,
  onUpdateEmployee,
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'workload' | 'performance'>('overview');
  const [reviewPeriod, setReviewPeriod] = useState('Q4 2026');
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewSummary, setReviewSummary] = useState('');
  const [docCategory, setDocCategory] = useState('CV');
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [uploadingDoc, setUploadingDoc] = useState(false);

  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const docInputRef = useRef<HTMLInputElement | null>(null);

  if (!employee) return null;

  const employeeTasks = tasks.filter(
    (t) => t.assignees.includes(employee.fullName) || t.owner === employee.fullName
  );
  const completedCount = employeeTasks.filter((t) => t.status === 'COMPLETED').length;
  const activeCount = employeeTasks.filter(
    (t) =>
      t.status === 'IN PROGRESS' ||
      t.status === 'ASSIGNED' ||
      t.status === 'UNDER REVIEW' ||
      t.status === 'SUBMITTED'
  ).length;

  const canAddReview = currentRole === 'Supervisor' || currentRole === 'Top Management';

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPhoto(true);
    try {
      const compressedDataUrl = await compressProfileImage(file);
      await onUpdateEmployee(employee.id, { avatarUrl: compressedDataUrl });
    } finally {
      setUploadingPhoto(false);
      if (photoInputRef.current) photoInputRef.current.value = '';
    }
  };

  const handleDocUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || employee.documents.length >= 10) return;
    setUploadingDoc(true);
    try {
      const processed = await processUploadedFile(file);
      const newDoc: EmployeeDocument = {
        id: `doc-${Date.now()}`,
        fileName: processed.fileName.slice(0, 100),
        category: docCategory,
        fileSize: processed.fileSize,
        fileUrl: processed.fileUrl,
        uploadedAt: new Date().toLocaleDateString('en-GB', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        }),
      };
      await onUpdateEmployee(employee.id, {
        documents: [newDoc, ...employee.documents].slice(0, 10),
      });
    } finally {
      setUploadingDoc(false);
      if (docInputRef.current) docInputRef.current.value = '';
    }
  };

  const handleAddReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewSummary.trim()) return;
    const newRev: PerformanceReviewItem = {
      id: `rev-${Date.now()}`,
      period: reviewPeriod.trim().slice(0, 40),
      reviewerName: currentUserName,
      rating: reviewRating,
      summary: reviewSummary.trim().slice(0, 400),
      date: new Date().toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      }),
    };
    const nextReviews = [newRev, ...employee.performanceReviews].slice(0, 10);
    const nextScore = Math.min(100, Math.round((employee.performanceScore + reviewRating * 20) / 2));

    setReviewSummary('');
    await onUpdateEmployee(employee.id, {
      performanceReviews: nextReviews,
      performanceScore: nextScore,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-[1px] p-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header with Profile Picture Upload */}
        <div className="px-6 py-5 border-b border-slate-200 flex items-start justify-between gap-4 bg-slate-50/60">
          <div className="flex items-center gap-4">
            <div className="relative group">
              <Avatar
                name={employee.fullName}
                src={employee.avatarUrl}
                color={employee.avatarColor}
                size="lg"
              />
              <input
                ref={photoInputRef}
                type="file"
                accept="image/*"
                onChange={handlePhotoUpload}
                className="hidden"
              />
              <button
                type="button"
                disabled={uploadingPhoto}
                onClick={() => photoInputRef.current?.click()}
                title="Upload profile picture"
                className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-slate-900 text-white flex items-center justify-center shadow-sm hover:bg-slate-700 transition-colors"
              >
                <Camera className="w-3.5 h-3.5" />
              </button>
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-display font-bold text-slate-900">
                  {employee.fullName}
                </h2>
                <span className="text-xs font-mono-tabular text-slate-500">
                  · {employee.staffId}
                </span>
                <span className="text-xs text-slate-500">
                  · {employee.role} ({employee.accessLevel})
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-0.5">
                {employee.department}, {employee.desk} · Manager: {employee.managerName} · Status:{' '}
                <strong
                  className={
                    employee.onboardingStatus === 'ACTIVE'
                      ? 'text-emerald-700'
                      : 'text-amber-700'
                  }
                >
                  {employee.onboardingStatus}
                </strong>
              </p>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                {employee.badges.map((b) => (
                  <span
                    key={b}
                    className="px-2.5 py-0.5 bg-slate-100 text-slate-700 rounded-full text-[11px] font-medium"
                  >
                    {b}
                  </span>
                ))}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="px-6 border-b border-slate-200 flex items-center gap-6 bg-white">
          <button
            type="button"
            onClick={() => setActiveTab('overview')}
            className={`py-3 text-xs font-semibold border-b-2 transition-colors ${
              activeTab === 'overview'
                ? 'border-slate-900 text-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Personal & Employment Record
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('workload')}
            className={`py-3 text-xs font-semibold border-b-2 transition-colors ${
              activeTab === 'workload'
                ? 'border-slate-900 text-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Public Work Profile & Tasks ({employeeTasks.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('performance')}
            className={`py-3 text-xs font-semibold border-b-2 transition-colors ${
              activeTab === 'performance'
                ? 'border-slate-900 text-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Performance History ({employee.performanceScore}%)
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {activeTab === 'overview' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="p-4 rounded-xl border border-slate-200 space-y-3">
                <h3 className="text-xs font-semibold text-slate-500">Personal Information</h3>
                <div className="space-y-2.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 flex items-center gap-1.5">
                      <Mail className="w-3.5 h-3.5" /> Email
                    </span>
                    <span className="font-medium text-slate-900">{employee.email}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5" /> Phone
                    </span>
                    <span className="font-mono-tabular font-medium text-slate-900">
                      {employee.phone}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">National ID</span>
                    <span className="font-mono-tabular font-medium text-slate-900">
                      {employee.nationalId}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Location</span>
                    <span className="font-medium text-slate-900">{employee.location}</span>
                  </div>
                </div>
                <div className="pt-2 border-t border-slate-100">
                  <p className="text-xs text-slate-600 leading-relaxed">{employee.bio}</p>
                </div>
              </div>

              <div className="p-4 rounded-xl border border-slate-200 space-y-3">
                <h3 className="text-xs font-semibold text-slate-500">Employment Information</h3>
                <div className="space-y-2.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Staff ID</span>
                    <span className="font-mono-tabular font-semibold text-slate-900">
                      {employee.staffId}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5" /> Department & Desk
                    </span>
                    <span className="font-medium text-slate-900">
                      {employee.department}, {employee.desk}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 flex items-center gap-1.5">
                      <Briefcase className="w-3.5 h-3.5" /> Position
                    </span>
                    <span className="font-medium text-slate-900">{employee.role}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 flex items-center gap-1.5">
                      <UserCheck className="w-3.5 h-3.5" /> Reporting Manager
                    </span>
                    <span className="font-medium text-slate-900">{employee.managerName}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5" /> Date Joined
                    </span>
                    <span className="font-mono-tabular font-medium text-slate-900">
                      {employee.joinDate}
                    </span>
                  </div>
                </div>

                {/* HR Documents on File + Upload Control */}
                <div className="pt-3 border-t border-slate-100 space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="text-xs font-semibold text-slate-500">
                      HR Documents on File ({employee.documents.length})
                    </h4>
                    <div className="flex items-center gap-1.5">
                      <select
                        value={docCategory}
                        onChange={(e) => setDocCategory(e.target.value)}
                        className="px-2 py-1 text-[11px] bg-slate-50 border border-slate-200 rounded-lg"
                      >
                        <option value="CV">CV</option>
                        <option value="Contract">Contract</option>
                        <option value="Identification">ID</option>
                        <option value="Certificate">Certificate</option>
                      </select>
                      <input
                        ref={docInputRef}
                        type="file"
                        onChange={handleDocUpload}
                        className="hidden"
                      />
                      <button
                        type="button"
                        disabled={uploadingDoc}
                        onClick={() => docInputRef.current?.click()}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-900 text-white text-[11px] font-semibold hover:bg-slate-800"
                      >
                        <Upload className="w-3 h-3" />
                        <span>{uploadingDoc ? 'Uploading...' : 'Upload Doc'}</span>
                      </button>
                    </div>
                  </div>

                  {employee.documents.length === 0 ? (
                    <p className="text-xs text-slate-400">No documents uploaded yet.</p>
                  ) : (
                    employee.documents.map((doc) => (
                      <div
                        key={doc.id}
                        className="flex items-center justify-between text-xs py-1.5 border-b border-slate-50 last:border-0"
                      >
                        <span className="text-slate-800 font-medium truncate">
                          {doc.fileName}{' '}
                          <span className="text-slate-400 font-normal">
                            · {doc.category} ({doc.fileSize})
                          </span>
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            downloadOrOpenFile(
                              doc.fileName,
                              doc.fileUrl,
                              `ATDP HR Document\nEmployee: ${employee.fullName} (${employee.staffId})\nCategory: ${doc.category}\nUploaded: ${doc.uploadedAt}`
                            )
                          }
                          className="inline-flex items-center gap-1 text-blue-600 hover:underline font-medium shrink-0 ml-2"
                        >
                          <Download className="w-3 h-3" />
                          <span>Open</span>
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'workload' && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50">
                  <div className="text-xs text-slate-500">Active Workload</div>
                  <div className="text-xl font-display font-bold font-mono-tabular text-slate-900 mt-1">
                    {activeCount} tasks
                  </div>
                </div>
                <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50">
                  <div className="text-xs text-slate-500">Completed Tasks</div>
                  <div className="text-xl font-display font-bold font-mono-tabular text-emerald-700 mt-1">
                    {completedCount} tasks
                  </div>
                </div>
                <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50">
                  <div className="text-xs text-slate-500">On-Time Delivery</div>
                  <div className="text-xl font-display font-bold font-mono-tabular text-slate-900 mt-1">
                    {employee.onTimeRate}%
                  </div>
                </div>
              </div>

              <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100">
                {employeeTasks.length === 0 ? (
                  <p className="p-6 text-xs text-slate-400 text-center">
                    No tasks currently assigned to {employee.fullName}.
                  </p>
                ) : (
                  employeeTasks.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => {
                        onClose();
                        onSelectTask(t);
                      }}
                      className="w-full px-4 py-3 text-left hover:bg-slate-50 flex items-center justify-between gap-4 transition-colors"
                    >
                      <div>
                        <p className="text-xs font-semibold text-slate-900">{t.title}</p>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Reviewer: {t.reviewer} · {t.subtasks.filter((s) => s.completed).length} of{' '}
                          {t.subtasks.length} subtasks
                        </p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${getStatusBadgeStyle(
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
          )}

          {activeTab === 'performance' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl border border-slate-200 bg-white">
                  <span className="text-xs text-slate-500">Overall Performance Score</span>
                  <div className="text-2xl font-display font-bold font-mono-tabular text-slate-900 mt-1">
                    {employee.performanceScore}%
                  </div>
                </div>
                <div className="p-4 rounded-xl border border-slate-200 bg-white">
                  <span className="text-xs text-slate-500">On-Time Completion Rate</span>
                  <div className="text-2xl font-display font-bold font-mono-tabular text-emerald-700 mt-1">
                    {employee.onTimeRate}%
                  </div>
                </div>
                <div className="p-4 rounded-xl border border-slate-200 bg-white">
                  <span className="text-xs text-slate-500">Logged Evaluations</span>
                  <div className="text-2xl font-display font-bold font-mono-tabular text-slate-900 mt-1">
                    {employee.performanceReviews.length}
                  </div>
                </div>
              </div>

              {canAddReview && (
                <form
                  onSubmit={handleAddReview}
                  className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-3"
                >
                  <h4 className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                    <Award className="w-4 h-4 text-slate-700" />
                    Log Supervisor Performance Evaluation
                  </h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 mb-1">
                        Evaluation Period
                      </label>
                      <input
                        type="text"
                        value={reviewPeriod}
                        onChange={(e) => setReviewPeriod(e.target.value)}
                        className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 mb-1">
                        Rating (1 to 5 Stars)
                      </label>
                      <select
                        value={reviewRating}
                        onChange={(e) => setReviewRating(Number(e.target.value))}
                        className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg"
                      >
                        <option value={5}>5 — Outstanding Delivery</option>
                        <option value={4}>4 — Exceeds Expectations</option>
                        <option value={3}>3 — Meets Expectations</option>
                        <option value={2}>2 — Needs Improvement</option>
                      </select>
                    </div>
                  </div>
                  <textarea
                    rows={2}
                    required
                    value={reviewSummary}
                    onChange={(e) => setReviewSummary(e.target.value)}
                    placeholder="Summarize key achievements, task reliability, and growth areas..."
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg"
                  />
                  <div className="flex justify-end">
                    <button
                      type="submit"
                      className="px-3.5 py-1.5 bg-slate-900 text-white text-xs font-semibold rounded-lg hover:bg-slate-800"
                    >
                      Save Evaluation to Record
                    </button>
                  </div>
                </form>
              )}

              <div className="space-y-3">
                <h4 className="text-xs font-semibold text-slate-500">
                  Historical Supervisor Evaluations
                </h4>
                {employee.performanceReviews.length === 0 ? (
                  <p className="text-xs text-slate-400 py-4">
                    No performance evaluations logged yet.
                  </p>
                ) : (
                  employee.performanceReviews.map((rev) => (
                    <div
                      key={rev.id}
                      className="p-4 rounded-xl border border-slate-200 bg-white space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-900">
                          {rev.period} · Reviewed by {rev.reviewerName}
                        </span>
                        <div className="flex items-center gap-1 text-amber-500">
                          {Array.from({ length: rev.rating }).map((_, i) => (
                            <Star key={i} className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                          ))}
                          <span className="text-[11px] text-slate-400 font-mono-tabular ml-2">
                            {rev.date}
                          </span>
                        </div>
                      </div>
                      <p className="text-xs text-slate-600 leading-relaxed">{rev.summary}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

/* ============================================================================
 * 4. SCHEDULE MEETING MODAL (with Automatic Google Meet Link Generation)
 * ========================================================================== */
interface ScheduleMeetingModalProps {
  isOpen: boolean;
  departments: string[];
  employees: EmployeeRecord[];
  currentUserName: string;
  onClose: () => void;
  onSchedule: (m: Omit<MeetingRecord, 'id' | 'workspaceOwnerId' | 'createdAt'>) => Promise<void>;
}

export const ScheduleMeetingModal: React.FC<ScheduleMeetingModalProps> = ({
  isOpen,
  departments,
  employees,
  currentUserName,
  onClose,
  onSchedule,
}) => {
  const [title, setTitle] = useState('');
  const [department, setDepartment] = useState(departments[0] || 'Programmes');
  const [date, setDate] = useState(
    new Date(Date.now() + 2 * 86400000).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
  );
  const [time, setTime] = useState('10:00 AM – 11:00 AM');
  const [meetingFormat, setMeetingFormat] = useState<'virtual' | 'in_person' | 'hybrid'>('virtual');
  const [meetLink, setMeetLink] = useState(() => generateGoogleMeetRoomCode());
  const [roomLocation, setRoomLocation] = useState('Accra HQ Conference Room A');
  const [agenda, setAgenda] = useState('');
  const [selectedAttendees, setSelectedAttendees] = useState<string[]>([]);

  useEffect(() => {
    if (isOpen) {
      setDepartment(departments[0] || 'Programmes');
      setMeetingFormat('virtual');
      setMeetLink(generateGoogleMeetRoomCode());
      setSelectedAttendees(
        employees.length > 0
          ? employees.slice(0, 5).map((e) => e.fullName)
          : [currentUserName]
      );
    }
  }, [isOpen, departments, employees, currentUserName]);

  if (!isOpen) return null;

  const handleFormatChange = (fmt: 'virtual' | 'in_person' | 'hybrid') => {
    setMeetingFormat(fmt);
    if ((fmt === 'virtual' || fmt === 'hybrid') && !meetLink.includes('meet.google.com')) {
      setMeetLink(generateGoogleMeetRoomCode());
    }
  };

  const toggleAttendee = (name: string) => {
    setSelectedAttendees((prev) =>
      prev.includes(name)
        ? prev.length > 1
          ? prev.filter((n) => n !== name)
          : prev
        : [...prev, name].slice(0, 10)
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const finalLocationOrLink =
      meetingFormat === 'virtual'
        ? meetLink.trim() || generateGoogleMeetRoomCode()
        : meetingFormat === 'hybrid'
        ? `${roomLocation.trim()} · ${meetLink.trim() || generateGoogleMeetRoomCode()}`
        : roomLocation.trim() || 'Accra HQ Conference Room';

    await onSchedule({
      title: title.trim().slice(0, 160),
      department,
      organizer: currentUserName,
      date: date.trim().slice(0, 40),
      time: time.trim().slice(0, 40),
      locationOrLink: finalLocationOrLink.slice(0, 200),
      agenda:
        agenda.trim().slice(0, 1000) ||
        'Departmental status alignment and deliverable review.',
      attendees:
        selectedAttendees.length > 0
          ? selectedAttendees.slice(0, 10)
          : [currentUserName],
    });
    setTitle('');
    setAgenda('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-[1px] p-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="text-base font-display font-bold text-slate-900">Schedule Meeting</h2>
            <p className="text-xs text-slate-500">
              Coordinate virtual Google Meet sessions or in-person department syncs
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Meeting Title *
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Weekly Programme Deliverables Sync"
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
          </div>

          {/* Meeting Format Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Meeting Type & Location
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => handleFormatChange('virtual')}
                className={`py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${
                  meetingFormat === 'virtual'
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                <Video className="w-3.5 h-3.5" />
                <span>Virtual (Google Meet)</span>
              </button>
              <button
                type="button"
                onClick={() => handleFormatChange('hybrid')}
                className={`py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${
                  meetingFormat === 'hybrid'
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                <span>Hybrid (Room + Meet)</span>
              </button>
              <button
                type="button"
                onClick={() => handleFormatChange('in_person')}
                className={`py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${
                  meetingFormat === 'in_person'
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                <span>In-Person Room</span>
              </button>
            </div>
          </div>

          {/* Automatic Google Meet Link Box when Virtual or Hybrid */}
          {(meetingFormat === 'virtual' || meetingFormat === 'hybrid') && (
            <div className="p-3.5 rounded-xl bg-blue-50/70 border border-blue-200 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-blue-900 flex items-center gap-1.5">
                  <Video className="w-4 h-4 text-blue-600" />
                  Google Meet Link Auto-Created
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setMeetLink(generateGoogleMeetRoomCode())}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-700 hover:underline"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>New Code</span>
                  </button>
                  <span className="text-blue-300">·</span>
                  <a
                    href="https://meet.google.com/new"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-700 hover:underline"
                  >
                    <span>Open Instant Room</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
              <input
                type="text"
                value={meetLink}
                onChange={(e) => setMeetLink(e.target.value)}
                className="w-full px-3 py-1.5 text-xs font-mono-tabular bg-white border border-blue-200 rounded-lg text-blue-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>
          )}

          {(meetingFormat === 'in_person' || meetingFormat === 'hybrid') && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Physical Room / Office Location
              </label>
              <input
                type="text"
                value={roomLocation}
                onChange={(e) => setRoomLocation(e.target.value)}
                placeholder="e.g., Accra HQ Conference Room A"
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg"
              />
            </div>
          )}

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Department</label>
              <select
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white"
              >
                {departments.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Date</label>
              <input
                type="text"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Time Window</label>
              <input
                type="text"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg"
              />
            </div>
          </div>

          {employees.length > 0 && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Attendees ({selectedAttendees.length})
              </label>
              <div className="flex flex-wrap gap-1.5">
                {employees.map((emp) => {
                  const selected = selectedAttendees.includes(emp.fullName);
                  return (
                    <button
                      key={emp.id}
                      type="button"
                      onClick={() => toggleAttendee(emp.fullName)}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
                        selected
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <span>{emp.fullName}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Agenda & Action Items
            </label>
            <textarea
              rows={2}
              value={agenda}
              onChange={(e) => setAgenda(e.target.value)}
              placeholder="Key topics and tasks to review..."
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg"
            />
          </div>

          <div className="pt-2 flex justify-end gap-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg"
            >
              Schedule Meeting
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

/* ============================================================================
 * 5. CREATE ANNOUNCEMENT MODAL
 * ========================================================================== */
interface CreateAnnouncementModalProps {
  isOpen: boolean;
  departments: string[];
  currentUserName: string;
  currentRole: RolePerspective;
  onClose: () => void;
  onPublish: (a: Omit<AnnouncementRecord, 'id' | 'workspaceOwnerId' | 'createdAt'>) => Promise<void>;
}

export const CreateAnnouncementModal: React.FC<CreateAnnouncementModalProps> = ({
  isOpen,
  departments,
  currentUserName,
  currentRole,
  onClose,
  onPublish,
}) => {
  const [title, setTitle] = useState('');
  const [department, setDepartment] = useState('All Departments');
  const [priority, setPriority] = useState<'Normal' | 'Important' | 'Urgent'>('Important');
  const [body, setBody] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !body.trim()) return;
    await onPublish({
      title: title.trim().slice(0, 200),
      body: body.trim().slice(0, 2000),
      authorName: currentUserName,
      authorRole: currentRole,
      department,
      priority,
    });
    setTitle('');
    setBody('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-[1px] p-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xl w-full max-w-md overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-base font-display font-bold text-slate-900">Post Announcement</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-3.5">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Headline *</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Monthly Deliverable Submission Cutoff"
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Audience</label>
              <select
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white"
              >
                <option value="All Departments">All Departments</option>
                {departments.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as 'Normal' | 'Important' | 'Urgent')}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white"
              >
                <option value="Normal">Normal</option>
                <option value="Important">Important</option>
                <option value="Urgent">Urgent</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Announcement Message *
            </label>
            <textarea
              rows={4}
              required
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Write your announcement to staff..."
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg"
            />
          </div>
          <div className="pt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg"
            >
              Publish Announcement
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

/* ============================================================================
 * 6. CREATE DEPARTMENT MODAL
 * ========================================================================== */
interface CreateDepartmentModalProps {
  isOpen: boolean;
  employees: EmployeeRecord[];
  currentUserName: string;
  onClose: () => void;
  onCreateDepartment: (
    dept: Omit<DepartmentRecord, 'id' | 'workspaceOwnerId' | 'createdAt'>
  ) => Promise<void>;
}

export const CreateDepartmentModal: React.FC<CreateDepartmentModalProps> = ({
  isOpen,
  employees,
  currentUserName,
  onClose,
  onCreateDepartment,
}) => {
  const [name, setName] = useState('');
  const [headName, setHeadName] = useState(currentUserName || 'Unassigned');
  const [description, setDescription] = useState('');
  const [desksInput, setDesksInput] = useState('General Desk, Operations Desk');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const desks = desksInput
      .split(',')
      .map((d) => d.trim().slice(0, 60))
      .filter(Boolean)
      .slice(0, 10);

    await onCreateDepartment({
      name: name.trim().slice(0, 80),
      headName: headName.trim().slice(0, 120) || 'Unassigned',
      description:
        description.trim().slice(0, 500) ||
        `Oversees ${name.trim()} operations, deliverables, and departmental milestones across ATDP.`,
      desks: desks.length > 0 ? desks : ['General Desk'],
    });

    setName('');
    setDescription('');
    setDesksInput('General Desk, Operations Desk');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-[1px] p-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xl w-full max-w-md overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="text-base font-display font-bold text-slate-900">Create Department</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Add a new department and operating desks to the ATDP workspace
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-3.5">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Department Name *
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Research & Policy, Human Resources, IT & Digital"
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Department Head
            </label>
            <input
              type="text"
              list="atdp-dept-heads-list"
              value={headName}
              onChange={(e) => setHeadName(e.target.value)}
              placeholder="Select or type Department Head name"
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
            <datalist id="atdp-dept-heads-list">
              <option value="Unassigned" />
              {employees.map((e) => (
                <option key={e.id} value={e.fullName}>
                  {e.role} ({e.accessLevel})
                </option>
              ))}
            </datalist>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Operating Desks / Units (comma-separated)
            </label>
            <input
              type="text"
              value={desksInput}
              onChange={(e) => setDesksInput(e.target.value)}
              placeholder="e.g., Policy Desk, Data & Analytics Desk, Field Research Desk"
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Department Mandate & Description
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the core responsibilities and deliverables of this department..."
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg"
            >
              Create Department
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
