export type UserRoleValue = "admin";

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRoleValue;
  createdAt: string;
}

/** Versión segura para el cliente (sin passwordHash). */
export type UserDTO = User;

export interface RegisterPayload {
  email: string;
  password: string;
  name: string;
  registrationKey: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}
