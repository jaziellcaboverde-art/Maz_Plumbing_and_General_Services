import { useId } from "react";
import { StatusMessage } from "./status-message";
import styles from "./radio-group.module.css";

export type RadioOption = {
  value: string;
  label: string;
  hint?: string;
  disabled?: boolean;
};

type RadioGroupProps = {
  legend: string;
  name: string;
  options: RadioOption[];
  value: string | null;
  onChange: (value: string) => void;
  /** Shown under the group. Setting it marks the group as an error. */
  error?: string;
  disabled?: boolean;
};

export function RadioGroup({ legend, name, options, value, onChange, error, disabled }: RadioGroupProps) {
  const id = useId();
  const errorId = error ? `${id}-error` : undefined;
  return (
    <fieldset className={styles.group} aria-describedby={errorId}>
      <legend className={styles.legend}>{legend}</legend>
      <div className={styles.options}>
        {options.map((option) => {
          const optionId = `${id}-${option.value}`;
          const hintId = option.hint ? `${optionId}-hint` : undefined;
          return (
            <label key={option.value} className={styles.item} htmlFor={optionId}>
              <input
                id={optionId}
                className={styles.input}
                type="radio"
                name={name}
                value={option.value}
                checked={value === option.value}
                disabled={disabled || option.disabled}
                aria-describedby={hintId}
                data-invalid={error ? "true" : undefined}
                onChange={() => onChange(option.value)}
              />
              <span className={styles.text}>
                <span>{option.label}</span>
                {option.hint && (
                  <span id={hintId} className={styles.hint}>
                    {option.hint}
                  </span>
                )}
              </span>
            </label>
          );
        })}
      </div>
      {error && (
        <StatusMessage status="error" id={errorId}>
          {error}
        </StatusMessage>
      )}
    </fieldset>
  );
}
