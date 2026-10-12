import { apiRequest } from "./client";
import type { Grievance, GrievanceUpdate, GrievanceComment } from "@/types";

export const grievancesApi = {
  async getGrievances(params?: {
    category?: string;
    status?: string;
    search?: string;
    sort?: string;
    mine?: boolean | string;
    departmentId?: string;
    districtId?: string;
    talukId?: string;
  }): Promise<Grievance[]> {
    const cleanParams: Record<string, string> = {};
    if (params?.category && params.category !== "all") cleanParams.category = params.category;
    if (params?.status && params.status !== "all") cleanParams.status = params.status;
    if (params?.search) cleanParams.q = params.search;
    if (params?.sort) cleanParams.sort = params.sort;
    if (params?.mine) cleanParams.mine = "true";
    if (params?.departmentId) cleanParams.departmentId = params.departmentId;
    if (params?.districtId) cleanParams.districtId = params.districtId;
    if (params?.talukId) cleanParams.talukId = params.talukId;

    const res = await apiRequest<Grievance[] | { items: Grievance[] }>("/grievances", {
      params: cleanParams,
    });
    return Array.isArray(res) ? res : res.items || [];
  },

  async getGrievanceById(id: string): Promise<Grievance> {
    return apiRequest<Grievance>(`/grievances/${id}`);
  },

  async createGrievance(formData: FormData): Promise<Grievance> {
    return apiRequest<Grievance>("/grievances", {
      method: "POST",
      body: formData,
    });
  },

  async updateGrievance(id: string, payload: Partial<Grievance>): Promise<Grievance> {
    return apiRequest<Grievance>(`/grievances/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  },

  async getUpdates(grievanceId: string): Promise<GrievanceUpdate[]> {
    const res = await apiRequest<GrievanceUpdate[] | { items: GrievanceUpdate[] }>(
      `/grievances/${grievanceId}/updates`
    );
    return Array.isArray(res) ? res : res.items || [];
  },

  async createUpdate(
    grievanceId: string,
    payload: { status: string; note: string; images?: string[]; adminId?: string; userId?: string } | FormData
  ): Promise<GrievanceUpdate> {
    if (payload instanceof FormData) {
      return apiRequest<GrievanceUpdate>(`/grievances/${grievanceId}/updates`, {
        method: "POST",
        body: payload,
      });
    }
    return apiRequest<GrievanceUpdate>(`/grievances/${grievanceId}/updates`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async assignOfficer(
    grievanceId: string,
    payload: { officerId: string; note?: string }
  ): Promise<{ message: string }> {
    return apiRequest<{ message: string }>(`/grievances/${grievanceId}/assign`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async getComments(grievanceId: string): Promise<GrievanceComment[]> {
    const res = await apiRequest<GrievanceComment[] | { items: GrievanceComment[] }>(
      `/grievances/${grievanceId}/remarks`
    );
    return Array.isArray(res) ? res : res.items || [];
  },

  async addComment(
    grievanceId: string,
    payload: { text: string; isInternal?: boolean }
  ): Promise<GrievanceComment> {
    return apiRequest<GrievanceComment>(`/grievances/${grievanceId}/remarks`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async getNearbyGrievances(lat: number, lng: number): Promise<Grievance[]> {
    const res = await apiRequest<Grievance[] | { items: Grievance[] }>(`/grievances/nearby?lat=${lat}&lng=${lng}`);
    return Array.isArray(res) ? res : res.items || [];
  },

  async upvoteGrievance(id: string): Promise<{ upvotes: number; message: string }> {
    return apiRequest<{ upvotes: number; message: string }>(`/grievances/${id}/upvote`, {
      method: "POST",
    });
  },
};
