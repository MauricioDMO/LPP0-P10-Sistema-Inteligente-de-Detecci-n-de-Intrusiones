"use client";

import { IconPencil, IconRefresh, IconUserPlus, IconX } from "@tabler/icons-react";
import { FormEvent, useEffect, useState } from "react";
import { toast } from "sonner";
import { createUser, deactivateUser, fetchUsers, updateUser } from "@/lib/auth-api";
import type { AuthUser, UserCreatePayload } from "@/types/auth";
import { PageHeading } from "@/features/analytics/components/PageHeading";

const AVAILABLE_ROLES = ["admin", "analyst", "viewer"];

function formatDate(value: string) {
  return new Date(value).toLocaleString("es-PE", { dateStyle: "short", timeStyle: "short" });
}

function toggleRole(roles: string[], role: string): string[] {
  if (roles.includes(role)) return roles.filter((currentRole) => currentRole !== role);
  return [...roles, role];
}

function RolePicker({ roles, onChange }: { roles: string[]; onChange: (roles: string[]) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {AVAILABLE_ROLES.map((role) => {
        const selected = roles.includes(role);
        return (
          <button
            className={`rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.1em] transition ${
              selected ? "border-soc-primary/60 bg-soc-blue/25 text-white" : "border-soc-outline/70 bg-soc-lowest text-soc-muted hover:border-soc-primary/40 hover:text-white"
            }`}
            key={role}
            onClick={() => onChange(toggleRole(roles, role))}
            type="button"
          >
            {role}
          </button>
        );
      })}
    </div>
  );
}

function CreateUserForm({ onCreated }: { onCreated: () => Promise<void> }) {
  const [payload, setPayload] = useState<UserCreatePayload>({ username: "", email: "", password: "", roles: ["viewer"], is_active: true });
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);

    try {
      await createUser({ ...payload, email: payload.email || null });
      toast.success("Usuario creado");
      setPayload({ username: "", email: "", password: "", roles: ["viewer"], is_active: true });
      await onCreated();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo crear el usuario");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="rounded-lg border border-soc-outline/80 bg-soc-low/85 p-3 shadow-[0_18px_50px_rgba(0,0,0,0.2)]">
      <div className="mb-3 flex items-center gap-2.5">
        <div className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-soc-primary/35 bg-soc-blue/15 text-soc-primary">
          <IconUserPlus size={17} stroke={1.8} />
        </div>
        <div>
          <div className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-soc-primary">Nuevo acceso</div>
          <h2 className="text-sm font-bold text-white">Crear usuario</h2>
        </div>
      </div>

      <form className="grid gap-2.5 lg:grid-cols-2" onSubmit={handleSubmit}>
        <input className="rounded-md border border-soc-outline/80 bg-soc-lowest px-3 py-1.5 text-sm text-white outline-none focus:border-soc-primary/70" onChange={(event) => setPayload((current) => ({ ...current, username: event.target.value }))} placeholder="usuario" required value={payload.username} />
        <input className="rounded-md border border-soc-outline/80 bg-soc-lowest px-3 py-1.5 text-sm text-white outline-none focus:border-soc-primary/70" onChange={(event) => setPayload((current) => ({ ...current, email: event.target.value }))} placeholder="correo opcional" type="email" value={payload.email ?? ""} />
        <input className="rounded-md border border-soc-outline/80 bg-soc-lowest px-3 py-1.5 text-sm text-white outline-none focus:border-soc-primary/70" minLength={8} onChange={(event) => setPayload((current) => ({ ...current, password: event.target.value }))} placeholder="password mínimo 8 caracteres" required type="password" value={payload.password} />
        <label className="flex items-center gap-2 rounded-md border border-soc-outline/80 bg-soc-lowest px-3 py-1.5 text-sm text-soc-muted">
          <input checked={payload.is_active} onChange={(event) => setPayload((current) => ({ ...current, is_active: event.target.checked }))} type="checkbox" />
          Usuario activo
        </label>
        <div className="lg:col-span-2">
          <RolePicker roles={payload.roles} onChange={(roles) => setPayload((current) => ({ ...current, roles }))} />
        </div>
        <button className="rounded-md border border-soc-primary/45 bg-soc-blue/25 px-4 py-1.5 text-sm font-bold text-white transition hover:bg-soc-blue/35 disabled:opacity-55 lg:col-span-2" disabled={submitting || payload.roles.length === 0} type="submit">
          {submitting ? "Creando..." : "Crear usuario"}
        </button>
      </form>
    </section>
  );
}

function UserEditDialog({ onChanged, onClose, user }: { onChanged: () => Promise<void>; onClose: () => void; user: AuthUser }) {
  const [email, setEmail] = useState(user.email ?? "");
  const [password, setPassword] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [roles, setRoles] = useState<string[]>(user.roles);
  const [isActive, setIsActive] = useState(user.is_active);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);

    try {
      await updateUser(user.id, {
        email: email || null,
        password: password || undefined,
        current_password: password ? currentPassword : undefined,
        roles,
        is_active: isActive,
      });
      setPassword("");
      setCurrentPassword("");
      toast.success(`Usuario ${user.username} actualizado`);
      await onChanged();
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo actualizar el usuario");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeactivate() {
    setSaving(true);

    try {
      await deactivateUser(user.id);
      toast.success(`Usuario ${user.username} desactivado`);
      await onChanged();
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo desactivar el usuario");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 px-3 py-6 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="edit-user-title">
      <div className="w-full max-w-2xl rounded-lg border border-soc-outline/80 bg-soc-low p-4 shadow-[0_24px_80px_rgba(0,0,0,0.45)]">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <div className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-soc-primary">Editar acceso</div>
            <h2 className="text-base font-bold text-white" id="edit-user-title">{user.username}</h2>
            <p className="mt-1 font-mono text-[11px] text-soc-muted">Creado: {formatDate(user.created_at)}</p>
          </div>
          <button className="rounded-md border border-soc-outline/80 bg-soc-lowest p-2 text-soc-muted transition hover:border-soc-primary/45 hover:text-white" onClick={onClose} type="button">
            <IconX size={16} stroke={1.8} />
          </button>
        </div>

        <div className="grid gap-2.5 lg:grid-cols-2">
          <input className="rounded-md border border-soc-outline/80 bg-soc-lowest px-3 py-1.5 text-sm text-white outline-none focus:border-soc-primary/70" onChange={(event) => setEmail(event.target.value)} placeholder="correo" type="email" value={email} />
          <input className="rounded-md border border-soc-outline/80 bg-soc-lowest px-3 py-1.5 text-sm text-white outline-none focus:border-soc-primary/70" minLength={8} onChange={(event) => setPassword(event.target.value)} placeholder="nuevo password opcional" type="password" value={password} />
          {password ? (
            <input className="rounded-md border border-soc-warning/45 bg-soc-lowest px-3 py-1.5 text-sm text-white outline-none focus:border-soc-warning/70" onChange={(event) => setCurrentPassword(event.target.value)} placeholder="tu contraseña de admin" required type="password" value={currentPassword} />
          ) : null}
          <label className="flex items-center gap-2 rounded-md border border-soc-outline/80 bg-soc-lowest px-3 py-1.5 text-sm text-soc-muted">
            <input checked={isActive} onChange={(event) => setIsActive(event.target.checked)} type="checkbox" />
            Activo
          </label>
          <div className="lg:col-span-2">
            <RolePicker roles={roles} onChange={setRoles} />
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
          <button className="rounded-md border border-soc-outline/80 bg-soc-lowest px-4 py-1.5 text-sm font-bold text-soc-muted transition hover:border-soc-primary/45 hover:text-white" disabled={saving} onClick={onClose} type="button">
            Cancelar
          </button>
          <button className="rounded-md border border-soc-danger/40 bg-soc-danger/10 px-4 py-1.5 text-sm font-bold text-red-100 transition hover:bg-soc-danger/20 disabled:opacity-55" disabled={saving || !user.is_active} onClick={handleDeactivate} type="button">
            Desactivar
          </button>
          <button className="rounded-md border border-soc-primary/45 bg-soc-blue/25 px-4 py-1.5 text-sm font-bold text-white transition hover:bg-soc-blue/35 disabled:opacity-55" disabled={saving || roles.length === 0 || Boolean(password && !currentPassword)} onClick={handleSave} type="button">
            {saving ? "Guardando..." : "Guardar cambios"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function UserManagementPage() {
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [editingUser, setEditingUser] = useState<AuthUser | null>(null);

  const normalizedSearch = searchQuery.trim().toLowerCase();
  const filteredUsers = normalizedSearch
    ? users.filter((user) => `${user.username} ${user.email ?? ""}`.toLowerCase().includes(normalizedSearch))
    : users;

  async function loadUsers() {
    setError(null);
    try {
      const response = await fetchUsers();
      setUsers(response.users);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "No se pudieron cargar usuarios");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;

    fetchUsers()
      .then((response) => {
        if (!cancelled) setUsers(response.users);
      })
      .catch((requestError) => {
        if (!cancelled) setError(requestError instanceof Error ? requestError.message : "No se pudieron cargar usuarios");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="min-h-screen px-3 py-3 text-foreground sm:px-4 lg:px-6">
      <div className="mx-auto flex max-w-450 flex-col gap-3">
        <PageHeading eyebrow="Administración" title="Usuarios" description="Gestiona usuarios, roles y estado de acceso contra el backend JWT." />
        <CreateUserForm onCreated={loadUsers} />
        <section className="rounded-lg border border-soc-outline/80 bg-soc-low/85 p-3 shadow-[0_18px_50px_rgba(0,0,0,0.2)]">
          <div className="mb-3 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-soc-primary">Directorio</div>
              <h2 className="text-sm font-bold text-white">Usuarios registrados</h2>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <input
                className="w-full rounded-md border border-soc-outline/80 bg-soc-lowest px-3 py-1.5 text-sm text-white outline-none placeholder:text-soc-muted/70 focus:border-soc-primary/70 sm:w-80"
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Buscar por usuario o correo"
                type="search"
                value={searchQuery}
              />
              <button className="inline-flex items-center justify-center gap-2 rounded-md border border-soc-outline/80 bg-soc-lowest px-3 py-1.5 text-sm font-bold text-soc-muted transition hover:border-soc-primary/45 hover:text-white" onClick={() => void loadUsers()} type="button">
                <IconRefresh size={16} stroke={1.8} />
                Actualizar
              </button>
            </div>
          </div>

          {loading ? <div className="rounded border border-soc-outline bg-soc-lowest px-4 py-8 text-center text-sm text-soc-muted">Cargando usuarios...</div> : null}
          {error ? <div className="rounded border border-soc-danger/35 bg-soc-danger/10 px-4 py-8 text-center text-sm text-red-200">{error}</div> : null}
          {!loading && !error && users.length === 0 ? <div className="rounded border border-soc-outline bg-soc-lowest px-4 py-8 text-center text-sm text-soc-muted">No hay usuarios registrados</div> : null}
          {!loading && !error && users.length > 0 && filteredUsers.length === 0 ? <div className="rounded border border-soc-outline bg-soc-lowest px-4 py-8 text-center text-sm text-soc-muted">No se encontraron usuarios para esa búsqueda</div> : null}
          {!loading && !error && filteredUsers.length > 0 ? (
            <div className="overflow-x-auto rounded-lg border border-soc-outline/70 bg-soc-lowest/70">
              <table className="min-w-full divide-y divide-soc-outline/70 text-left text-sm">
                <thead className="bg-soc-low/80 font-mono text-[10px] uppercase tracking-[0.14em] text-soc-muted">
                  <tr>
                    <th className="px-3 py-2 font-bold">Usuario</th>
                    <th className="px-3 py-2 font-bold">Correo</th>
                    <th className="px-3 py-2 font-bold">Roles</th>
                    <th className="px-3 py-2 font-bold">Estado</th>
                    <th className="px-3 py-2 font-bold">Creado</th>
                    <th className="px-3 py-2 text-right font-bold">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-soc-outline/55">
                  {filteredUsers.map((user) => (
                    <tr className="transition hover:bg-soc-blue/10" key={user.id}>
                      <td className="whitespace-nowrap px-3 py-2 font-bold text-white">{user.username}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-soc-muted">{user.email || "Sin correo"}</td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-1.5">
                          {user.roles.map((role) => (
                            <span className="rounded-full border border-soc-primary/30 bg-soc-blue/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.1em] text-soc-primary" key={role}>
                              {role}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2">
                        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.1em] ${user.is_active ? "border-soc-success/40 bg-soc-success/10 text-green-200" : "border-soc-danger/40 bg-soc-danger/10 text-red-200"}`}>
                          {user.is_active ? "activo" : "inactivo"}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 font-mono text-[11px] text-soc-muted">{formatDate(user.created_at)}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-right">
                        <button className="inline-flex items-center justify-center gap-1.5 rounded-md border border-soc-outline/80 bg-soc-low px-3 py-1.5 text-xs font-bold text-soc-muted transition hover:border-soc-primary/45 hover:text-white" onClick={() => setEditingUser(user)} type="button">
                          <IconPencil size={14} stroke={1.8} />
                          Editar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </section>
      </div>
      {editingUser ? <UserEditDialog key={editingUser.id} user={editingUser} onChanged={loadUsers} onClose={() => setEditingUser(null)} /> : null}
    </main>
  );
}
