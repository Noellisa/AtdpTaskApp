# ATDP Workforce Flow — Security Specification (Phase 0 TDD)

## 1. Data Invariants

1. **Workspace Ownership & Tenant Isolation**: Every document across `employees`, `tasks`, `instructions`, `departments`, `meetings`, `announcements`, `notifications`, and `activityLogs` must carry a `workspaceOwnerId` matching `request.auth.uid` (or be accessed by a verified Admin).
2. **PII Protection**: Employee documents containing PII (`email`, `phone`, `nationalId`) can only be read (`get`, `list`) or mutated by the authenticated `workspaceOwnerId` or a verified Admin. Blanket `isSignedIn()` reads are strictly prohibited.
3. **Query Enforcer on List Operations**: Every `allow list` rule validates `resource.data.workspaceOwnerId == request.auth.uid || isAdmin()` without invoking `get()` or `exists()` per document.
4. **Strict Key & Size Enforcement**: Every `create` operation enforces `hasAll` and `hasOnly` on document keys, and every string field is bounded by its maximum character length from `firebase-blueprint.json`.
5. **Action-Based Updates & Immutability**: Every `update` operation begins with `isValid[Entity](incoming())`, preserves immutable fields (`workspaceOwnerId`, `createdAt`), and restricts modified keys via `affectedKeys().hasOnly(...)`.

## 2. The "Dirty Dozen" Payloads

1. **Identity Spoofing on Task Creation**: `workspaceOwnerId: "spoofed_uid_999"` when `request.auth.uid == "user_1"`. -> `PERMISSION_DENIED`
2. **Shadow Field Injection on Employee Create**: Adding `"isSuperAdmin": true` to `/employees/emp_1`. -> `PERMISSION_DENIED`
3. **PII Blanket Read Attack**: Authenticated `user_2` attempting `get(/employees/emp_owned_by_user_1)`. -> `PERMISSION_DENIED`
4. **Unscoped List Scraping**: Authenticated `user_2` querying `/tasks` without `where('workspaceOwnerId', '==', 'user_2')`. -> `PERMISSION_DENIED`
5. **Resource Poisoning (Oversized ID)**: Creating `/tasks/{200_char_id}` exceeding 128 chars or containing invalid characters. -> `PERMISSION_DENIED`
6. **Denial of Wallet (1MB String Payload)**: Updating `task.description` with a 50,000-character string (limit is 2000). -> `PERMISSION_DENIED`
7. **Unbounded Array Injection**: Sending 25 subtasks in `task.subtasks` (limit is 10). -> `PERMISSION_DENIED`
8. **Invalid Enum State Transition**: Setting `task.status` to `"HACKED_STATE"`. -> `PERMISSION_DENIED`
9. **Immutable Owner Mutation**: Attempting to change `workspaceOwnerId` or `createdAt` during an `update` on `/tasks/task_1`. -> `PERMISSION_DENIED`
10. **Unverified Email Admin Spoof**: Claiming admin email `opokudarkonoellisa@gmail.com` with `email_verified: false`. -> `PERMISSION_DENIED`
11. **Value Poisoning on Update**: Updating a whitelisted key (`status`) with a number `12345` instead of a valid status string. -> `PERMISSION_DENIED`
12. **Unauthorized Cross-Tenant Delete**: Authenticated `user_2` attempting `delete(/tasks/task_owned_by_user_1)`. -> `PERMISSION_DENIED`
