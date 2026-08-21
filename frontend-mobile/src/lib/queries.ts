/**
 * TanStack Query hooks over the shared backend, grouped by resource. Mutations invalidate the
 * query keys that could have changed rather than optimistically patching the cache — this app
 * favours a always-refetch-and-show-the-server-truth policy, since dekking/AI state changes
 * server-side in ways a client should never predict (Art. IV.1).
 */
import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { del, get, post, put } from "./api";
import type {
  ActiviteitCreatie,
  ActiviteitWeergave,
  ActiviteitWijziging,
  Dekkingsbereik,
  DekkingWeergave,
  DoelKoppelingWeergave,
  DoelMatchResultaat,
  JaarplanGeneratieParameters,
  JaarplanGeneratieResultaat,
  JaarplanWeergave,
  KlasCreatie,
  KlasWeergave,
  KoppelingStatus,
  LeerdoelSelectie,
  LeerplandoelDetail,
  LeerplandoelenPagina,
  LeerplandoelFacetten,
  LeerplandoelFilterQuery,
  MinimumdoelenPagina,
  MinimumdoelFacetten,
  MinimumdoelFilterQuery,
  OnderzoeksvraagInvoer,
  OnderzoeksvraagWeergave,
  OngekoppeldDoelWeergave,
  PlanningsroosterWeergave,
  SchooljaarWeergave,
  SubthemaBestemming,
  SubthemaCreatie,
  SubthemaOpbouwContext,
  SubthemaWeergave,
  SubthemaWijziging,
  ThemaBibliotheekItem,
  ThemaCreatie,
  ThemaOpbouwAdviesResultaat,
  ThemaOpbouwContext,
  ThemaWeergave,
  ThemaWijziging,
} from "./types";

function toQuery(params: Record<string, string | number | undefined>): string {
  const zoek = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") zoek.set(key, String(value));
  }
  const tekst = zoek.toString();
  return tekst.length > 0 ? `?${tekst}` : "";
}

// --- Schooljaren / Klassen ---

export const schooljarenKeys = { alle: ["schooljaren"] as const };
export function useSchooljaren() {
  return useQuery({
    queryKey: schooljarenKeys.alle,
    queryFn: () => get<SchooljaarWeergave[]>("/api/schooljaren"),
  });
}

export function useRooster(schooljaarId: string | undefined, niveau: "Themaperiode" | "Subthemaperiode") {
  return useQuery({
    queryKey: ["rooster", schooljaarId, niveau],
    queryFn: () => get<PlanningsroosterWeergave>(`/api/schooljaren/${schooljaarId}/rooster${toQuery({ niveau })}`),
    enabled: !!schooljaarId,
  });
}

export const klassenKeys = { alle: ["klassen"] as const };
export function useKlassen() {
  return useQuery({ queryKey: klassenKeys.alle, queryFn: () => get<KlasWeergave[]>("/api/klassen") });
}

export function useMaakKlas(schooljaarId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (creatie: KlasCreatie) => post<KlasWeergave>(`/api/schooljaren/${schooljaarId}/klassen`, creatie),
    onSuccess: () => qc.invalidateQueries({ queryKey: klassenKeys.alle }),
  });
}

// --- Leerplandoelen (Doelen register) ---

export function useLeerplandoelen(filter: LeerplandoelFilterQuery, opties?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ["leerplandoelen", filter],
    queryFn: () =>
      get<LeerplandoelenPagina>(
        `/api/leerplandoelen${toQuery({
          zoek: filter.zoek,
          discipline: filter.discipline,
          domein: filter.domein,
          subdomein: filter.subdomein,
          doelsoort: filter.doelsoort,
          jaarFase: filter.jaarFase,
          overslaan: filter.overslaan,
          aantal: filter.aantal,
        })}`,
      ),
    enabled: opties?.enabled ?? true,
  });
}

export function useLeerplandoelFacetten(filter: LeerplandoelFilterQuery) {
  return useQuery({
    queryKey: ["leerplandoel-facetten", filter],
    queryFn: () =>
      get<LeerplandoelFacetten>(
        `/api/leerplandoelen/facetten${toQuery({
          zoek: filter.zoek,
          discipline: filter.discipline,
          domein: filter.domein,
          subdomein: filter.subdomein,
          doelsoort: filter.doelsoort,
          jaarFase: filter.jaarFase,
        })}`,
      ),
  });
}

export function useLeerplandoelDetail(code: string | undefined) {
  return useQuery({
    queryKey: ["leerplandoel", code],
    queryFn: () => get<LeerplandoelDetail>(`/api/leerplandoelen/${encodeURIComponent(code!)}`),
    enabled: !!code,
  });
}

/**
 * Fetches several leerplandoelen's full detail (tekst, jaarFase, …) in parallel, keyed identically to
 * `useLeerplandoelDetail` so the two share cache — the themadoelen-lijst on a thema needs a readable tekst
 * and the subthema-editor needs jaarFase to filter themadoelen down to one leeftijd, and neither should
 * re-fetch a doel the other already loaded.
 */
export function useLeerplandoelenBatch(codes: string[]) {
  const resultaten = useQueries({
    queries: codes.map((code) => ({
      queryKey: ["leerplandoel", code],
      queryFn: () => get<LeerplandoelDetail>(`/api/leerplandoelen/${encodeURIComponent(code)}`),
    })),
  });
  const perCode: Record<string, LeerplandoelDetail | undefined> = {};
  codes.forEach((code, i) => {
    perCode[code] = resultaten[i]?.data;
  });
  return { perCode, isLoading: resultaten.some((r) => r.isLoading) };
}

/** FR-4.4's gap list — leerplandoelen not linked to any thema yet. Powers de "nieuwe thema's" wizardstap. */
export function useOngekoppeldeDoelen(opties?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ["leerplandoelen-ongekoppeld"],
    queryFn: () => get<OngekoppeldDoelWeergave[]>("/api/leerplandoelen/ongekoppeld"),
    enabled: opties?.enabled ?? true,
  });
}

// --- Minimumdoelen (wettelijke eindtermen — de "Bekijk minimumdoelen"-schakelaar op de Doelenpagina) ---

export function useMinimumdoelen(filter: MinimumdoelFilterQuery, opties?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ["minimumdoelen", filter],
    queryFn: () =>
      get<MinimumdoelenPagina>(
        `/api/minimumdoelen${toQuery({
          zoek: filter.zoek,
          discipline: filter.discipline,
          domein: filter.domein,
          subdomein: filter.subdomein,
          jaarFase: filter.jaarFase,
          overslaan: filter.overslaan,
          aantal: filter.aantal,
        })}`,
      ),
    enabled: opties?.enabled ?? true,
  });
}

export function useMinimumdoelFacetten(filter: MinimumdoelFilterQuery) {
  return useQuery({
    queryKey: ["minimumdoel-facetten", filter],
    queryFn: () =>
      get<MinimumdoelFacetten>(
        `/api/minimumdoelen/facetten${toQuery({
          zoek: filter.zoek,
          discipline: filter.discipline,
          domein: filter.domein,
          subdomein: filter.subdomein,
          jaarFase: filter.jaarFase,
        })}`,
      ),
  });
}

/**
 * Manually links one leerplandoel to one or more thema's at once — the doel-detail sidepanel's
 * "koppel aan thema" actie. Each thema gets its own `POST .../themadoelen` call (Art. IX.2: the
 * link lives per thema); invalidates every touched thema plus the doel's own detail (its
 * "waar gebruikt" lijst changes) and the ongekoppeld-gap list.
 */
export function useKoppelDoelAanThemas() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ themaIds, leerplandoelCode }: { themaIds: string[]; leerplandoelCode: string }) => {
      await Promise.all(themaIds.map((themaId) => post(`/api/themas/${themaId}/themadoelen`, { leerplandoelCode })));
    },
    onSuccess: (_data, { themaIds, leerplandoelCode }) => {
      themaIds.forEach((themaId) => qc.invalidateQueries({ queryKey: themasKeys.detail(themaId) }));
      qc.invalidateQueries({ queryKey: themasKeys.alle });
      qc.invalidateQueries({ queryKey: ["leerplandoel", leerplandoelCode] });
      qc.invalidateQueries({ queryKey: ["leerplandoelen-ongekoppeld"] });
    },
  });
}

// --- Thema's ---

export const themasKeys = {
  alle: ["themas"] as const,
  detail: (id: string) => ["themas", id] as const,
  bibliotheek: ["themas", "bibliotheek"] as const,
};

export function useThemas() {
  return useQuery({ queryKey: themasKeys.alle, queryFn: () => get<ThemaWeergave[]>("/api/themas") });
}

export function useThemaBibliotheek() {
  return useQuery({
    queryKey: themasKeys.bibliotheek,
    queryFn: () => get<ThemaBibliotheekItem[]>("/api/themas/bibliotheek"),
  });
}

export function useThema(themaId: string | undefined) {
  return useQuery({
    queryKey: themasKeys.detail(themaId ?? ""),
    queryFn: () => get<ThemaWeergave>(`/api/themas/${themaId}`),
    enabled: !!themaId,
  });
}

export function useMaakThema() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (creatie: ThemaCreatie) => post<ThemaWeergave>("/api/themas", creatie),
    onSuccess: () => qc.invalidateQueries({ queryKey: themasKeys.alle }),
  });
}

export function useWijzigThema(themaId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (wijziging: ThemaWijziging) => put<ThemaWeergave>(`/api/themas/${themaId}`, wijziging),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: themasKeys.detail(themaId) });
      qc.invalidateQueries({ queryKey: themasKeys.alle });
      qc.invalidateQueries({ queryKey: themasKeys.bibliotheek });
    },
  });
}

export function useVoegThemadoelToe(themaId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (leerplandoelCode: string) =>
      post(`/api/themas/${themaId}/themadoelen`, { leerplandoelCode }),
    onSuccess: () => qc.invalidateQueries({ queryKey: themasKeys.detail(themaId) }),
  });
}

export function useVerwijderThemadoel(themaId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (themadoelId: string) => del(`/api/themas/${themaId}/themadoelen/${themadoelId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: themasKeys.detail(themaId) }),
  });
}

export function useMaakSubthema(themaId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (creatie: SubthemaCreatie) => post<SubthemaWeergave>(`/api/themas/${themaId}/subthemas`, creatie),
    onSuccess: () => qc.invalidateQueries({ queryKey: themasKeys.detail(themaId) }),
  });
}

export function useWijzigSubthema(subthemaId: string, themaId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (wijziging: SubthemaWijziging) => put<SubthemaWeergave>(`/api/subthemas/${subthemaId}`, wijziging),
    onSuccess: () => qc.invalidateQueries({ queryKey: themasKeys.detail(themaId) }),
  });
}

export function useVoegOnderzoeksvraagToe(subthemaId: string, themaId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (invoer: OnderzoeksvraagInvoer) =>
      post<OnderzoeksvraagWeergave>(`/api/subthemas/${subthemaId}/onderzoeksvragen`, invoer),
    onSuccess: () => qc.invalidateQueries({ queryKey: themasKeys.detail(themaId) }),
  });
}

export function useWijzigOnderzoeksvraag(subthemaId: string, themaId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ onderzoeksvraagId, invoer }: { onderzoeksvraagId: string; invoer: OnderzoeksvraagInvoer }) =>
      put<OnderzoeksvraagWeergave>(`/api/subthemas/${subthemaId}/onderzoeksvragen/${onderzoeksvraagId}`, invoer),
    onSuccess: () => qc.invalidateQueries({ queryKey: themasKeys.detail(themaId) }),
  });
}

export function useVerwijderOnderzoeksvraag(subthemaId: string, themaId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (onderzoeksvraagId: string) => del(`/api/subthemas/${subthemaId}/onderzoeksvragen/${onderzoeksvraagId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: themasKeys.detail(themaId) }),
  });
}

export function useKoppelActiviteitAanOnderzoeksvraag(activiteitId: string, themaId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (onderzoeksvraagId: string | null) =>
      put(`/api/activiteiten/${activiteitId}/onderzoeksvraag`, { onderzoeksvraagId }),
    onSuccess: () => qc.invalidateQueries({ queryKey: themasKeys.detail(themaId) }),
  });
}

// --- AI: thema-level doelsuggesties (match) ---

export function useGenereerDoelsuggesties(themaId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (selectie?: LeerdoelSelectie) =>
      post<DoelMatchResultaat>(`/api/themas/${themaId}/doelsuggesties/genereer`, selectie ? { selectie } : {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["doelsuggesties", themaId] }),
  });
}

export function useWijzigSuggestieStatus(themaId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ suggestieId, status }: { suggestieId: string; status: KoppelingStatus }) =>
      put(`/api/themas/${themaId}/doelsuggesties/${suggestieId}/status`, { status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["doelsuggesties", themaId] });
      qc.invalidateQueries({ queryKey: themasKeys.detail(themaId) });
    },
  });
}

// --- AI: thema-opbouw wizard (themadoel- and subdoel-suggesties) ---

export function useThemadoelSuggesties() {
  return useMutation({
    mutationFn: (verzoek: { thema: ThemaOpbouwContext; selectie?: LeerdoelSelectie }) =>
      post<ThemaOpbouwAdviesResultaat>("/api/thema-opbouw/themadoel-suggesties", verzoek),
  });
}

export function useSubdoelSuggesties() {
  return useMutation({
    mutationFn: (verzoek: {
      thema: ThemaOpbouwContext;
      subthema: SubthemaOpbouwContext;
      selectie?: LeerdoelSelectie;
    }) => post<ThemaOpbouwAdviesResultaat>("/api/thema-opbouw/subdoel-suggesties", verzoek),
  });
}

// --- Subthema's ---

export function useSubthemasVoorKlas(klasId: string | undefined) {
  return useQuery({
    queryKey: ["subthemas-voor-klas", klasId],
    queryFn: () => get<SubthemaBestemming[]>(`/api/subthemas/voor-klas/${klasId}`),
    enabled: !!klasId,
  });
}

export function useKoppelSubthemaAanDoel(subthemaId: string, themaId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (leerplandoelCode: string) => post(`/api/subthemas/${subthemaId}/doelkoppelingen`, { leerplandoelCode }),
    onSuccess: () => qc.invalidateQueries({ queryKey: themasKeys.detail(themaId) }),
  });
}

export function useOntkoppelSubdoel(subthemaId: string, themaId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (subdoelId: string) => del(`/api/subthemas/${subthemaId}/subdoelen/${subdoelId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: themasKeys.detail(themaId) }),
  });
}

export function useMaakActiviteit(subthemaId: string, themaId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (creatie: ActiviteitCreatie) =>
      post<ActiviteitWeergave>(`/api/subthemas/${subthemaId}/activiteiten`, creatie),
    onSuccess: () => qc.invalidateQueries({ queryKey: themasKeys.detail(themaId) }),
  });
}

// --- Activiteiten ---

export function useWijzigActiviteit(activiteitId: string, themaId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (wijziging: ActiviteitWijziging) =>
      put<ActiviteitWeergave>(`/api/activiteiten/${activiteitId}`, wijziging),
    onSuccess: () => qc.invalidateQueries({ queryKey: themasKeys.detail(themaId) }),
  });
}

export function useKoppelActiviteitAanDoel(activiteitId: string, themaId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (leerplandoelCode: string) =>
      post<DoelKoppelingWeergave>(`/api/activiteiten/${activiteitId}/doelkoppelingen`, { leerplandoelCode }),
    onSuccess: () => qc.invalidateQueries({ queryKey: themasKeys.detail(themaId) }),
  });
}

export function useOntkoppelActiviteitDoel(activiteitId: string, themaId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (koppelingId: string) => del(`/api/activiteiten/${activiteitId}/doelkoppelingen/${koppelingId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: themasKeys.detail(themaId) }),
  });
}

// --- Jaarplan ---

export function useJaarplan(klasId: string | undefined) {
  return useQuery({
    queryKey: ["jaarplan", klasId],
    queryFn: () => get<JaarplanWeergave>(`/api/klassen/${klasId}/jaarplan`),
    enabled: !!klasId,
  });
}

/**
 * The jaarplan of every klas in `klasIds` at once, keyed by klasId — used where a screen must know, across
 * several klassen, whether a given thema is already placed (e.g. "welke klassen hebben dit thema al
 * ingepland, en met welk subthema"). One request per klas (`useJaarplan` reused via the same query key, so
 * both stay in cache sync), fired in parallel through `useQueries`.
 */
export function useJaarplannenVoorKlassen(klasIds: string[]) {
  const resultaten = useQueries({
    queries: klasIds.map((klasId) => ({
      queryKey: ["jaarplan", klasId],
      queryFn: () => get<JaarplanWeergave>(`/api/klassen/${klasId}/jaarplan`),
    })),
  });
  const perKlas: Record<string, JaarplanWeergave | undefined> = {};
  klasIds.forEach((klasId, i) => {
    perKlas[klasId] = resultaten[i]?.data;
  });
  return { perKlas, isLoading: resultaten.some((r) => r.isLoading) };
}

export function useGenereerJaarplan(klasId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (parameters?: JaarplanGeneratieParameters) =>
      post<JaarplanGeneratieResultaat>(`/api/klassen/${klasId}/jaarplan/generatie`, parameters ?? null),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["jaarplan", klasId] }),
  });
}

export function useVoegPlaatsingToe(klasId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (plaatsing: { themaId: string; blokStart: string }) =>
      post<JaarplanWeergave>(`/api/klassen/${klasId}/jaarplan/plaatsingen`, plaatsing),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["jaarplan", klasId] }),
  });
}

/**
 * Plans one thema onto several klassen's jaarplannen at once with the same begindatum — the "welke klassen
 * krijgen dit thema, en wanneer" step the mobile-frontend comparison build adds on top of the single-klas
 * `useVoegPlaatsingToe`. Each klas gets its own `Themaplaatsing` row (Art. IX.2: thema's are school-wide,
 * but a placement is per klas's own jaarplan), so the einddatum each teacher sees is still derived from the
 * thema's own `duurWeken`, never invented here.
 */
export function useVoegPlaatsingToeMeerdereKlassen() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ klasIds, themaId, blokStart }: { klasIds: string[]; themaId: string; blokStart: string }) => {
      await Promise.all(klasIds.map((klasId) => post(`/api/klassen/${klasId}/jaarplan/plaatsingen`, { themaId, blokStart })));
    },
    onSuccess: (_data, { klasIds }) => {
      klasIds.forEach((klasId) => qc.invalidateQueries({ queryKey: ["jaarplan", klasId] }));
    },
  });
}

export function useWijzigPlaatsingStatus(klasId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ plaatsingId, status }: { plaatsingId: string; status: KoppelingStatus }) =>
      put(`/api/klassen/${klasId}/jaarplan/plaatsingen/${plaatsingId}/status`, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["jaarplan", klasId] }),
  });
}

export function useWijzigVergrendeling(klasId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ plaatsingId, vergrendeld }: { plaatsingId: string; vergrendeld: boolean }) =>
      put(`/api/klassen/${klasId}/jaarplan/plaatsingen/${plaatsingId}/vergrendeling`, { vergrendeld }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["jaarplan", klasId] }),
  });
}

export function useVerplaatsPlaatsing(klasId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ plaatsingId, blokStart }: { plaatsingId: string; blokStart: string }) =>
      put(`/api/klassen/${klasId}/jaarplan/plaatsingen/${plaatsingId}/blok`, { blokStart }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["jaarplan", klasId] }),
  });
}

export function useVerwijderPlaatsing(klasId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (plaatsingId: string) => del(`/api/klassen/${klasId}/jaarplan/plaatsingen/${plaatsingId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["jaarplan", klasId] }),
  });
}

// --- Dekking ---

export function useDekking(klasId: string | undefined, bereik: Dekkingsbereik = "EigenJaarFase", jaarFase?: string) {
  return useQuery({
    queryKey: ["dekking", klasId, bereik, jaarFase],
    queryFn: () => get<DekkingWeergave>(`/api/klassen/${klasId}/dekking${toQuery({ bereik, jaarFase })}`),
    enabled: !!klasId,
  });
}

/**
 * Same endpoint as `useDekking`, once per klas — powers de Dekking-pagina's "Heel het curriculum"-bereik
 * (school-brede grafieken) en de per-klas-detailgrafiek. Shares its query key/cache with `useDekking`, so
 * switching tussen "Heel het curriculum" en één klas herbruikt wat al geladen is.
 */
export function useDekkingVoorKlassen(klasIds: string[], bereik: Dekkingsbereik = "HeelCurriculum") {
  const resultaten = useQueries({
    queries: klasIds.map((klasId) => ({
      queryKey: ["dekking", klasId, bereik, undefined],
      queryFn: () => get<DekkingWeergave>(`/api/klassen/${klasId}/dekking${toQuery({ bereik })}`),
    })),
  });
  const perKlas: Record<string, DekkingWeergave | undefined> = {};
  klasIds.forEach((klasId, i) => {
    perKlas[klasId] = resultaten[i]?.data;
  });
  return { perKlas, isLoading: resultaten.some((r) => r.isLoading) };
}
