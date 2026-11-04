export const SUCCESS_EVENT = "maz:action-success";
export const DEFAULT_SUCCESS_MESSAGE = "Changes saved successfully.";

/** Call only after a user-initiated operation has succeeded. */
export function notifySuccess(message = DEFAULT_SUCCESS_MESSAGE) {
  if (typeof window !== "undefined")
    window.dispatchEvent(new CustomEvent(SUCCESS_EVENT, { detail: message }));
}
