import { AppShell } from "@/components/sms/app-shell";
import { Providers } from "@/components/sms/providers";

export default function Home() {
  return (
    <Providers>
      <AppShell />
    </Providers>
  );
}
