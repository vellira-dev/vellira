import { useState, type CSSProperties, type FormEvent } from 'react';
import { Button, Checkbox, Input } from '@vellira-ui/react';
import '@vellira-ui/react/styles';

type Profile = { email: string; updates: boolean };

const initialProfile: Profile = { email: '', updates: false };
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const page: CSSProperties = {
  maxWidth: 480,
  margin: '4rem auto',
  padding: '2rem',
  fontFamily: 'system-ui, sans-serif',
};

export default function App() {
  const [profile, setProfile] = useState<Profile>(initialProfile);
  const [attempted, setAttempted] = useState(false);
  const [preview, setPreview] = useState<Profile | null>(null);

  const emailValid = emailPattern.test(profile.email.trim());
  const emailError =
    attempted && !emailValid ? 'Enter a valid email address.' : undefined;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAttempted(true);
    setPreview(emailValid ? { ...profile, email: profile.email.trim() } : null);
  }

  return (
    <main style={page}>
      <h1>One form, two runtimes</h1>
      <p>React example with Vellira. Nothing is sent to a server.</p>

      <form
        noValidate
        onSubmit={handleSubmit}
        style={{ display: 'grid', gap: 20 }}
      >
        <Input
          label='Email'
          type='email'
          required
          value={profile.email}
          error={emailError}
          onValueChange={(email) => {
            setProfile((current) => ({ ...current, email }));
            setPreview(null);
          }}
          placeholder='name@example.com'
        />
        <Checkbox
          label='Enable sample updates'
          checked={profile.updates}
          onCheckedChange={(updates) => {
            setProfile((current) => ({ ...current, updates }));
            setPreview(null);
          }}
        />
        <Button type='submit' appearance='solid' color='primary'>
          Preview form data
        </Button>
      </form>

      {preview && (
        <section
          role='status'
          aria-label='Local form preview'
          style={{ marginTop: 24 }}
        >
          <h2>Local preview</h2>
          <pre>{JSON.stringify(preview, null, 2)}</pre>
        </section>
      )}
    </main>
  );
}
