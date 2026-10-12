export type UserRole = "citizen" | "department" | "admin";

export interface User {
  id: string;
  name?: string;
  email: string;
  officialEmail?: string;
  designation?: string;
  phone?: string;
  role: UserRole;
  departmentId?: string;
  districtId?: string;
  talukId?: string;
  googleId?: string;
  avatarUrl?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface AuthResponse {
  user: User;
  token: string;
  accessToken?: string;
  refreshToken?: string;
}

export interface LoginPayload {
  email: string;
  password?: string;
}

export interface GoogleAuthPayload {
  email?: string;
  name?: string;
  googleId?: string;
  avatarUrl?: string;
  idToken?: string;
}

export interface RegisterPayload {
  name?: string;
  email: string;
  password?: string;
  phone?: string;
  role?: UserRole;
  departmentId?: string;
}
