# Operator onboarding implementation

Goal: deliver configuration-based onboarding with verified tenant identity, transactional initialization, configurable charging rules and real two-tenant proof.
Architecture: reuse tenant initializer; shared database for lifecycle/default rules; local operator rule reads inside reservation transaction; trusted session identity overrides request headers.
Tech stack: existing Java 8 / Spring Boot / MyBatis / MySQL / Vue 2 stack; no upgrades.
Spec: docs/superpowers/specs/2026-11-07-operator-onboarding-design.md (user approved November 7).

## Global Constraints
Preserve unrelated dirty files and all existing data. Work on existing feat/device-alarm-processing branch. No publish, push, resume or interview-helper edits. Credentials never enter reports. Existing forced validators remain. Missing rule fails closed after migration. Demo compatibility is explicit, local only.

## Task 1: trusted identity
Files: common-security HeaderInterceptor, gateway AuthFilter, associated test/pom files.
Interface: authenticated LoginUser.SysUser supplies user, department and tenant; trusted internal calls retain existing contract.
Write real interceptor/filter spoof-header tests, run RED, override headers/context from server session, run GREEN and related suite. Expected: forged tenant and user cannot override session; completion clears context.

## Task 2: lifecycle and schema
Files: additive SQL migration, shared lifecycle/rule initialization services and tests.
Interface: requireActive(tenantId), seedDefault(tenantId), default demo switch false.
RED tests for stopped/expired/missing tenant and demo compatibility; implement; verify actual MySQL migration twice and existing data counts. Schema: rule row PK tenant; whitelist PK tenant/member; version for CAS; preflight duplicate username constraint.

## Task 3: operator onboarding
Files: tenant service/controller/DTO/mapper and tests.
Interface: root-only explicit-password onboarding reuses initializer; all initialization and default rules one transaction; package menu validation and database uniqueness.
RED unauthorized, invalid package/menu, duplicates and late rollback tests; implement with no external notification inside transaction; GREEN database reconciliation. Secure legacy endpoint too.

## Task 4: configurable rules
Files: operator rule service/controller/mapper, charging validator and tests.
Interface: maxChargingHours 1..24, whitelistEnabled, version CAS, targetTenantId root-only; same-tenant whitelist membership.
RED allowed/denied starts, cross-tenant and stale version tests; implement shared rule locking on starts, exclusive on mutations, current whitelist reads; GREEN concurrent DB and no-side-effect assertions.

## Task 5: member and device ownership
Files: mp registration/login/controller, tenant lifecycle login checks, station/pile/port APIs, mini registration.
RED explicit tenant registration, foreign parent resource and stopped tenant tests; implement trusted binding and A/B membership; verify existing stop/settle remains available with valid credentials.

## Task 6: admin UI and full proof
Files: existing tenant view/API, operator rule view/API/menu migration, dedicated test scripts, test report.
Implement masked-password onboarding and rule/whitelist UI. Build backend/frontend. Run gateway A/B onboarding, real account login, API devices, different rules, full charge, alarms and ticket lifecycle; symmetric denial and demo regression. Capture actual counts/timing and cleanup only dedicated fixtures.

## Review Focus
Header spoofing, root versus demo tenant, legacy bypass, password audit leaks, partial initialization, rule/whitelist stale snapshots and lock ordering, disabled tenant safe stops, member/device cross-tenant parent relationships, frontend permission/menu availability, measurement scope.

## Completion
Run relevant module suites and frontend build; final independent branch review; fix material findings using RED/GREEN; record measured evidence and remaining limits. No unverified claims.
