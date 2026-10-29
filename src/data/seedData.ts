import { DepartmentRecord } from '../types';

/**
 * Initializes only standard ATDP department shells with zero demo tasks or demo staff.
 */
export function buildDefaultDepartments(workspaceOwnerId: string): Omit<DepartmentRecord, 'id'>[] {
  const now = new Date().toISOString();
  return [
    {
      workspaceOwnerId,
      name: 'Programmes',
      headName: 'Unassigned',
      description: 'Designs, executes, and evaluates ATDP fellowship tracks, leadership curricula, and global partnership desks.',
      desks: ['Global Desk', 'Monitoring & Evaluation Desk', 'Curriculum Desk'],
      createdAt: now,
    },
    {
      workspaceOwnerId,
      name: 'Outreach',
      headName: 'Unassigned',
      description: 'Manages external communications, media relations, monthly newsletters, and community engagement.',
      desks: ['Communications & Media Desk', 'Social & Digital Desk'],
      createdAt: now,
    },
    {
      workspaceOwnerId,
      name: 'Logistics',
      headName: 'Unassigned',
      description: 'Oversees conference staging, facility operations, asset audits, procurement, and transport coordination.',
      desks: ['Field Operations Desk', 'Asset Management Desk'],
      createdAt: now,
    },
    {
      workspaceOwnerId,
      name: 'Finance',
      headName: 'Unassigned',
      description: 'Directs budgeting, quarterly reconciliations, donor grant compliance, and statutory financial reporting.',
      desks: ['Grants & Treasury Desk', 'Audit & Compliance Desk'],
      createdAt: now,
    },
    {
      workspaceOwnerId,
      name: 'Executive',
      headName: 'Unassigned',
      description: 'Top management office overseeing organizational strategy, governance, and cross-departmental alignment.',
      desks: ['Leadership Office', 'Human Resources & Administration'],
      createdAt: now,
    },
  ];
}
