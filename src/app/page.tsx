"use client";

import { AppShell } from "@/components/layout/AppShell";
import { AppStoreProvider } from "@/store/useAppStore";

export default function HomePage() {
  return (
    <AppStoreProvider>
      <AppShell />
    </AppStoreProvider>
  );
}
