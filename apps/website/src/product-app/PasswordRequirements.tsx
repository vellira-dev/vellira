import { validNewPassword } from './passwordPolicy';
import s from './AuthSurface.module.css';

export function passwordConfirmationReady(
  password: string,
  confirmation: string
) {
  return (
    confirmation.length > 0 &&
    confirmation === password &&
    validNewPassword(password)
  );
}

export function PasswordRequirements({
  password,
  confirmation,
}: {
  password: string;
  confirmation: string;
}) {
  const longEnough = Array.from(password).length >= 12;
  const matches = confirmation.length > 0 && confirmation === password;
  const valid = validNewPassword(password);
  const passwordBytes = new TextEncoder().encode(password).length;
  const tooLong = password.length > 1024 || passwordBytes > 1024;
  const complete = valid && matches;

  const requirements = [
    { id: 'length', label: 'At least 12 characters', met: longEnough },
    { id: 'match', label: 'Passwords match', met: matches },
  ];

  return (
    <div className={s.passwordRequirements}>
      <p className={s.passwordRequirementsLabel}>Password requirements</p>
      <ul className={s.passwordRequirementsList}>
        {requirements.map(({ id, label, met }) => (
          <li
            key={id}
            className={s.passwordRequirement}
            data-met={met ? 'true' : 'false'}
            aria-label={`${label}: ${met ? 'met' : 'not met'}`}
          >
            <span className={s.passwordRequirementMark} aria-hidden='true'>
              {met ? '✓' : '○'}
            </span>
            <span aria-hidden='true'>{label}</span>
          </li>
        ))}
      </ul>
      {tooLong && (
        <p className={s.error} role='alert'>
          Password is too long. Use no more than 1024 UTF-8 bytes.
        </p>
      )}
      <span className={s.srOnly} aria-live='polite'>
        {complete
          ? 'All password requirements are met.'
          : 'Password requirements are not yet complete.'}
      </span>
    </div>
  );
}
