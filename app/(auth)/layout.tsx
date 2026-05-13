export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold tracking-tight text-primary">Selah</h1>
          <p className="mt-1 text-sm text-muted-foreground">Gestão de células</p>
        </div>
        {children}
      </div>
    </div>
  )
}
