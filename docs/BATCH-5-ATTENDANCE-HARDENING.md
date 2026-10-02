# WELP Batch 5 — Attendance Hardening

Added `submitAttendanceEvidence` as a trusted backend gate.

Server checks:
- authenticated Firebase user
- verified email
- `attendance.write` permission
- tenant claim matches request
- branch/employee identity present
- valid lat/lng
- GPS accuracy <= 100m
- capture ID uniqueness / idempotency
- SHA-256 photo fingerprint format
- evidence version 2
- camera/liveness/geo verification flags
- immutable server timestamp

The existing client capture remains compatible while migration to the callable is staged. Do not describe browser motion detection as full biometric liveness; it is only one signal.
