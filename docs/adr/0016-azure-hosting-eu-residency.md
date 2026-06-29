# ADR-0016 — Azure hosting & EU data residency

- **Status:** Accepted
- **Date:** 2026-06-29
- **Deciders:** Architect (Siebe De Saedeleir / team)
- **Ratified:** 2026-06-29 — **Azure + EU hosting and EU AI data zone confirmed** (directie/auteur). The Art. XIV "Hosting/AI sign-off" open decision is hereby closed.

## Context

The product is a browser-based web app with no local install (NFR-4), processing staff/curriculum data under GDPR/AVG (Art. VI.2/VI.3, NFR-6). The constitution fixes Microsoft Azure for hosting and prefers an EU data zone for AI (Art. VI.3, Art. "AI conventions"). The Hosting/AI EU sign-off was **closed on 2026-06-29** (this ADR ratified; Art. XIV Resolved block); the architectural direction is set.

## Decision

We will host on **Microsoft Azure in an EU region**, with **all data at rest and the AI data zone kept within the EU**:
- Backend API + frontend served from Azure (e.g. App Service / Container Apps), EU region.
- PostgreSQL as an EU-region managed instance (Azure Database for PostgreSQL) in production.
- Azure AI Foundry calls use an **EU data zone**; the AI client (ADR-0010) is configured accordingly.
- Secrets via Key Vault (ADR-0012); TLS in transit, encryption at rest (NFR-5).
- Regular backups + documented restore (NFR-9).

The specific Azure services are an implementation detail that may get its own ADR; the **binding constraints are: Azure, EU region, EU AI data zone, encrypted, no pupil PII.**

## Alternatives considered

- **Non-EU region / global AI endpoint** — violates the EU-residency intent and complicates GDPR. Rejected.
- **Self-hosted/on-prem** — contradicts the cloud, no-local-install requirement and adds ops burden. Rejected.
- **Another cloud (AWS/GCP)** — not the mandated platform; would split from Azure AI Foundry. Rejected.

## Consequences

**Positive**
- GDPR posture is clear (EU residency end-to-end); single cloud aligns hosting + AI; managed services cover backup/restore/scaling.

**Negative / trade-offs**
- Azure lock-in (accepted, mandated). EU/AI sign-off is now **confirmed** (2026-06-29), so no decision blocks development.

**Follow-ups**
- E7-04 (deploy EU region), E7-05 (encryption/keys), E7-06 (no pupil PII + register), E7-09 (backups).

## Compliance trace

- **Constitution:** Art. VI.3 (EU region, no pupil data), Art. VIII (Azure), AI conventions (EU data zone), Art. XIV (sign-off **closed 2026-06-29**).
- **Backlog:** E7-04/05/06/09.
- **FR/NFR:** NFR-4, NFR-5, NFR-6, NFR-9.
