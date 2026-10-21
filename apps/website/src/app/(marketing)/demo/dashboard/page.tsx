'use client';

import { Dashboard } from '@/sections/home/ProductInterfaceDemo/Dashboard';
import { useWebsiteThemeContext } from '@/providers/WebsiteThemeContext';

export default function FullDashboardDemoPage() {
  const { preference, setPreference } = useWebsiteThemeContext();

  return (
    <div aria-label='Full-screen Vellira Core Dashboard'>
      <Dashboard
        variant='standalone'
        theme={preference}
        onThemeChange={setPreference}
      />
    </div>
  );
}
