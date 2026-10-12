import { apiRequest } from "./client";
import type { Department } from "@/types";

export const departmentsApi = {
  async getDepartments(): Promise<Department[]> {
    const res = await apiRequest<Department[] | { items: Department[] }>("/departments");
    return Array.isArray(res) ? res : res.items || [];
  },

  async getDepartmentById(id: string): Promise<Department> {
    return apiRequest<Department>(`/departments/${id}`);
  },

  async createDepartment(payload: { name: string; description?: string }): Promise<Department> {
    return apiRequest<Department>("/departments", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async updateDepartment(id: string, payload: { name: string; description?: string }): Promise<Department> {
    return apiRequest<Department>(`/departments/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  },
};