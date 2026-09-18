import { QueryClientProvider } from "@tanstack/react-query";
import { maakQueryClient } from "./lib/queryClient";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Schil } from "./app/Schil";
import { Aanmeldpoort } from "./app/Aanmeldpoort";
import { DoelenScherm } from "./features/doelen/DoelenScherm";
import { ThemasScherm } from "./features/themas/ThemasScherm";
import { ThemadetailScherm } from "./features/themas/ThemadetailScherm";
import { PlanScherm } from "./features/plan/PlanScherm";
import { Agendascherm } from "./features/plan/Agendascherm";
import { DekkingScherm } from "./features/dekking/DekkingScherm";
import { ImportScherm } from "./features/import/ImportScherm";
import { OntwikkelingsrapportScherm } from "./features/ontwikkelingsrapport/OntwikkelingsrapportScherm";
import { RapportdoelenScherm } from "./features/ontwikkelingsrapport/RapportdoelenScherm";
import { RapportScherm } from "./features/ontwikkelingsrapport/RapportScherm";
import { SterrenschaalScherm } from "./features/ontwikkelingsrapport/SterrenschaalScherm";
import { Rapportstart } from "./features/ontwikkelingsrapport/Rapportwissel";
import { AfgemeldScherm } from "./features/aanmelding/AfgemeldScherm";
import { GeenToegangScherm } from "./features/aanmelding/GeenToegangScherm";
import { Instellingenindeling } from "./features/instellingen/Instellingenindeling";
import { KlassenScherm } from "./features/instellingen/KlassenScherm";
import { HoekenScherm } from "./features/instellingen/HoekenScherm";
import { AlgemeneFichesScherm } from "./features/instellingen/AlgemeneFichesScherm";
import { WeergaveScherm } from "./features/instellingen/WeergaveScherm";
import { GebruikersScherm } from "./features/instellingen/GebruikersScherm";
import { SchoolurenScherm } from "./features/instellingen/SchoolurenScherm";
import { Onderdeelpoort } from "./features/instellingen/Onderdeelpoort";
import { ONDERDELEN, type Deel } from "./features/instellingen/onderdelen";
import type { ComponentType } from "react";

/**
 * The screen behind each part of Instellingen. A `Record` over the parts' own type, so a part added
 * to `ONDERDELEN` without a screen here is a type error rather than a link that falls into `*`.
 */
const INSTELLINGEN: Record<Deel, ComponentType> = {
  klassen: KlassenScherm,
  gebruikers: GebruikersScherm,
  schooluren: SchoolurenScherm,
  hoeken: HoekenScherm,
  "algemene-fiches": AlgemeneFichesScherm,
  weergave: WeergaveScherm,
};

const queryClient = maakQueryClient();

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          {/* Outside the shell (E6-01). The shell reads who is signed in, and on this page that read
              would answer 401 and loop through the sign-in: see GeenToegangScherm. */}
          <Route path="geen-toegang" element={<GeenToegangScherm />} />
          <Route path="aanmelden-mislukt" element={<GeenToegangScherm soort="mislukt" />} />
          {/* Where a sign-out lands (TB-032), outside the shell for the same reason. */}
          <Route path="afgemeld" element={<AfgemeldScherm />} />
          {/* The shell only once it is known who is signed in (TB-026): until then the tussenpagina, so a
              browser on its way to the sign-in never shows a glimpse of the app. */}
          <Route
            element={
              <Aanmeldpoort>
                <Schil />
              </Aanmeldpoort>
            }
          >
            {/* The app opens on the agenda (owner, 2026-09-11: "ik wil niet dat er default doelen
                wordt geopend"), and an address it does not know lands there too, below. */}
            <Route index element={<Navigate to="/agenda" replace />} />
            <Route path="doelen" element={<DoelenScherm />} />
            <Route path="themas" element={<ThemasScherm />} />
            <Route path="themas/:themaId" element={<ThemadetailScherm />} />
            <Route path="agenda" element={<Agendascherm />} />
            <Route path="agenda/dag/:datum" element={<Agendascherm />} />
            <Route path="agenda/periodes" element={<PlanScherm />} />
            <Route path="dekking" element={<DekkingScherm />} />
            {/* The K3 ontwikkelingsrapport (FR-13), in parts since FB-002. The bare address opens the first part this
                person may see. The children say so themselves to whoever may read no report, and the server refuses
                them the data (R17); the set and the scale are no pupil data and anyone may view them (AC5). */}
            <Route path="ontwikkelingsrapport">
              <Route index element={<Rapportstart />} />
              <Route path="kinderen" element={<OntwikkelingsrapportScherm />} />
              {/* One child's report per moment (FB-003), under the children. The server refuses the report to
                  anyone who may not read it, also by this address (R17). A child alone opens Rapport 1. */}
              <Route path="kinderen/:leerlingId" element={<Navigate to="rapport/1" replace />} />
              <Route path="kinderen/:leerlingId/rapport/:moment" element={<RapportScherm />} />
              <Route path="rapportdoelen" element={<RapportdoelenScherm />} />
              <Route path="sterrenschaal" element={<SterrenschaalScherm />} />
            </Route>
            {/* A frame with parts, each at its own address (owner, 2026-09-11). The bare address
                opens the first part, so the navigation item and every old link still land somewhere. */}
            <Route path="instellingen" element={<Instellingenindeling />}>
              <Route index element={<Navigate to={ONDERDELEN[0].deel} replace />} />
              {/* Every part goes through the gate; only a directie-only one is ever turned away. */}
              {ONDERDELEN.map(({ deel }) => {
                const Scherm = INSTELLINGEN[deel];
                return (
                  <Route
                    key={deel}
                    path={deel}
                    element={
                      <Onderdeelpoort deel={deel}>
                        <Scherm />
                      </Onderdeelpoort>
                    }
                  />
                );
              })}
            </Route>
            {/* Not in the bottom bar: see the note in ImportScherm. Reached from Doelen and Thema's. */}
            <Route path="inladen" element={<ImportScherm />} />
            <Route path="*" element={<Navigate to="/agenda" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
