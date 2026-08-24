import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { del, get, naarQuery, post, put } from "./api";
import type {
  DekkingWeergave,
  Dekkingsbereik,
  DoelMatchResultaat,
  DoelMatchSuggestie,
  JaarplanGeneratieResultaat,
  JaarplanWeergave,
  KlasWeergave,
  KoppelingStatus,
  Planningsrooster,
  LeerplandoelDetail,
  LeerplandoelFacetten,
  LeerplandoelFilterQuery,
  LeerplandoelenPagina,
  MinimumdoelFacetten,
  MinimumdoelFilterQuery,
  MinimumdoelenPagina,
  SchooljaarSamenvatting,
  ThemaBibliotheekItem,
  ThemaWeergave,
  Weekplanning,
} from "./types";

/**
 * Server state for the curriculum screens.
 *
 * Query keys mirror the request exactly, so two components asking the same question share one
 * request and a filter change is a new key rather than a manual invalidation.
 */

export const doelenSleutels = {
  facetten: (filter: LeerplandoelFilterQuery) => ["leerplandoel-facetten", filter] as const,
  lijst: (filter: LeerplandoelFilterQuery) => ["leerplandoelen", filter] as const,
  detail: (code: string) => ["leerplandoel", code] as const,
};

export const minimumdoelSleutels = {
  facetten: (filter: MinimumdoelFilterQuery) => ["minimumdoel-facetten", filter] as const,
  lijst: (filter: MinimumdoelFilterQuery) => ["minimumdoelen", filter] as const,
};

function doelenQuery(filter: LeerplandoelFilterQuery): string {
  return naarQuery({
    zoek: filter.zoek,
    discipline: filter.discipline,
    domein: filter.domein,
    // The backend refuses a subdomein without its domein (subdomein names are not globally unique,
    // Art. VII.0), so never send one on its own: that would be a 400 the teacher cannot act on.
    subdomein: filter.domein ? filter.subdomein : undefined,
    doelsoort: filter.doelsoort,
    jaarFase: filter.jaarFase,
    overslaan: filter.overslaan,
    aantal: filter.aantal,
  });
}

function minimumdoelQuery(filter: MinimumdoelFilterQuery): string {
  return naarQuery({
    zoek: filter.zoek,
    discipline: filter.discipline,
    domein: filter.domein,
    subdomein: filter.domein ? filter.subdomein : undefined,
    jaarFase: filter.jaarFase,
    overslaan: filter.overslaan,
    aantal: filter.aantal,
  });
}

/**
 * The filter vocabulary for the current filter.
 *
 * Also the source of the browse tree, and the reason this hook is called per level rather than
 * once: the response's `domeinen` is a FLAT list scoped by whatever filter was sent, not a list
 * nested under `disciplines`. Asking once without a discipline and rendering the result under every
 * discipline is what the previous frontend did, and it put Muziek and Getallen under Nederlands
 * with school-wide counts. Every level asks for its own scope instead.
 */
export function useLeerplandoelFacetten(filter: LeerplandoelFilterQuery, opties?: { enabled?: boolean }) {
  return useQuery({
    queryKey: doelenSleutels.facetten(filter),
    queryFn: () => get<LeerplandoelFacetten>(`/api/leerplandoelen/facetten${doelenQuery(filter)}`),
    enabled: opties?.enabled ?? true,
  });
}

export function useLeerplandoelen(filter: LeerplandoelFilterQuery, opties?: { enabled?: boolean }) {
  return useQuery({
    queryKey: doelenSleutels.lijst(filter),
    queryFn: () => get<LeerplandoelenPagina>(`/api/leerplandoelen${doelenQuery(filter)}`),
    enabled: opties?.enabled ?? true,
  });
}

export function useLeerplandoel(code: string | null) {
  return useQuery({
    queryKey: doelenSleutels.detail(code ?? ""),
    queryFn: () => get<LeerplandoelDetail>(`/api/leerplandoelen/${encodeURIComponent(code!)}`),
    enabled: code !== null && code.length > 0,
  });
}

export function useMinimumdoelFacetten(filter: MinimumdoelFilterQuery, opties?: { enabled?: boolean }) {
  return useQuery({
    queryKey: minimumdoelSleutels.facetten(filter),
    queryFn: () => get<MinimumdoelFacetten>(`/api/minimumdoelen/facetten${minimumdoelQuery(filter)}`),
    enabled: opties?.enabled ?? true,
  });
}

export function useMinimumdoelen(filter: MinimumdoelFilterQuery, opties?: { enabled?: boolean }) {
  return useQuery({
    queryKey: minimumdoelSleutels.lijst(filter),
    queryFn: () => get<MinimumdoelenPagina>(`/api/minimumdoelen${minimumdoelQuery(filter)}`),
    enabled: opties?.enabled ?? true,
  });
}

// --- Selection context ---

export function useSchooljaren() {
  return useQuery({
    queryKey: ["schooljaren"],
    queryFn: () => get<SchooljaarSamenvatting[]>("/api/schooljaren"),
    staleTime: 5 * 60_000,
  });
}

/**
 * Every klas, across school years.
 *
 * `/api/schooljaren/{id}/klassen` looks like the scoped version of this and is NOT: that route is
 * POST only, for creating a klas, and a GET against it answers 405. Measured, not assumed. Each klas
 * carries its own `schooljaarId`, so the caller narrows to one school year itself.
 */
export function useKlassen() {
  return useQuery({
    queryKey: ["klassen"],
    queryFn: () => get<KlasWeergave[]>("/api/klassen"),
    staleTime: 5 * 60_000,
  });
}

// --- Schoolcontent ---

export const themaSleutels = {
  bibliotheek: () => ["thema-bibliotheek"] as const,
  detail: (id: string) => ["thema", id] as const,
  suggesties: (id: string) => ["doelsuggesties", id] as const,
};

export function useThemabibliotheek() {
  return useQuery({
    queryKey: themaSleutels.bibliotheek(),
    queryFn: () => get<ThemaBibliotheekItem[]>("/api/themas/bibliotheek"),
  });
}

export function useThema(themaId: string | undefined) {
  return useQuery({
    queryKey: themaSleutels.detail(themaId ?? ""),
    queryFn: () => get<ThemaWeergave>(`/api/themas/${themaId}`),
    enabled: Boolean(themaId),
  });
}

export function useDoelsuggesties(themaId: string | undefined) {
  return useQuery({
    queryKey: themaSleutels.suggesties(themaId ?? ""),
    queryFn: () => get<DoelMatchSuggestie[]>(`/api/themas/${themaId}/doelsuggesties`),
    enabled: Boolean(themaId),
  });
}

/**
 * Asks the model for goal matches on one thema (FR-4.1).
 *
 * Everything it returns lands as `Voorgesteld` and nothing is applied (Art. IV): the mutation
 * refreshes the suggestion list and the thema, and the teacher decides one by one.
 */
export function useGenereerDoelsuggesties(themaId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => post<DoelMatchResultaat>(`/api/themas/${themaId}/doelsuggesties/genereer`, {}),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: themaSleutels.suggesties(themaId) });
      void qc.invalidateQueries({ queryKey: themaSleutels.detail(themaId) });
    },
  });
}

/** Records the teacher's verdict on one suggestion. The verdict is the point, so it is persisted. */
export function useBeoordeelSuggestie(themaId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ suggestieId, status }: { suggestieId: string; status: KoppelingStatus }) =>
      put<DoelMatchSuggestie>(`/api/themas/${themaId}/doelsuggesties/${suggestieId}/status`, { status }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: themaSleutels.suggesties(themaId) });
      void qc.invalidateQueries({ queryKey: themaSleutels.detail(themaId) });
      // Accepting a suggestion can make a leerplandoel covered, so the coverage figures move too.
      void qc.invalidateQueries({ queryKey: ["dekking"] });
    },
  });
}

// --- Jaarplan ---

export const jaarplanSleutels = {
  plan: (klasId: string) => ["jaarplan", klasId] as const,
  rooster: (schooljaarId: string, niveau: string) => ["rooster", schooljaarId, niveau] as const,
};

export function useJaarplan(klasId: string | null) {
  return useQuery({
    queryKey: jaarplanSleutels.plan(klasId ?? ""),
    queryFn: () => get<JaarplanWeergave>(`/api/klassen/${klasId}/jaarplan`),
    enabled: Boolean(klasId),
  });
}

export function useRooster(schooljaarId: string | null, niveau = "Themaperiode") {
  return useQuery({
    queryKey: jaarplanSleutels.rooster(schooljaarId ?? "", niveau),
    queryFn: () => get<Planningsrooster>(`/api/schooljaren/${schooljaarId}/rooster${naarQuery({ niveau })}`),
    enabled: Boolean(schooljaarId),
    staleTime: 5 * 60_000,
  });
}

/**
 * The four ways a teacher changes one placement, behind one hook.
 *
 * They share an invalidation because they share a consequence: every one of them can change which
 * leerplandoelen the plan covers, so the dekking figures are refetched alongside the plan. Doing it
 * here rather than at four call sites is what keeps a fifth caller from forgetting.
 */
export function usePlaatsingacties(klasId: string) {
  const qc = useQueryClient();
  const ververs = () => {
    void qc.invalidateQueries({ queryKey: jaarplanSleutels.plan(klasId) });
    void qc.invalidateQueries({ queryKey: ["dekking"] });
  };

  const beoordeel = useMutation({
    mutationFn: ({ plaatsingId, status }: { plaatsingId: string; status: KoppelingStatus }) =>
      put<JaarplanWeergave>(`/api/klassen/${klasId}/jaarplan/plaatsingen/${plaatsingId}/status`, { status }),
    onSuccess: ververs,
  });

  const vergrendel = useMutation({
    mutationFn: ({ plaatsingId, vergrendeld }: { plaatsingId: string; vergrendeld: boolean }) =>
      put<JaarplanWeergave>(`/api/klassen/${klasId}/jaarplan/plaatsingen/${plaatsingId}/vergrendeling`, { vergrendeld }),
    onSuccess: ververs,
  });

  const verplaats = useMutation({
    mutationFn: ({ plaatsingId, blokStart }: { plaatsingId: string; blokStart: string }) =>
      put<JaarplanWeergave>(`/api/klassen/${klasId}/jaarplan/plaatsingen/${plaatsingId}/blok`, { blokStart }),
    onSuccess: ververs,
  });

  const verwijder = useMutation({
    mutationFn: (plaatsingId: string) => del<void>(`/api/klassen/${klasId}/jaarplan/plaatsingen/${plaatsingId}`),
    onSuccess: ververs,
  });

  return { beoordeel, vergrendel, verplaats, verwijder };
}

/**
 * Puts one thema into one period by hand (FR-7.1).
 *
 * It lands as `Manueel`, which is the whole point: the teacher decided it, so there is no proposal
 * for anyone to review, and a regeneration leaves it alone (Art. IX.3).
 */
export function usePlaatsThema(klasId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ themaId, blokStart }: { themaId: string; blokStart: string }) =>
      post<JaarplanWeergave>(`/api/klassen/${klasId}/jaarplan/plaatsingen`, { themaId, blokStart }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: jaarplanSleutels.plan(klasId) });
      void qc.invalidateQueries({ queryKey: ["dekking"] });
    },
  });
}

/**
 * Generates a year plan (FR-5).
 *
 * A run discards only placements that are still `Voorgesteld` and unlocked; anything the teacher has
 * decided on survives (Art. IX.3). That is the server's rule, not this hook's, and the screen states
 * it before the teacher presses the button.
 */
export function useGenereerJaarplan(klasId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => post<JaarplanGeneratieResultaat>(`/api/klassen/${klasId}/jaarplan/generatie`, {}),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: jaarplanSleutels.plan(klasId) });
      void qc.invalidateQueries({ queryKey: ["dekking"] });
    },
  });
}

// --- Dekking ---

export function useDekking(klasId: string | null, bereik: Dekkingsbereik) {
  return useQuery({
    queryKey: ["dekking", klasId, bereik],
    queryFn: () => get<DekkingWeergave>(`/api/klassen/${klasId}/dekking${naarQuery({ bereik })}`),
    enabled: Boolean(klasId),
  });
}

// --- Weekplanning (day level) ---

export const weekplanningSleutel = (klasId: string, van: string, tot: string) =>
  ["weekplanning", klasId, van, tot] as const;

export function useWeekplanning(klasId: string | null, van: string, tot: string) {
  return useQuery({
    queryKey: weekplanningSleutel(klasId ?? "", van, tot),
    queryFn: () => get<Weekplanning>(`/api/klassen/${klasId}/jaarplan/weekplanning${naarQuery({ van, tot })}`),
    enabled: Boolean(klasId) && van.length > 0 && tot.length > 0,
  });
}

/** One thema as it exists for one class: only that class's subthema's, with their activiteiten. */
export function useThemaVoorKlas(themaId: string, klasId: string | null) {
  return useQuery({
    queryKey: ["thema-voor-klas", themaId, klasId],
    queryFn: () => get<ThemaWeergave>(`/api/themas/${themaId}/voor-klas/${klasId}`),
    enabled: Boolean(themaId) && Boolean(klasId),
  });
}

/**
 * Several thema's at once, each scoped to one class.
 *
 * `useQueries` rather than a loop of `useThemaVoorKlas`, because the number of thema's planned in a
 * period is data and a hook count may not be. The set is small by construction: it is the thema's
 * of ONE period, not of the year.
 */
export function useThemasVoorKlas(themaIds: string[], klasId: string | null) {
  const resultaten = useQueries({
    queries: themaIds.map((themaId) => ({
      queryKey: ["thema-voor-klas", themaId, klasId],
      queryFn: () => get<ThemaWeergave>(`/api/themas/${themaId}/voor-klas/${klasId}`),
      enabled: Boolean(klasId),
    })),
  });
  return {
    themas: resultaten.map((r) => r.data).filter((t): t is ThemaWeergave => t !== undefined),
    laadt: resultaten.some((r) => r.isPending),
  };
}

/**
 * Scheduling an activiteit onto a day, moving it, and taking it off again.
 *
 * Every one of the three invalidates the whole weekplanning family rather than one date range: a
 * move takes an activiteit out of one week and puts it in another, and the week it left is usually
 * not the week on screen.
 */
export function useDagacties(klasId: string) {
  const qc = useQueryClient();
  const ververs = () => {
    void qc.invalidateQueries({ queryKey: ["weekplanning"] });
    void qc.invalidateQueries({ queryKey: ["dekking"] });
  };
  const basis = `/api/klassen/${klasId}/jaarplan/weekplanning`;

  const plaats = useMutation({
    mutationFn: ({ activiteitId, datum, volgorde }: { activiteitId: string; datum: string; volgorde?: number }) =>
      post<Weekplanning>(basis, { activiteitId, datum, volgorde: volgorde ?? 0 }),
    onSuccess: ververs,
  });

  const verplaats = useMutation({
    mutationFn: ({ plaatsingId, datum, volgorde }: { plaatsingId: string; datum: string; volgorde?: number }) =>
      put<Weekplanning>(`${basis}/${plaatsingId}/dag`, { datum, volgorde: volgorde ?? 0 }),
    onSuccess: ververs,
  });

  const verwijder = useMutation({
    mutationFn: (plaatsingId: string) => del<void>(`${basis}/${plaatsingId}`),
    onSuccess: ververs,
  });

  return { plaats, verplaats, verwijder };
}
