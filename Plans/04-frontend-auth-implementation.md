# Frontend Auth Implementation

## Objetivo

Implementar login, estado de sesion y helpers autenticados contra el backend JWT ya disponible en `/api/auth/*`.

## Endpoints Backend

```http
POST /api/auth/login
GET /api/auth/me
POST /api/auth/users
GET /api/auth/users
PATCH /api/auth/users/{user_id}
DELETE /api/auth/users/{user_id}
```

## Contrato Login

Request:

```json
{
  "username": "admin",
  "password": "admin123"
}
```

Response:

```json
{
  "expires_in": 28800,
  "user": {
    "id": "...",
    "username": "admin",
    "email": "admin@suricata.local",
    "is_active": true,
    "roles": ["admin"],
    "created_at": "...",
    "updated_at": "..."
  }
}
```

## Rutas Frontend Sugeridas

- `/login`.
- `/admin/users`.
- `/suricata` futuro.
- `/lists` futuro.
- `/threat-intel` futuro.
- `/system` futuro.
- `/pcap` futuro.
- `/incidents` futuro.

## Estado De Sesion

Para MVP:

- Usar cookie HttpOnly emitida por backend, no `localStorage`.
- Usar cookie `suricata_csrf` y header `X-CSRF-Token` en mutaciones.
- Crear `AuthProvider` cliente.
- Cargar `/api/auth/me` al iniciar si hay token.
- Exponer `user`, `roles`, `login`, `logout`, `isAuthenticated`.

## Helper HTTP

Crear `authenticatedFetch(path, options)`.

Debe agregar:

```http
credentials: include
X-CSRF-Token: <suricata_csrf> en mutaciones
```

Si recibe `401`:

- Limpiar sesion.
- Redirigir a `/login`.

## Proteccion Visual

Crear `ProtectedRoute` o wrapper equivalente.

Reglas:

- `admin`: acceso total.
- `analyst`: modulos operativos.
- `viewer`: solo lectura.

El dashboard actual puede seguir publico hasta que se decida protegerlo completamente.

## Navegacion

Actualizar `AppNav` para:

- Mostrar usuario actual.
- Mostrar boton logout.
- Mostrar rutas administrativas segun rol.

## Administracion De Usuarios

Pantalla inicial `/admin/users`:

- Listar usuarios.
- Crear usuario.
- Editar email, estado y roles.
- Cambiar password.
- Desactivar usuario.

## Validacion

- Login correcto redirige a `/live`.
- Token invalido limpia sesion.
- Usuario sin rol no ve acciones restringidas.
- Requests administrativos envian Bearer token.
- `/api/auth/users` muestra error si el usuario no es admin.
