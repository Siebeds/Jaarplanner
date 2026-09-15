/** A refusal or a validation sentence inside a form, where the control it is about is still on screen. */
export function Foutregel({ zin }: { zin: string }) {
  return (
    <p role="alert" className="rounded-veld bg-attentie-zacht px-3 py-2 text-meta font-medium text-attentie-inkt">
      {zin}
    </p>
  );
}
