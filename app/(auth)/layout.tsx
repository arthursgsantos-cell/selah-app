import Image from 'next/image'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[100dvh] flex items-center justify-center p-4 pt-[calc(1rem+env(safe-area-inset-top))] pb-[calc(1rem+env(safe-area-inset-bottom))] bg-gradient-to-br from-[#0D47A1] via-[#1565C0] to-[#1976D2]">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center">
          <img
            src="/logo-login.png"
            alt="Igreja Batista Zona Sul"
            width={200}
            height={200}
            className="drop-shadow-xl h-44 w-auto"
            style={{ filter: 'brightness(0) invert(1)' }}
            loading="eager"
          />
        </div>
        <div className="bg-white/95 backdrop-blur rounded-2xl shadow-2xl overflow-hidden">
          {children}
        </div>
      </div>
    </div>
  )
}
