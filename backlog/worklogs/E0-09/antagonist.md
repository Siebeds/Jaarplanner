# Antagonist Review — E0-09 Design-system foundation (Radix + shadcn/ui + tokens + Storybook)

Verdict: COMPLIANT (with QUESTIONs and MINOR drift to confirm/clean up)
Scope audited: git diff feature/e0-foundation...story/E0-09 (commit 15998b2) — 19 files.

## Findings

### [QUESTION] Unused dekking-deels token may pre-decide the binary-vs-graded coverage open decision
- Article/FR: Art. IX.3 + Art. XIV (Coverage depth open decision)
- Where: frontend/src/index.css:48-49, frontend/tailwind.config.js:50, frontend/src/components/ui/badge.tsx:48-49
- Problem: A dekking-deels (partially covered, amber) token and Badge variant are defined. Art. IX.3 states MVP dekking is binary (gedekt/niet-gedekt) as a deliberate simplification; graded coverage is an explicit Art. XIV open decision. The token is not consumed yet (foundation, not feature logic), but a named deels state leans toward the undecided graded model.
- Required fix: Confirm intent. Either drop dekking-deels until coverage-depth is decided, or keep it with a comment marking it a forward-looking placeholder for the open Art. XIV decision, NOT wired into MVP binary dekking. Low severity (nothing computes/stores it).

### [MINOR] lucide-react added as a runtime dependency but unused
- Article/FR: Art. X.6 / Art. VIII
- Where: frontend/package.json dependencies; 0 imports in frontend/src or .storybook
- Problem: lucide-react ^1.22.0 ships as a non-dev dependency yet is unreferenced. shadcn conventionally uses lucide, so defensible scaffolding, but it is dead weight and version 1.22.0 is atypical (lucide-react mainline is 0.x); lockfile resolved a real package with valid integrity, so not malicious, just unusual.
- Required fix: Use it in a primitive, or remove until first use. If kept, verify 1.22.0 is intended and not a typo for a 0.x release.

### [QUESTION] Spurious allowBuilds block in pnpm-workspace.yaml with a placeholder value
- Article/FR: Art. X.6 / Art. X.4
- Where: frontend/pnpm-workspace.yaml:1-2
- Problem: Committed block is allowBuilds: { esbuild: set this to true or false }. allowBuilds is not a recognised pnpm workspace key (the effective allow-list is the existing onlyBuiltDependencies: [esbuild] below, which already covers esbuild). The value is a literal placeholder, not a boolean. Benign — pnpm ignores the unknown key and onlyBuiltDependencies still works — but it is committed noise resembling an unfinished TODO.
- Required fix: Remove the allowBuilds block (esbuild already handled by onlyBuiltDependencies); if truly needed, set a real boolean. Confirm pnpm install still permits the esbuild postinstall after removal.

### [MINOR] Story demo copy Opslaan is real Dutch UI vocabulary, now lint-exempt
- Article/FR: Art. II.3 (i18n)
- Where: frontend/src/components/ui/button.stories.tsx:24; eslint exemption frontend/eslint.config.js:64
- Problem: The *.stories i18n exemption is reasonable (demo-only, not shipped UI). The sample feature component DoelsoortBadge.tsx correctly routes all user-facing copy through t() (doelsoort.*, doelsoortAfkorting.*), so the exemption hides no shipped Dutch strings. But Opslaan is a genuine button label that will be real UI later; fine as story text, must not be copy-pasted into a shipped component without nl.json.
- Required fix: None for E0-09 (acceptable as demo text). Noted to prevent normalising hard-coded Opslaan in shipped UI later.

## Checks run (proof of thoroughness)
- Art. VIII / ADR-0017 stack fidelity: PASS. Button (@radix-ui/react-slot Slot + cva) and Badge in frontend/src/components/ui/, copied in (no runtime registry). cn() = clsx + tailwind-merge in lib/utils.ts. Tokens for all three groups present (doelsoort 6, suggestiestatus 4, dekking 3) in index.css + mirrored in tailwind.config.js via hsl(var(--token) / alpha). React 18, Vite, Tailwind 3.4 retained; no unauthorised framework.
- Art. XII / WCAG 2.2 AA: PASS. jest-axe real and wired (toHaveNoViolations in src/test/setup.ts; DoelsoortBadge.test.tsx asserts await axe(...) over all 6 doelsoort variants + Button, not skipped, runs in pnpm test). Storybook addon-a11y present; preview.ts a11y.test=error. Computed contrast of every token bg vs white: all PASS AA (md 7.10, G 7.42, verdieping 5.07, precurriculum 5.82, specifiek 5.52, anderstalige 5.41, geweigerd 6.47, manueel 7.36, deels 5.41). Colour never sole signal — afkorting text + aria-label always rendered. Doelsoort semantics match glossary (MD blue, G grey, + green, P/S pink, A amber at 30% L so white text stays AA — sound reading of yellow).
- Art. II.3 i18n: PASS. DoelsoortBadge uses t(); new nl.json keys sensible Dutch and correct. i18n mechanism (i18n/index.ts) unchanged. stories exemption reasonable.
- Art. VI secrets: PASS. No key/secret/password/token/connectionstring in new files. Storybook telemetry disabled. No AI-key surface (no backend).
- E0-02 pin preservation: PASS. package.json keeps private:true, pnpm@11.9.0, engines.node >=24, React ^18.3.1.
- Scope discipline: PASS. No kalender/dekkingsoverzicht screens, no backend/Docker/CI, no i18n-mechanism change. Foundation files only.
- Art. III/IV/V/VII/IX: N/A — no domain model, AI client, coverage calc, or Excel mapping touched.
- Art. X DoD: reviewable/focused; gates reported green by implementer (not run by me, read-only); working tree clean.

## Open questions surfaced
- Coverage depth (Art. XIV): does dekking-deels commit to graded coverage? Resolve as documented placeholder or remove.
- lucide-react@1.22.0: confirm version/usage.
- allowBuilds block: confirm intent; recommend removal.

Disposition: No CRITICAL or MAJOR violations. COMPLIANT. Address or explicitly waive the QUESTIONs/MINORs before marking E0-09 done (Art. X.7); none block the foundation.

---

# Fix-round re-audit — E0-09 (commit 9d31f0d atop 15998b2)

Verdict: COMPLIANT
Scope audited: git diff 15998b2..9d31f0d — 7 files (implementation.md worklog, package.json, pnpm-lock.yaml, pnpm-workspace.yaml, badge.tsx, index.css, tailwind.config.js).

## Prior findings — disposition

1. dekking-deels token (Art. IX.3 / Art. XIV): RESOLVED. The --dekking-deels / --dekking-deels-foreground CSS vars (index.css), the dekking.deels Tailwind token (tailwind.config.js), and the deels Badge variant (badge.tsx) are all removed. Tree-wide grep for "deels" returns only the two explanatory comments (index.css:46, tailwind.config.js:48) marking binary-MVP + Art. XIV rationale — no live token/variant remains. Binary gedekt/niet-gedekt correctly preserved.
2. lucide-react unused dep (Art. X.6 / VIII): RESOLVED. Removed from package.json dependencies and from pnpm-lock.yaml (importer entry + both package/snapshot blocks). Grep for "lucide" across the frontend tree returns no matches.
3. allowBuilds placeholder (Art. X.6): RESOLVED. The allowBuilds: { esbuild: set this to true or false } block is gone from pnpm-workspace.yaml; onlyBuiltDependencies: [esbuild] (the effective allow-list) is retained with its explanatory comment intact.

## Regression checks (proof of thoroughness)

- Surviving tokens: PASS. index.css still defines all 6 doelsoort + 4 suggestiestatus token pairs and dekking-gedekt / dekking-niet-gedekt; tailwind.config.js mirrors them. Only deels removed.
- Badge variants: PASS. badge.tsx retains all doelsoort (md/gemeenschappelijk/verdieping/precurriculum/specifiek/anderstalige), all suggestiestatus (voorgesteld/aanvaard/geweigerd/manueel), and gedekt/niet-gedekt. Only deels removed.
- Intact artifacts: PASS. Fix diff touches none of DoelsoortBadge.stories/.test.tsx, button.tsx/.stories.tsx, badge.tsx core, .storybook setup, or src/test/setup.ts. jest-axe smoke test (DoelsoortBadge.test.tsx + setup.ts) untouched. i18n routing (i18n/index.ts, nl.json, eslint *.stories exemption) unchanged.
- Pins (E0-02): PASS. package.json keeps private:true, pnpm@11.9.0, engines.node >=24, React ^18.3.1.
- Scope/secrets: PASS. No new dependency, no new scope, no secret introduced; change is pure cleanup. Smaller than the original (net -23/+35, of which +30 is worklog prose).
- Accepted exemptions unchanged: PASS. *.stories i18n exemption and demo "Opslaan" string deliberately left as-is (previously accepted).

## Open questions surfaced
- None. The three items routed to the open Art. XIV coverage-depth decision are now removed/neutralised; nothing in the change hard-assumes a graded-coverage answer.

Disposition: All three prior address-or-waive items genuinely resolved with no regression. COMPLIANT.
