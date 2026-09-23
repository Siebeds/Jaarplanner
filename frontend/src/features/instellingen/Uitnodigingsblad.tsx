import { useId, useState, type FormEvent } from "react";
import { Blad } from "../../components/ui/Blad";
import { Knop } from "../../components/ui/Knop";
import { Invoer } from "../../components/ui/Veld";
import { ApiError } from "../../lib/api";
import { t } from "../../i18n";
import { useNodigUit, type GebruikerBeheer } from "./gebruikerbeheer";

/**
 * Inviting a person (E6-04): their Microsoft sign-in name and a name to show.
 *
 * **It asks for the sign-in name, not an e-mail address** (ADR-0031 decision 3). The two often
 * differ at a school, and an invitation under the mailbox address would never match the person's
 * first login, so the one line of explanation under the label is the one that earns its place.
 *
 * Rights are not asked here: the screen opens the person's Rechten sheet as soon as the invitation
 * is saved, so there is one place where rights are set, not two.
 */
export function Uitnodigingsblad({
  onSluit,
  onUitgenodigd,
}: {
  onSluit: () => void;
  onUitgenodigd: (gebruiker: GebruikerBeheer) => void;
}) {
  const id = useId();
  const nodigUit = useNodigUit();
  const [email, setEmail] = useState("");
  const [naam, setNaam] = useState("");
  const [emailFout, setEmailFout] = useState(false);
  const [naamFout, setNaamFout] = useState(false);
  const bezig = nodigUit.isPending;

  function verstuur(event: FormEvent) {
    event.preventDefault();
    const emailLeeg = email.trim().length === 0;
    const naamLeeg = naam.trim().length === 0;
    setEmailFout(emailLeeg);
    setNaamFout(naamLeeg);
    if (emailLeeg || naamLeeg) return;

    nodigUit.mutate({ email: email.trim(), naam: naam.trim() }, { onSuccess: onUitgenodigd });
  }

  const serverReden = nodigUit.error instanceof ApiError ? nodigUit.error.detail : undefined;

  return (
    <Blad
      open
      onOpenChange={(open) => !open && onSluit()}
      titel={t("gebruikers.uitnodigen")}
      voet={
        <div className="flex items-center gap-2">
          <Knop rang="hoofd" vol form={id} type="submit" bezig={bezig} className="@sm:w-auto @sm:px-6">
            {bezig ? t("algemeen.bezig") : t("gebruikers.uitnodig")}
          </Knop>
          <Knop rang="stil" onClick={onSluit} disabled={bezig}>
            {t("themabeheer.annuleer")}
          </Knop>
        </div>
      }
    >
      <form id={id} onSubmit={verstuur} noValidate className="flex flex-col gap-5">
        <div>
          <label htmlFor={`${id}-email`} className="text-meta font-medium text-inkt">
            {t("gebruikers.aanmeldnaam")}
          </label>
          <p id={`${id}-email-uitleg`} className="mt-0.5 text-meta text-inkt-zacht">
            {t("gebruikers.aanmeldnaamUitleg")}
          </p>
          <Invoer
            id={`${id}-email`}
            type="text"
            inputMode="email"
            autoComplete="off"
            spellCheck={false}
            value={email}
            disabled={bezig}
            aria-describedby={`${id}-email-uitleg`}
            aria-invalid={emailFout || undefined}
            placeholder={t("gebruikers.aanmeldnaamVoorbeeld")}
            onChange={(e) => {
              setEmail(e.target.value);
              if (emailFout) setEmailFout(false);
            }}
            className="mt-1.5"
          />
          {emailFout ? (
            <p role="alert" className="mt-1.5 text-meta font-medium text-attentie-inkt">
              {t("gebruikers.aanmeldnaamVerplicht")}
            </p>
          ) : null}
        </div>

        <div>
          <label htmlFor={`${id}-naam`} className="text-meta font-medium text-inkt">
            {t("gebruikers.naam")}
          </label>
          <Invoer
            id={`${id}-naam`}
            value={naam}
            disabled={bezig}
            aria-invalid={naamFout || undefined}
            placeholder={t("gebruikers.naamVoorbeeld")}
            onChange={(e) => {
              setNaam(e.target.value);
              if (naamFout) setNaamFout(false);
            }}
            className="mt-1.5"
          />
          {naamFout ? (
            <p role="alert" className="mt-1.5 text-meta font-medium text-attentie-inkt">
              {t("gebruikers.naamVerplicht")}
            </p>
          ) : null}
        </div>

        {nodigUit.isError ? (
          <div role="alert" className="rounded-veld border border-attentie/40 bg-attentie-zacht p-3">
            <p className="text-body font-medium text-attentie-inkt">{t("gebruikers.uitnodigenMislukt")}</p>
            {serverReden ? <p className="mt-1 text-meta text-attentie-inkt">{serverReden}</p> : null}
          </div>
        ) : null}
      </form>
    </Blad>
  );
}
