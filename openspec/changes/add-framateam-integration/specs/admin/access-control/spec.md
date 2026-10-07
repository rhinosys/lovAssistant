## Purpose

Restricts the assistant's administration area (UI and API) to members granted a dedicated YunoHost permission, so that configuration and GDPR operations cannot be performed by ordinary members.

## ADDED Requirements

### Requirement: Admin role from the dedicated YunoHost permission
The system SHALL grant the admin role only to requests that reached the application through the admin-protected path of the reverse proxy, as signalled by a trusted header set exclusively by that proxy location after the SSO has authorised the dedicated `admin` permission.

#### Scenario: Member allowed by the YunoHost admin permission
- **WHEN** an authenticated user who belongs to the group allowed on the `admin` permission opens `/admin`
- **THEN** the admin area is displayed

#### Scenario: Member without the permission
- **WHEN** an authenticated user without the `admin` permission requests `/admin` or any `/api/admin/*` route
- **THEN** the request is refused (by the SSO, or by the application with HTTP 403 if it reaches it) and no admin data is returned

#### Scenario: Spoofed admin header
- **WHEN** a client sends the admin header itself on a non-admin path
- **THEN** the proxy discards it and the application does not grant the admin role

### Requirement: Development fallback
The system SHALL allow, outside production, a configured list of usernames (`ADMIN_USERS`) to obtain the admin role, and SHALL never grant the admin role through the development identity headers when running in production.

#### Scenario: Local development admin
- **WHEN** `NODE_ENV` is not `production` and the authenticated username is listed in `ADMIN_USERS`
- **THEN** the user has the admin role

#### Scenario: Production ignores the fallback
- **WHEN** `NODE_ENV` is `production` and a request carries a development identity header naming a user listed in `ADMIN_USERS`
- **THEN** the admin role is not granted

### Requirement: Admin API protection
Every admin API route SHALL verify the admin role server-side before performing any read or write.

#### Scenario: Non-admin calls an admin API
- **WHEN** a user without the admin role calls `/api/admin/framateam/settings`
- **THEN** the response is HTTP 403 with a `FORBIDDEN` error code and no side effect occurs
