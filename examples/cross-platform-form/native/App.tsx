import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Button, Checkbox, Input, ThemeProvider } from '@vellira-ui/react-native';

type Profile = { email: string; updates: boolean };

const initialProfile: Profile = { email: '', updates: false };
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function App() {
  const [profile, setProfile] = useState<Profile>(initialProfile);
  const [attempted, setAttempted] = useState(false);
  const [preview, setPreview] = useState<Profile | null>(null);

  const emailValid = emailPattern.test(profile.email.trim());
  const emailError = attempted && !emailValid ? 'Enter a valid email address.' : undefined;

  function handleSubmit() {
    setAttempted(true);
    setPreview(emailValid ? { ...profile, email: profile.email.trim() } : null);
  }

  return (
    <ThemeProvider theme='light'>
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          paddingHorizontal: 24,
          paddingTop: 64,
          paddingBottom: 32,
          gap: 20,
        }}
      >
        <View style={{ gap: 8 }}>
          <Text accessibilityRole='header' style={{ fontSize: 24, fontWeight: '700' }}>
            One form, two runtimes
          </Text>
          <Text>React Native example with Vellira. Nothing is sent to a server.</Text>
        </View>
        <Input
          label='Email'
          type='email'
          keyboardType='email-address'
          autoCapitalize='none'
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
        <Button appearance='solid' color='primary' onPress={handleSubmit}>
          Preview form data
        </Button>
        {preview && (
          <View style={{ gap: 8 }} accessible accessibilityLabel='Local form preview'>
            <Text style={{ fontWeight: '600' }}>Local preview</Text>
            <Text accessibilityLiveRegion='polite'>
              {JSON.stringify(preview, null, 2)}
            </Text>
          </View>
        )}
      </ScrollView>
    </ThemeProvider>
  );
}
