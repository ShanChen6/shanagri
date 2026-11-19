import { useId, type ComponentProps } from 'react';

type TextFieldProps = ComponentProps<'input'> & {
  label: string;
  hint?: string;
  error?: string;
};

export function TextField({
  label, hint, error, id, 'aria-describedby': describedBy, 'aria-invalid': invalid, ...props
}: TextFieldProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const hintId = hint ? `${inputId}-hint` : undefined;
  const errorId = error ? `${inputId}-error` : undefined;
  const description = [describedBy, hintId, errorId].filter(Boolean).join(' ');

  return (
    <div className="ui-field">
      <label htmlFor={inputId}>{label}</label>
      <input
        {...props}
        id={inputId}
        aria-describedby={description || undefined}
        aria-invalid={error ? true : invalid}
      />
      {hint && <span id={hintId} className="field-hint">{hint}</span>}
      {error && <span id={errorId} className="field-error">{error}</span>}
    </div>
  );
}
