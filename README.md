# CadetLinks — Maintainer README

CadetLinks is a React + TypeScript + Firebase web portal for an AFROTC cadet
unit: announcements, event scheduling with RSVP, attendance tracking,
document sharing, a member directory, and role-based administration.

This README is for developers maintaining the codebase on GitHub. For
day-to-day usage instructions, see the role-specific guides:

- [`docs/ADMIN_GUIDE.md`](docs/ADMIN_GUIDE.md)
- [`docs/ATTENDANCE_MANAGER_GUIDE.md`](docs/ATTENDANCE_MANAGER_GUIDE.md)
- [`docs/EVENTS_MANAGER_GUIDE.md`](docs/EVENTS_MANAGER_GUIDE.md)
- [`docs/USER_GUIDE.md`](docs/USER_GUIDE.md)

## Tech stack

- **React 19** + **TypeScript**, bundled with **Vite**
- **React Router DOM v7** for client-side routing
- **MUI (Material-UI) v9** + **Emotion** for UI and theming
- **Firebase**: Authentication (email/password), Firestore (data), Storage
  (profile photos + documents)
- **Prettier** for formatting (`.prettierrc.json`)

## Project layout

```
App.tsx                     Route definitions
ProtectedRoute.tsx          Auth guard + AdminRoute / AttendanceRoute guards
index.tsx                   Entry point; wraps App in AuthProvider + AppDataProvider

firebase/
  firebase.ts               Firebase app/auth/firestore/storage init
  AuthContext.tsx           React context wrapping Firebase Auth (currentUser)
  AppDataContext.tsx        App-wide cache of all users + jobs (fetched once per session)
  services/
    events.ts               Firestore access for the `events` collection
    attendance.ts           Firestore access for `events/{id}/attendance` subcollections

hooks/
  useUser.ts                Current signed-in user's Firestore profile + job + permissions
  useSupervisorChain.ts     Supervisor/supervisee chain lookups

lib/
  attendance.ts             AttendanceStatus type, status cycles, colors, absence calculator
  constants.ts              FLIGHTS, class-year order

pages/
  sign-in/                  Sign in, forgot password
  dashboard/                Home (announcements + upcoming events), Events (calendar + RSVP),
                             Profile (own profile, bio, photo, attendance), Resources (nav cards)
  admin/                    Users / Jobs / Events management (requires `admin` permission)
  attendance/               Logger (single-event roll call) + AttendanceSheet (grid view)
  documentExplorer/         Shared file/folder browser backed by Firestore + Storage
  profileLookup/            Directory search + read-only public profile view

shared-theme/               MUI theme, color mode, and layout chrome (AppHeader, AppContainer)
```

### Why `lib/` and `firebase/services/` exist

Domain logic that used to be copy-pasted across multiple components (the
absence-remaining calculation, status color maps, flight/class-year
constants, and raw Firestore queries) has been consolidated:

- **`lib/`** holds pure, framework-free domain logic and constants. If you
  need the absence formula or the status color for a chip, import it from here — don't reimplement it in a component.
- **`firebase/services/`** wraps the Firestore calls for events and
  attendance so components don't construct queries inline. Extend this
  layer (rather than reaching for `firebase/firestore` directly in a
  component) when you add new event/attendance operations.

If you add a new cross-cutting concept (e.g. a new collection queried from
3+ places), follow the same pattern rather than duplicating query logic.

## Data model (Firestore)

| Collection | Notes |
|---|---|
| `users/{uid}` | Profile: displayName, email, phone, classYear, flight, rank, jobId, bio, photoURL, supervisorIds, superviseeIds |
| `jobs/{jobId}` | title, permissions (string[]), parentJobId, childJobIds — defines the org chart and permission set |
| `events/{eventId}` | title, startDate, endDate, mandatory, location, createdBy |
| `events/{eventId}/rsvps/{uid}` | RSVP subcollection; one doc per cadet who has RSVP'd |
| `events/{eventId}/attendance/{uid}` | Attendance subcollection; status + who logged it (`takenById`) |
| `announcements/{id}` | title, details, importance (`high`/`medium`/`low`), expirationDate |
| `documentMetadata/{id}` | Folder/file tree for the Document Explorer; actual files live in Storage under `documents/` |

Permissions are **not** roles baked into code — they're a `permissions:
string[]` array on each `jobs` document (e.g. `admin`, `manage_attendance`,
`manage_events`, `manage_announcements`, `manage_documents`,
`manage_pt_scores`). A user's permissions come from whatever job they're
assigned (`users.jobId`). `admin` is treated as a superset — most
`hasPermission(perm)` checks in Firestore rules accept `perm` OR `admin`.

## Security rules

Firestore and Storage rules are **not stored in this repo** — they live in
the Firebase console. When you change how a collection is queried
(especially adding a `collectionGroup()` query), you likely need a matching
rule change:

- Collection group queries (e.g. reading attendance across all events)
  require a `match /{path=**}/attendance/{userId}` style rule — a rule
  nested only under `/events/{eventId}/attendance/{userId}` does **not**
  authorize a collection group query, even if the per-document logic looks
  identical.
- Firestore rules cannot reference Storage, and Storage rules cannot call
  `get()` against Firestore documents — permission checks for
  Storage-backed files (documents, profile photos) are enforced at the
  Firestore-document level (`documentMetadata`) and in the app, not in
  Storage rules.
- Keep the collection name in rules in sync with the collection name in
  code. The Document Explorer reads/writes `documentMetadata`, not
  `documents` — a rules file with a `/documents/{docId}` match will not
  cover it.

## Local development

```bash
npm install
npm run dev          # start Vite dev server
npm run build         # tsc -b && vite build
npm run format        # prettier --write
npm run format:check  # prettier --check (CI-friendly)
```

You'll need your own Firebase project config in `firebase/firebase.ts` (or
wired through environment variables, depending on how your deployment is
set up) to run against real data.

## Contributing

- Run `npm run format` before committing — a Prettier config exists to keep
  formatting consistent; there's no CI enforcement yet, so this is on the
  honor system until one is added.
- Prefer extending `lib/` and `firebase/services/` over adding new
  Firestore queries directly inside components.
- If you change a Firestore query's structure (new `where`, a
  `collectionGroup`, a new collection), check whether the Firestore rules
  need a matching update before merging — this project's rules are the
  most common source of "insufficient permissions" bugs post-deploy.
