import { apiRequest } from "./client";
import type { User, UserRole } from "@/types";

export interface AdminStats {
  totalGrievances: number;
  resolvedGrievances: number;
  pendingGrievances: number;
  totalUsers: number;
  totalDepartments: number;
}

export const adminApi = {
  async getUsers(): Promise<User[]> {
    const res = await apiRequest<User[] | { items: User[] }>("/admin/users");
    return Array.isArray(res) ? res : res.items || [];
  },

  async updateUserRole(
    userId: string,
    role: UserRole,
    departmentId?: string
  ): Promise<User> {
    return apiRequest<User>(`/admin/users/${userId}/role`, {
      method: "PUT",
      body: JSON.stringify({ role, departmentId }),
    });
  },

  async getStats(): Promise<AdminStats> {
    return apiRequest<AdminStats>("/admin/stats");
  },
};
