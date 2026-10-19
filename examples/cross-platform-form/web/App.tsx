import { useState, type FormEvent } from 'react';
import { Button, Checkbox, Input } from '@vellira-ui/react';
import '@vellira-ui/react/styles';

type Profile = { email: string; updates: boolean };

const initialProfile: Profile = { email: '', updates: false };
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
    <main className='demo-page'>
      <header className='demo-header'>
        <h1 className='demo-title'>One form, two runtimes</h1>
        <p className='demo-intro'>
          React example with Vellira. Nothing is sent to a server.
        </p>
      </header>

      <form className='demo-form' noValidate onSubmit={handleSubmit}>
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
        <Button
          className='demo-submit'
          type='submit'
          appearance='solid'
          color='primary'
        >
          Preview form data
        </Button>
      </form>

      {preview && (
        <section
          className='demo-preview'
          role='status'
          aria-label='Local form preview'
        >
          <h2 className='demo-preview-title'>Local preview</h2>
          <pre>{JSON.stringify(preview, null, 2)}</pre>
        </section>
      )}
    </main>
  );
}
