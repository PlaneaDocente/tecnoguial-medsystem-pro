export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-slate-900">
      {/* Aquí iría tu sidebar/navbar si lo tienes */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}