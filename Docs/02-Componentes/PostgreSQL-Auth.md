# PostgreSQL, ORM y Autenticacion JWT

## Objetivo

El backend incorpora PostgreSQL como base relacional para usuarios, roles y entidades administrativas futuras. Esta capa desbloquea los modulos de gestion Suricata, listas, threat intel local, PCAP e incidentes con auditoria y control de acceso.

## Componentes

- PostgreSQL 16 en Docker Compose.
- SQLAlchemy 2 async con `asyncpg`.
- Alembic para migraciones.
- `python-jose` para JWT de sesion en cookie HttpOnly.
- `passlib[bcrypt]` para hash de passwords.

## Servicios Docker

El servicio `postgres` usa:

- Base: `POSTGRES_DB=suricata`.
- Usuario: `POSTGRES_USER=suricata`.
- Password: `POSTGRES_PASSWORD=suricata` en laboratorio.
- Volumen persistente: `postgres-data`.
- Healthcheck con `pg_isready`.

El backend espera a que PostgreSQL este saludable y ejecuta `alembic upgrade head` antes de iniciar Uvicorn.

## Variables De Entorno

Variables PostgreSQL del contenedor:

```env
POSTGRES_DB=suricata
POSTGRES_USER=suricata
POSTGRES_PASSWORD=suricata
```

Variables backend:

```env
BACKEND_DATABASE_URL=postgresql+asyncpg://suricata:suricata@postgres:5432/suricata
BACKEND_JWT_SECRET=change-me
BACKEND_JWT_ALGORITHM=HS256
BACKEND_JWT_EXPIRES_MINUTES=480
BACKEND_INITIAL_ADMIN_USERNAME=admin
BACKEND_INITIAL_ADMIN_PASSWORD=admin123
BACKEND_INITIAL_ADMIN_EMAIL=admin@local
```

Para produccion, cambiar `POSTGRES_PASSWORD`, `BACKEND_DATABASE_URL`, `BACKEND_JWT_SECRET` y las credenciales del admin inicial antes del primer arranque.

## Migraciones

La migracion inicial crea:

- `users`.
- `roles`.
- `user_roles`.

La segunda migracion agrega `users.token_version`, usado para revocar sesiones emitidas antes de logout, cambio de password o desactivacion.

En Docker, el backend ejecuta automaticamente:

```bash
alembic upgrade head
```

Ejecucion manual dentro del contenedor:

```bash
docker compose exec backend alembic upgrade head
```

Con el wrapper usado en este entorno:

```bash
sg docker -c "docker-compose exec backend alembic upgrade head"
```

## Bootstrap Inicial

Durante el startup del backend se crean roles base si no existen:

- `admin`.
- `analyst`.
- `viewer`.

Si no existe ningun usuario, se crea el admin inicial desde las variables `BACKEND_INITIAL_ADMIN_*`.

El admin inicial solo se crea cuando la tabla `users` esta vacia. Si ya existe cualquier usuario, cambiar las variables `BACKEND_INITIAL_ADMIN_*` no modifica usuarios existentes.

## Modelo De Sesion

La API no expone el JWT al frontend. En login, el backend crea:

- Cookie HttpOnly `suricata_session` con el JWT.
- Cookie legible por JavaScript `suricata_csrf` para doble envio CSRF.

El JWT incluye `sub`, `roles`, `token_version`, `iat` y `exp`. En cada request protegido, el backend compara el `token_version` del token con `users.token_version`. Si no coincide, responde `401` porque la sesion fue revocada.

Se incrementa `token_version` cuando:

- El usuario hace logout.
- Se cambia el password del usuario.
- El usuario es desactivado.

Las mutaciones protegidas requieren header `X-CSRF-Token` con el valor de la cookie `suricata_csrf`.

El login aplica un limite en memoria de 5 intentos fallidos por usuario/IP durante 5 minutos. Si se supera, responde `429`.

Durante el arranque, el backend registra advertencias si `BACKEND_JWT_SECRET` o `BACKEND_INITIAL_ADMIN_PASSWORD` mantienen los valores de laboratorio.

## Endpoints

### Login

```http
POST /api/auth/login
```

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
    "email": "admin@local",
    "is_active": true,
    "roles": ["admin"],
    "created_at": "...",
    "updated_at": "..."
  }
}
```

Ademas, la respuesta incluye cookies `Set-Cookie` para la sesion y CSRF.

### Usuario Actual

```http
GET /api/auth/me
Cookie: suricata_session=<jwt>
```

### Administracion De Usuarios

Requiere rol `admin`.

```http
POST /api/auth/users
GET /api/auth/users
PATCH /api/auth/users/{user_id}
DELETE /api/auth/users/{user_id}
```

`DELETE` desactiva el usuario con `is_active=false`; no borra fisicamente el registro para conservar futuras referencias de auditoria.

Protecciones implementadas:

- No se puede desactivar el ultimo admin activo.
- No se puede quitar el rol `admin` al ultimo admin activo.
- Un admin no puede desactivar su propio usuario desde la pantalla de usuarios.
- Un admin no puede quitarse su propio rol `admin`.

## Roles

- `admin`: acceso completo.
- `analyst`: operacion SOC y modulos administrativos futuros.
- `viewer`: solo lectura.

Los helpers disponibles para nuevos routers son:

- `get_current_user()`.
- `require_roles("admin")`.
- `require_roles("admin", "analyst")`.

## Preparacion Para Modulos Futuros

La base incluye `AuditMixin` con `created_by_id`, `created_at` y `updated_at` para entidades administrativas futuras:

- Perfiles Suricata.
- Listas negras y blancas.
- Threat intel local.
- Capturas PCAP.
- Incidentes, comentarios e historial.

## Validacion Rapida

```bash
curl http://localhost:8000/api/events/health
curl -c cookies.txt -b cookies.txt -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
curl -b cookies.txt http://localhost:8000/api/auth/me
curl -b cookies.txt http://localhost:8000/api/events/latest?limit=3
CSRF=$(awk '/suricata_csrf/ {print $7}' cookies.txt)
curl -b cookies.txt -X POST http://localhost:8000/api/auth/logout \
  -H "X-CSRF-Token: $CSRF"
```

Resultados esperados:

- Login devuelve usuario, `expires_in` y cookies de sesion.
- `/api/auth/me` sin token devuelve `401`.
- `/api/auth/me` con cookie valida devuelve usuario y roles.
- `/api/auth/users` sin token devuelve `401`.
- `/api/auth/users` con usuario no admin devuelve `403`.
- Logout revoca la sesion actual mediante `token_version`.
