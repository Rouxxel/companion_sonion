/** Pure interpretation of macOS login-item state (no Electron import, unit-tested). */

export type LoginItemStatus = "not-registered" | "enabled" | "requires-approval" | "not-found";

export interface LoginItemState {
  /** Checkbox state: on when registered, including "waiting for approval". */
  enabled: boolean;
  /** Explanation for Settings, if the user has to do something. */
  note?: string;
}

export const APPROVAL_NOTE = "Waiting for your approval: System Settings → General → Login Items → allow Sonion Companion.";

/**
 * macOS 13+ reports `status` (SMAppService); macOS 12 only `openAtLogin`.
 * "requires-approval" counts as on, so the app never re-registers or nags; Settings explains what to do.
 */
export function loginItemState(settings: { openAtLogin: boolean; status?: LoginItemStatus | string }): LoginItemState {
  switch (settings.status) {
    case "enabled": return { enabled: true };
    case "requires-approval": return { enabled: true, note: APPROVAL_NOTE };
    case "not-registered":
    case "not-found": return { enabled: false };
    default: return { enabled: settings.openAtLogin === true };
  }
}

/** Whether a "move to Applications" prompt should be shown. */
export function shouldOfferMove(input: { packaged: boolean; inApplications: boolean; declined: boolean }): boolean {
  return input.packaged && !input.inApplications && !input.declined;
}
