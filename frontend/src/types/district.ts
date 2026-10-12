export interface District {
  id: string;
  name: string;
  code: string;
  state: string;
}

export interface Taluk {
  id: string;
  districtId: string;
  name: string;
  type: string;
  code: string;
}

export interface ProvisionOfficerPayload {
  name: string;
  email: string;
  designation: string;
  departmentId: string;
  districtId: string;
  talukId: string;
  password?: string;
}

export interface ProvisionOfficerResponse {
  id: string;
  name: string;
  officialEmail: string;
  notificationEmail: string;
  temporaryPassword: string;
  designation: string;
  departmentId: string;
  districtId: string;
  talukId: string;
  message: string;
}
