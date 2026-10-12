import { apiRequest } from "./client";
import type { District, Taluk, ProvisionOfficerPayload, ProvisionOfficerResponse } from "@/types";

export const districtsApi = {
  async getDistricts(): Promise<District[]> {
    const res = await apiRequest<District[] | { items: District[] }>("/districts");
    return Array.isArray(res) ? res : res.items || [];
  },

  async getTaluks(districtId: string): Promise<Taluk[]> {
    if (!districtId) return [];
    const res = await apiRequest<Taluk[] | { items: Taluk[] }>(`/districts/${districtId}/taluks`);
    return Array.isArray(res) ? res : res.items || [];
  },

  async provisionOfficer(payload: ProvisionOfficerPayload): Promise<ProvisionOfficerResponse> {
    return apiRequest<ProvisionOfficerResponse>("/admin/officers", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
};
