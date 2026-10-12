import type { User } from "./user";
import type { Department } from "./department";

export type GrievanceStatus = "pending" | "in_progress" | "resolved" | "rejected";

export interface GrievanceComment {
  id: string;
  grievanceId: string;
  userId: string;
  authorName: string;
  authorRole: string;
  text: string;
  isInternal: boolean;
  createdAt: string;
}

export interface Grievance {
  id: string;
  title: string;
  description: string;
  category?: string;
  status?: GrievanceStatus | string;
  latitude?: number;
  longitude?: number;
  images?: string[];
  citizenId?: string;
  departmentId?: string;
  districtId?: string;
  talukId?: string;
  citizenName?: string;
  departmentName?: string;
  districtName?: string;
  talukName?: string;
  address?: string;
  landmark?: string;
  assignedOfficerId?: string;
  assignedOfficerName?: string;
  upvotes?: number;
  citizen?: User;
  department?: Department;
  expand?: {
    citizen?: User;
    department?: Department;
  };
  createdAt?: string;
  created?: string;
  updatedAt?: string;
  updates?: GrievanceUpdate[];
  comments?: GrievanceComment[];
}

export interface GrievanceUpdate {
  id: string;
  grievanceId?: string;
  grievance?: string;
  status?: GrievanceStatus | string;
  note?: string;
  images?: string[];
  adminId?: string;
  userId?: string;
  authorName?: string;
  admin?: User;
  user?: User;
  expand?: {
    admin?: User;
    user?: User;
  };
  createdAt?: string;
  created?: string;
}

export interface CreateGrievancePayload {
  title: string;
  description: string;
  category: string;
  departmentId?: string;
  districtId?: string;
  talukId?: string;
  address?: string;
  landmark?: string;
  latitude?: number;
  longitude?: number;
  images?: File[];
}

export interface CreateUpdatePayload {
  grievanceId: string;
  status: GrievanceStatus | string;
  note: string;
  images?: string[];
}

export interface AssignOfficerPayload {
  officerId: string;
  note?: string;
}

export interface CreateCommentPayload {
  text: string;
  isInternal?: boolean;
}
