import { useMutation, useQuery, useQueryClient, type QueryKey } from "@tanstack/react-query";

import { ApiError } from "../../lib/api";

import { DEKKING_KEY } from "../dekking/useDekking";
import { ONGEKOPPELDE_DOELEN_KEY } from "../matching/useDoelsuggesties";
import {
  haalThemaBibliotheek,
  haalThemaVoorKlas,
  koppelActiviteitAanDoel,
  koppelSubthemaAanDoel,
  maakActiviteit,
  maakSubthema,
  maakThema,
  ontkoppelActiviteitDoel,
  ontkoppelSubdoel,
  verwijderActiviteit,
  verwijderSubthema,
  verwijderThema,
  verwijderThemadoel,
  voegThemadoelToe,
  wijzigActiviteit,
  wijzigSubthema,
  wijzigThema,
} from "./api";
import type { ActiviteitInvoer, SubthemaInvoer, ThemaInvoer } from "./types";

/**
 * Server state for the beheer screens (E1-14; ADR-0014 — TanStack Query owns caching and invalidation).
 *
 * **Every write goes through {@link useBeheerMutatie}, which invalidates one fixed set of keys.** That is a
 * deliberate choice over per-mutation invalidation lists: eleven mutations each naming their own keys is
 * eleven chances to forget the gap list, and a forgotten invalidation shows up as a screen that is quietly
 * one edit behind rather than as a failure. The set is small enough to be safe and cheap:
 *
 * 1. **The thema queries** (`["thema", …]`, prefix-matched). Every level lives inside the thema aggregate, so
 *    adding an activiteit changes the thema that owns it. Prefix matching also catches the per-klas variant.
 * 2. **The bibliotheek list**, because it carries the derived numbers a write can move: the themadoel count,
 *    `heeftVoldoendeThemadoelen`, and `aantalAfgeleideKlassen` when a class's first subthema appears.
 * 3. **The ongekoppelde-doelen gap list** (E2-06, FR-4.4), because a manual link is a link: coupling a doel
 *    here must remove it from "nog niet gekoppeld", and unlinking must put it back.
 * 4. **The dekking queries** (E4-01). A link change moves coverage (Art. V.1), and the whole `["dekking"]`
 *    subtree goes rather than one class's: a themadoel hangs on a **school-wide** thema, so it can change the
 *    figure of every class that has that thema in its plan, including classes this teacher never opens.
 *    Dropped rather than invalidated, for the reason spelled out on {@link DEKKING_KEY} and in
 *    `jaarplan/useJaarplan.ts`: an invalidated entry is still painted while its refetch is in flight, so
 *    `/dekking` would open on a figure from before this edit.
 *    > **This fires on every write through this hook, not only on a link change** (round-2 audit, MINOR 11): a
 *    > rename, a new subthema and an edited activiteit drop every class's figure too, and most of them cannot have
 *    > moved it. Deliberate, on the same reasoning as the fixed invalidation set above: eleven mutations each
 *    > deciding whether *their* write touched a `DoelKoppeling` is eleven chances to decide wrong, and the cost of
 *    > being wrong is asymmetric. A needless drop costs one loading line on a screen the teacher then opens; a
 *    > missed drop is a coverage figure that is quietly wrong (Art. V.2). The cost is real and is recorded in the
 *    > story rather than left to be discovered.
 *
 * > *This is the fourth item because it was written down as owed and then not done.* The paragraph here used to
 * > read *"no dekking query exists in the frontend yet — E5-02 builds the screen. Whoever adds it should add its
 * > key here"*. E5-02 shipped the query on 2026-08-04 and E4-01 exported its key the same day, so the sentence
 * > became false and the obligation stayed unmet, which the E4-01 **test-runner** then reproduced from `/themas`
 * > in a browser: link `DEMO-L3-02`, walk back through the nav, and the overview paints the pre-link figure with
 * > that doel still marked *Niet gedekt*. A note that names its own successor only works if the successor reads
 * > it.
 */

/** Query key for the school-wide bibliotheek list. */
const bibliotheekKey = ["thema-bibliotheek"] as const;

/**
 * Query key for one thema **as derived for one klas**.
 *
 * The klas id is part of the key because the response differs per class (Art. IX.2, no cross-class bleed): one
 * cache entry per thema would serve one class's subthema's to another. It starts with `"thema"` so a single
 * prefix invalidation reaches every class's entry, which is what a school-wide edit requires.
 */
const themaVoorKlasKey = (themaId: string, klasId: string) => ["thema", themaId, "klas", klasId] as const;

/** The prefix every thema-shaped query shares, and therefore the one invalidation that reaches all of them. */
const THEMA_PREFIX = ["thema"] as const;

/** The school-wide thema-bibliotheek: naam, duur, woordenschat, themadoelen, uptake per thema. */
export function useThemaBibliotheek() {
  return useQuery({
    queryKey: bibliotheekKey,
    queryFn: () => haalThemaBibliotheek(),
  });
}

/**
 * One thema as derived for one klas: the shared thema plus **only that class's** subthema's (Art. IX.2).
 *
 * Disabled until both ids are present, which is why the class-scoped half of the detail can ask for it
 * unconditionally and still render "kies eerst een klas" rather than a spinner: with no klas there is no
 * request, and the screen has nothing to wait for.
 */
export function useThemaVoorKlas(themaId: string | undefined, klasId: string | undefined) {
  return useQuery({
    queryKey: themaVoorKlasKey(themaId ?? "", klasId ?? ""),
    queryFn: () => haalThemaVoorKlas(themaId!, klasId!),
    enabled: Boolean(themaId) && Boolean(klasId),
    // A deep link to a deleted thema is a 404, and retrying three times only delays the honest answer.
    retry: false,
  });
}

/**
 * The one mutation wrapper every write uses. `mutationFn` is the only thing that varies; the invalidation set
 * is fixed (see the module comment) so no call site can ship a shorter one.
 */
function useBeheerMutatie<TVars, TResult>(
  mutationFn: (vars: TVars) => Promise<TResult>,
  opties: { verversOok404?: boolean } = {},
) {
  const queryClient = useQueryClient();

  function verversAlles() {
    for (const key of [THEMA_PREFIX, bibliotheekKey, ONGEKOPPELDE_DOELEN_KEY] as QueryKey[]) {
      void queryClient.invalidateQueries({ queryKey: key });
    }

    // Item 4 above: dropped, not invalidated, and school-wide rather than per klas.
    queryClient.removeQueries({ queryKey: DEKKING_KEY });
  }

  return useMutation({
    mutationFn,
    onSuccess: verversAlles,
    /**
     * **A 404 on a delete has to refresh the screen too** (antagonist round 3, MAJOR 1).
     *
     * Round 2 taught the two class-level deletes to say *"iemand anders heeft het verwijderd"* on a 404
     * instead of reporting a failure. That was half the fix: the message appeared while the record stayed on
     * screen with its subdoelen, its activiteiten and an **enabled** confirm button that could only reproduce
     * the same 404. One panel asserting a record is gone beside a control offering to delete it is the
     * contradiction that reopened E3-07 by owner ruling.
     *
     * Landing 1 did this correctly and the copied comment claimed to match it: at thema level a 404 navigates
     * back to the list, so the message is suppressed **and acted on**. There is no list to navigate to at these
     * levels, so acting means refreshing: the record disappears exactly as it does after a successful delete,
     * and the caller's own `onError` closes the panel.
     */
    onError: (fout) => {
      if (opties.verversOok404 && fout instanceof ApiError && fout.status === 404) {
        verversAlles();
      }
    },
  });
}

// --- Thema (school-wide, Art. IX.2) ---

export function useMaakThema() {
  return useBeheerMutatie((invoer: ThemaInvoer) => maakThema(invoer));
}

export function useWijzigThema() {
  return useBeheerMutatie((vars: { themaId: string; invoer: ThemaInvoer }) =>
    wijzigThema(vars.themaId, vars.invoer),
  );
}

/**
 * Delete a thema and everything under it.
 *
 * The server refuses with a 400 while the thema still sits in any jaarplan, and the caller renders that
 * refusal: only the server knows how many placements there are, and they may belong to a class the deleting
 * teacher never opens. So this mutation's error state is a normal outcome to be shown, not an exception.
 *
 * **It does not use {@link useBeheerMutatie}, and the reason came out of a browser pass rather than a test.**
 * Invalidating the `["thema"]` prefix asks every mounted thema query to refetch, including the one for the
 * thema just deleted, so the class-scoped read fired again and answered **404** while the screen was still
 * navigating away. Nothing was visible on a fast local connection, which is exactly why it needed fixing
 * rather than accepting: one slower request and a teacher reads "Dit thema kon niet geladen worden"
 * immediately after a delete that in fact succeeded.
 *
 * So a delete refreshes **only the two lists that changed** and deliberately leaves the deleted thema's own
 * cache entries alone. `removeQueries` was the first fix and it was the wrong one: removing a query that still
 * has a mounted observer makes that observer fetch again immediately, so it reproduced the very 404 it was
 * meant to prevent. Leaving a stale entry for a thema nothing will mount again costs nothing, and a fresh
 * visit to that URL is answered from the bibliotheek with "dit thema bestaat niet".
 *
 * **It also does not drop the dekking cache, and that is a claim about the server rather than an omission**
 * (E4-01): the delete is refused while the thema sits in *any* jaarplan, and a thema in no jaarplan covers
 * nothing (Art. V.1 counts placed thema's only). So a delete that succeeded cannot have moved any figure. If
 * that guard is ever relaxed, this is one of the places that has to change with it.
 */
export function useVerwijderThema() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (themaId: string) => verwijderThema(themaId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: bibliotheekKey });
      void queryClient.invalidateQueries({ queryKey: ONGEKOPPELDE_DOELEN_KEY });
    },
  });
}

export function useVoegThemadoelToe() {
  return useBeheerMutatie((vars: { themaId: string; leerplandoelCode: string }) =>
    voegThemadoelToe(vars.themaId, vars.leerplandoelCode),
  );
}

export function useVerwijderThemadoel() {
  return useBeheerMutatie((vars: { themaId: string; themadoelId: string }) =>
    verwijderThemadoel(vars.themaId, vars.themadoelId),
  );
}

// --- Subthema (per klas & leeftijd) ---

export function useMaakSubthema() {
  return useBeheerMutatie((vars: { themaId: string; invoer: SubthemaInvoer }) =>
    maakSubthema(vars.themaId, vars.invoer),
  );
}

export function useWijzigSubthema() {
  return useBeheerMutatie((vars: { subthemaId: string; invoer: SubthemaInvoer }) =>
    wijzigSubthema(vars.subthemaId, vars.invoer),
  );
}

export function useVerwijderSubthema() {
  return useBeheerMutatie((vars: { subthemaId: string }) => verwijderSubthema(vars.subthemaId), {
    verversOok404: true,
  });
}

export function useKoppelSubthemaAanDoel() {
  return useBeheerMutatie((vars: { subthemaId: string; leerplandoelCode: string }) =>
    koppelSubthemaAanDoel(vars.subthemaId, vars.leerplandoelCode),
  );
}

export function useOntkoppelSubdoel() {
  return useBeheerMutatie((vars: { subthemaId: string; subdoelId: string }) =>
    ontkoppelSubdoel(vars.subthemaId, vars.subdoelId),
  );
}

// --- Activiteit (inherits its subthema's scope) ---

export function useMaakActiviteit() {
  return useBeheerMutatie((vars: { subthemaId: string; invoer: ActiviteitInvoer }) =>
    maakActiviteit(vars.subthemaId, vars.invoer),
  );
}

export function useWijzigActiviteit() {
  return useBeheerMutatie((vars: { activiteitId: string; invoer: ActiviteitInvoer }) =>
    wijzigActiviteit(vars.activiteitId, vars.invoer),
  );
}

export function useVerwijderActiviteit() {
  return useBeheerMutatie((vars: { activiteitId: string }) => verwijderActiviteit(vars.activiteitId), {
    verversOok404: true,
  });
}

export function useKoppelActiviteitAanDoel() {
  return useBeheerMutatie((vars: { activiteitId: string; leerplandoelCode: string }) =>
    koppelActiviteitAanDoel(vars.activiteitId, vars.leerplandoelCode),
  );
}

export function useOntkoppelActiviteitDoel() {
  return useBeheerMutatie((vars: { activiteitId: string; koppelingId: string }) =>
    ontkoppelActiviteitDoel(vars.activiteitId, vars.koppelingId),
  );
}
