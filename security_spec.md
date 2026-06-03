# Security Specification for Sentinel AI Academic Suite

## 1. Data Invariants
- **Mentors**: Mentors can only read and write their own profile document (`/mentors/{mentorId}` where `mentorId == request.auth.uid`).
- **Students**: Students must be bound to a valid registered Mentor (`mentorId` field matches mentor's UID, and that mentor's profile document must exist).
- **Student Data Access**: Only the owning mentor (`request.auth.uid == mentorId`) can read, list, create, update, or delete student records.
- **Verification of Email**: Any write operation requires `request.auth.token.email_verified == true` to prevent fraudulent access (using the Google Auth provider).
- **Immutable Fields**: `createdAt` and `mentorId` are immutable for student records once created. `createdAt` for mentor is immutable.
- **Timestamps**: `createdAt` and `updatedAt` must be set using the server-time `request.time`.

---

## 2. The "Dirty Dozen" Payloads
These payloads describe attempts by attackers to compromise security:

### Identity & Access Spoofing
1. **Unauthenticated Read of Mentors**: Attempt to read mentor profiles without logging in. (Should fail)
2. **PII Peek of Another Mentor**: An authenticated mentor tries to read a different mentor's profile. (Should fail)
3. **Spoofing Mentor Write**: A logged-in user tries to create or update a mentor profile using a different user's UID. (Should fail)
4. **Unverified Email Signup**: An attacker logs in with an unverified email and tries to register a profile. (Should fail)

### Cross-Tenant / Cross-Mentor Student Manipulation
5. **Alien Student Registration**: Logged-in Mentor A tries to add a student record setting `mentorId` to Mentor B. (Should fail)
6. **Student Data Theft (List Read)**: Mentor B tries to list or query students belonging to Mentor A. (Should fail)
7. **Cross-Tenant Student Overwrite**: Mentor B tries to update a student record belonging to Mentor A. (Should fail)
8. **Malicious Student Deletion**: Mentor B tries to delete a student record belonging to Mentor A. (Should fail)

### Schema & Integrity Poisoning
9. **Creation of Orphaned Student**: Attacker tries to create a student referencing a non-existent `mentorId`. (Should fail)
10. **Mutating Immutable Fields**: Attacker tries to update `mentorId` or `createdAt` on an existing student record to switch ownership. (Should fail)
11. **Denial-of-Wallet Long ID Injection**: Attacker tries to write a student record with a 50KB custom document ID or extremely large text string fields. (Should fail)
12. **Tampering with Server Timestamps**: Attacker passes a manually typed client timestamp backdated into the past for `createdAt` instead of `request.time`. (Should fail)

---

## 3. Policy Rule Verification Design
The custom security rules stored in `firestore.rules` will enforce:
1. Catch-all `allow read, write: if false;`
2. Mentor profile rules validating UID match, email verification, and timestamp constraints.
3. Student record rules validating ownership match, `exists()` check of parent mentor, and field size checks (< 128 chars for string lookups, validation helper enforce exact keys size on create).
