import { api } from "@/lib/api";
import type { CreateUserBody, UpdateUserBody } from "core";
import type { UserListItem } from "@/pages/UsersTable";

export type UsersResponse = { users: UserListItem[] };
export type CreateUserResponse = { user: UserListItem };
export type EditUserResponse = { user: UserListItem };

export const userKeys = {
  all: ["admin", "users"] as const,
};

export async function fetchUsers(): Promise<UserListItem[]> {
  const { data } = await api.get<UsersResponse>("/users");
  if (!Array.isArray(data.users)) {
    throw new Error("Invalid response from server");
  }
  return data.users;
}

export async function createUser(data: CreateUserBody): Promise<UserListItem> {
  const { data: body } = await api.post<CreateUserResponse>("/users", data);
  if (!body.user || typeof body.user.id !== "string") {
    throw new Error("Invalid response from server");
  }
  return body.user;
}

export async function updateUser(
  id: string,
  data: UpdateUserBody,
): Promise<UserListItem> {
  const { data: body } = await api.patch<EditUserResponse>(
    `/users/${id}`,
    data,
  );
  if (!body.user || typeof body.user.id !== "string") {
    throw new Error("Invalid response from server");
  }
  return body.user;
}

export async function deleteUser(id: string): Promise<void> {
  await api.delete(`/users/${id}`);
}
