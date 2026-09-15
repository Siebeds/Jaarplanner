/**
 * Where a thema's page lives, and how a link asks it to open one of its subthema's (FB-037).
 *
 * A subthema has no page of its own: it is a chapter of its thema's page, shut by default (FB-011). A link that means a
 * subthema names that chapter in the query, and the page opens it and brings it into view.
 */
export const SUBTHEMA_PARAMETER = "subthema";

export function themapaginaPad(themaId: string, subthemaId?: string): string {
  const pad = `/themas/${themaId}`;
  return subthemaId ? `${pad}?${new URLSearchParams({ [SUBTHEMA_PARAMETER]: subthemaId })}` : pad;
}
