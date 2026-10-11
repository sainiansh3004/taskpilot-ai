import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'TaskPilot AI — Autonomous Enterprise Task Execution Platform',
  description: 'Autonomous AI Employee for the CentrAlign AI Engineering Intern hiring assignment by Ansh Saini.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-background text-slate-100 antialiased selection:bg-primary/20 selection:text-primary">
        {children}
      </body>
    </html>
  );
}
