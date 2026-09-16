import { useInfiniteQuery, useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { del, get, naarQuery, post, put } from "./api";
import type {
  DekkingWeergave,
  Dekkingsbereik,
  Dekkingsvoortgang,
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
  MinimumdoelDetail,
  MinimumdoelFacetten,
  MinimumdoelFilterQuery,
  MinimumdoelenPagina,
  SchooljaarSamenvatting,
  SubthemaBestemming,
  ThemaBibliotheekItem,
  ThemaDoelenoverzicht,
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
  detail: (ref: string) => ["minimumdoel", ref] as const,
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
    leeftijd: filter.leeftijd,
    discipline: filter.discipline,
    domein: filter.domein,
    subdomein: filter.domein ? filter.subdomein : undefined,
    jaarFase: filter.jaarFase,
    // A branch is named from the top (the backend refuses a level without the one above it), so a level is only sent
    // with its parent, as the subdomein is only sent with its domein.
    leergebied: filter.zonderOrdening ? undefined : filter.leergebied,
    rubriek: filter.leergebied && !filter.zonderOrdening ? filter.rubriek : undefined,
    subrubriek: filter.rubriek && filter.leergebied && !filter.zonderSubrubriek ? filter.subrubriek : undefined,
    zonderSubrubriek: filter.rubriek && filter.leergebied && filter.zonderSubrubriek ? true : undefined,
    zonderOrdening: filter.zonderOrdening ? true : undefined,
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

/**
 * The minimumdoelen register, a page at a time (E1-22).
 *
 * Paged because it has to be: after the Op.stap import the register holds one row per minimumdoel and bucket, over a
 * thousand, and the server caps a page at 200. The list used to fetch one page of 200 and stop, which read as "that is
 * all of them" while the count above it said otherwise. The key extends the list key, so an import's invalidation of
 * `minimumdoelen` still reaches it.
 */
export const MINIMUMDOELEN_PAGINA = 200;

export function useMinimumdoelenPaginas(filter: MinimumdoelFilterQuery) {
  return useInfiniteQuery({
    queryKey: [...minimumdoelSleutels.lijst(filter), "paginas"] as const,
    queryFn: ({ pageParam }) =>
      get<MinimumdoelenPagina>(
        `/api/minimumdoelen${minimumdoelQuery({ ...filter, overslaan: pageParam, aantal: MINIMUMDOELEN_PAGINA })}`,
      ),
    initialPageParam: 0,
    getNextPageParam: (laatste) => {
      const volgende = laatste.overslaan + laatste.regels.length;
      return laatste.regels.length > 0 && volgende < laatste.totaal ? volgende : undefined;
    },
  });
}

/** One page of the minimumdoelen register under the filter, for a search that needs no paging. */
export function useMinimumdoelen(filter: MinimumdoelFilterQuery, opties?: { enabled?: boolean }) {
  return useQuery({
    queryKey: minimumdoelSleutels.lijst(filter),
    queryFn: () => get<MinimumdoelenPagina>(`/api/minimumdoelen${minimumdoelQuery(filter)}`),
    enabled: opties?.enabled ?? true,
  });
}

/** One minimumdoel with the leerplandoelen that concord to it per jaar/fase (TB-010). */
export function useMinimumdoel(ref: string | null) {
  return useQuery({
    queryKey: minimumdoelSleutels.detail(ref ?? ""),
    queryFn: () => get<MinimumdoelDetail>(`/api/minimumdoelen/${encodeURIComponent(ref!)}`),
    enabled: ref !== null && ref.length > 0,
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
export function useKlassen(ingeschakeld = true) {
  return useQuery({
    queryKey: ["klassen"],
    queryFn: () => get<KlasWeergave[]>("/api/klassen"),
    staleTime: 5 * 60_000,
    enabled: ingeschakeld,
  });
}

/**
 * The klassen whose ontwikkelingsrapporten this gebruiker may read (FB-008), of every schooljaar: the server asks each
 * K3 klas the report's own read row. Not `useKlassen`, which is the planning's: Leerlingzorg reads no klas's planning,
 * and a hoofdleerkracht of K3 reads no report. Under `["klassen", …]`, so whatever refreshes the klassen refreshes this.
 */
export function useRapportklassen(ingeschakeld = true) {
  return useQuery({
    queryKey: ["klassen", "rapportklassen"],
    queryFn: () => get<KlasWeergave[]>("/api/rapportklassen"),
    staleTime: 5 * 60_000,
    enabled: ingeschakeld,
  });
}

/**
 * The jaar/fase codes a klas may teach: JK, K2, K3 and L1 to L6.
 *
 * **Its own endpoint, and not read off a klas, because a form needs the list before the first klas exists.** They
 * used to be taken from `KlasWeergave.mogelijkeJaarfasen`, which works while editing a klas and fails on a fresh
 * school: with no klas to read them off, the leeftijd field offered nothing, disabled itself and made creating a
 * klas impossible. The same hole made the subthema form dead until a klas existed, which is a dependency a subthema
 * does not have any more.
 *
 * Reference data that changes when the curriculum does, so it is cached for the session rather than refetched.
 */
export function useJaarfasen() {
  return useQuery({
    queryKey: ["jaarfasen"],
    queryFn: () => get<string[]>("/api/jaarfasen"),
    staleTime: Infinity,
  });
}

/**
 * Recording which jaar/fase a klas actually teaches.
 *
 * `PUT /api/klassen/{id}` replaces the whole class, so naam and leerjaar are sent back unchanged rather than omitted:
 * leaving them out would rename the class to nothing and the server would refuse it. The caller therefore hands over
 * the class it read, not a patch.
 *
 * **The dekking has to be invalidated with it, and that is the point of the mutation.** The jaar/fase IS the
 * denominator: `Dekkingsbereik.EigenJaarFase` measures against `Jaarfasen.VoorKlas`, so a class that goes from "een
 * kleutergroep" to K3 goes from 1288 goals to its own few hundred in the same breath. A bar left showing the old
 * fraction would look like the save had not worked.
 */
export function useWijzigKlas() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({ klas, jaarfase }: { klas: KlasWeergave; jaarfase: string | null }) =>
      // No leerjaar: it left KlasCreatie on 2026-08-30 and is derived from the jaarfase server-side. Sending
      // it was harmless to the binder and read as if it were still settable, which is worse than useless in a
      // payload someone will copy.
      put<KlasWeergave>(`/api/klassen/${klas.id}`, {
        naam: klas.naam,
        jaarfase,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["klassen"] });
      void qc.invalidateQueries({ queryKey: ["dekking"] });
    },
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

/**
 * The doelen a thema reaches per leeftijd (FB-009). Under the thema's own key, so every write that refreshes the thema
 * (a prefix invalidation of `themaSleutels.detail`) refreshes this too, and it can never lag the lists beside it.
 */
export function useThemaDoelenoverzicht(themaId: string | undefined) {
  return useQuery({
    queryKey: [...themaSleutels.detail(themaId ?? ""), "doelenoverzicht"] as const,
    queryFn: () => get<ThemaDoelenoverzicht>(`/api/themas/${themaId}/doelenoverzicht`),
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
 * Asks the model which minimumdoelen fit one thema as themadoel (FR-4.1, FB-053), among those of the mijlpalen the given
 * leeftijden meet.
 *
 * Everything it returns lands as `Voorgesteld` and nothing is applied (Art. IV): the mutation refreshes the suggestion
 * list, and a person decides one by one.
 *
 * An empty list sends no choice, and the server then takes the leeftijden of the thema's subthema's (TB-007); the
 * screen sends one only when it knows the jaarfasen to offer.
 */
export function useGenereerDoelsuggesties(themaId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (jaarFasen: string[]) =>
      post<DoelMatchResultaat>(
        `/api/themas/${themaId}/doelsuggesties/genereer`,
        jaarFasen.length > 0 ? { jaarFasen } : {},
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: themaSleutels.suggesties(themaId) });
    },
  });
}

/**
 * Records the verdict on one proposal: `Aanvaard` makes its minimumdoel a themadoel of the thema, `Geweigerd` keeps it
 * from being proposed again. The verdict is the point, so it is persisted.
 */
export function useBeoordeelSuggestie(themaId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ suggestieId, status }: { suggestieId: string; status: KoppelingStatus }) =>
      put<DoelMatchSuggestie>(`/api/themas/${themaId}/doelsuggesties/${suggestieId}/status`, { status }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: themaSleutels.suggesties(themaId) });
      // Accepting one adds a themadoel to the thema, which the thema's own read carries.
      void qc.invalidateQueries({ queryKey: themaSleutels.detail(themaId) });
      // A new themadoel moves the minimumdoel figures of every klas that plans the thema.
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

/**
 * The same coverage, as counts only, for the bar at the top of the agenda.
 *
 * Keyed UNDER "dekking" on purpose: every writer in this app already invalidates that prefix, so the
 * bar refreshes with the screen rather than needing every one of them to learn a second key.
 */
export function useDekkingsvoortgang(klasId: string | null, bereik: Dekkingsbereik) {
  return useQuery({
    queryKey: ["dekking", "voortgang", klasId, bereik],
    queryFn: () => get<Dekkingsvoortgang>(`/api/klassen/${klasId}/dekking/voortgang${naarQuery({ bereik })}`),
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

/**
 * Marks off a stretch of days for a subthema, so its band survives having fewer activiteiten than days.
 *
 * Its own hook rather than a fifth member of `useDagacties`: those four all move ONE activiteit and share an
 * invalidation because they share a consequence. This moves no activiteit at all, and it has to invalidate every
 * weekplanning range rather than one day's, because a window can reach into months the current view is not showing.
 */
export function usePlaatsSubthemaperiode(klasId: string | null) {
  const client = useQueryClient();

  return useMutation({
    mutationFn: ({ subthemaId, van, tot }: { subthemaId: string; van: string; tot: string }) =>
      post<Weekplanning>(`/api/klassen/${klasId}/jaarplan/subthemaperiodes`, { subthemaId, van, tot }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ["weekplanning"] });
    },
  });
}

/**
 * Every subthema at an age this klas teaches, each named with its thema (FB-017): what the agenda's activiteiten list
 * offers to choose from. Under the `thema-bibliotheek` family on purpose: a new, renamed or deleted subthema goes
 * through `useSchoolcontentMutatie`, which invalidates that family, so the list cannot go on offering one that is gone.
 */
export function useSubthemaBestemmingen(klasId: string | null) {
  return useQuery({
    queryKey: [...themaSleutels.bibliotheek(), "bestemmingen", klasId],
    queryFn: () => get<SubthemaBestemming[]>(`/api/subthemas/voor-klas/${klasId}`),
    enabled: Boolean(klasId),
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

  // The times travel as `HH:mm:ss`, which is what the server binds a TimeOnly from. No default for either: since
  // ADR-0028 a placement without a time is not a state the plan can hold, and a fallback here would be this file
  // deciding a teacher's hour.
  const plaats = useMutation({
    mutationFn: ({
      activiteitId,
      datum,
      begin,
      einde,
    }: {
      activiteitId: string;
      datum: string;
      begin: string;
      einde: string;
    }) => post<Weekplanning>(basis, { activiteitId, datum, begin, einde }),
    onSuccess: ververs,
  });

  const verplaats = useMutation({
    mutationFn: ({
      plaatsingId,
      datum,
      begin,
      einde,
    }: {
      plaatsingId: string;
      datum: string;
      begin: string;
      einde: string;
    }) => put<Weekplanning>(`${basis}/${plaatsingId}/dag`, { datum, begin, einde }),
    onSuccess: ververs,
  });

  const verwijder = useMutation({
    mutationFn: (plaatsingId: string) => del<void>(`${basis}/${plaatsingId}`),
    onSuccess: ververs,
  });

  return { plaats, verplaats, verwijder };
}
