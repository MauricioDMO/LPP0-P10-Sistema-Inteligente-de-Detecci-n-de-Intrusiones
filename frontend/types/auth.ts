export type UserRole = "admin" | "analyst" | "viewer" | string;

export type AuthUser = {
  id: string;
  username: string;
  email: string | null;
  is_active: boolean;
  roles: UserRole[];
  created_at: string;
  updated_at: string;
};

export type LoginResponse = {
  expires_in: number;
  user: AuthUser;
};

export type UserCreatePayload = {
  username: string;
  email?: string | null;
  password: string;
  roles: string[];
  is_active: boolean;
};

export type UserUpdatePayload = {
  email?: string | null;
  password?: string;
  current_password?: string;
  roles?: string[];
  is_active?: boolean;
};

export type UsersListResponse = {
  users: AuthUser[];
};
