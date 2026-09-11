/**
 * An inline field error. Deliberately not a live region: react-hook-form moves
 * focus to the first invalid field on submit, and that field points here via
 * `aria-describedby`, so a screen reader reads the message on arrival. An
 * `role="alert"` on every field as well would announce each error twice.
 */
export function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="mt-1 text-sm text-feedback-error">
      {message}
    </p>
  );
}
