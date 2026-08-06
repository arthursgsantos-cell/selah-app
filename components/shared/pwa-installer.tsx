'use client'

import { useEffect, useState } from 'react'
import { Download, Share, PlusSquare, X, Smartphone, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export function PwaInstaller() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [isStandalone, setIsStandalone] = useState(false)
  const [isIos, setIsIos] = useState(false)
  const [showIosModal, setShowIosModal] = useState(false)
  const [showBanner, setShowBanner] = useState(false)

  useEffect(() => {
    // 1. Registra o Service Worker
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .then((reg) => {
          console.log('[PWA] Service Worker registrado com sucesso:', reg.scope)
        })
        .catch((err) => {
          console.warn('[PWA] Falha ao registrar Service Worker:', err)
        })
    }

    // 2. Verifica se o app já está instalado / em modo Standalone
    const checkStandalone = () => {
      const isStandaloneMode =
        window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as any).standalone === true ||
        document.referrer.includes('android-app://')

      setIsStandalone(isStandaloneMode)
    }

    checkStandalone()

    // 3. Detecta iOS (Safari não dispara beforeinstallprompt)
    const userAgent = window.navigator.userAgent
    const isIosDevice = /iPad|iPhone|iPod/.test(userAgent) && !(window as any).MSStream
    setIsIos(isIosDevice)

    // 4. Intercepta evento de instalação do Android/Chrome
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
      
      const dismissed = localStorage.getItem('ibzs_pwa_dismissed')
      if (!dismissed) {
        setShowBanner(true)
      }
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)

    // Exibe banner no iOS se ainda não estiver instalado nem dispensado
    if (isIosDevice) {
      const dismissed = localStorage.getItem('ibzs_pwa_dismissed')
      if (!dismissed) {
        setShowBanner(true)
      }
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    }
  }, [])

  const handleInstallClick = async () => {
    if (isIos) {
      setShowIosModal(true)
      return
    }

    if (!deferredPrompt) return

    await deferredPrompt.prompt()
    const choiceResult = await deferredPrompt.userChoice

    if (choiceResult.outcome === 'accepted') {
      console.log('[PWA] Usuário aceitou a instalação')
      setShowBanner(false)
    } else {
      console.log('[PWA] Usuário recusou a instalação')
    }

    setDeferredPrompt(null)
  }

  const handleDismiss = () => {
    setShowBanner(false)
    setShowIosModal(false)
    localStorage.setItem('ibzs_pwa_dismissed', 'true')
  }

  // Não renderiza nada se o app já estiver instalado em modo standalone
  if (isStandalone || (!showBanner && !showIosModal)) {
    return null
  }

  return (
    <>
      {/* Banner flutuante no rodapé */}
      {showBanner && !showIosModal && (
        <div className="fixed bottom-4 left-4 right-4 z-50 m-auto max-w-md animate-in fade-in slide-in-from-bottom-5 duration-300">
          <div className="flex items-center justify-between gap-3 rounded-2xl bg-card border border-border p-3.5 shadow-2xl backdrop-blur-md">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground font-bold shadow-sm">
                <Smartphone className="h-6 w-6" />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-semibold leading-tight text-foreground">
                  Instalar o App IBZS
                </span>
                <span className="text-xs text-muted-foreground leading-tight mt-0.5">
                  Acesse com 1 toque no celular
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                size="sm"
                className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl px-3 text-xs font-semibold shadow-sm"
                onClick={handleInstallClick}
              >
                <Download className="mr-1.5 h-3.5 w-3.5" />
                Instalar
              </Button>

              <button
                onClick={handleDismiss}
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted transition-colors"
                aria-label="Fechar aviso"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de instruções para iOS */}
      {showIosModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-3xl bg-card border border-border p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2">
                <Smartphone className="h-5 w-5 text-primary" />
                <h3 className="text-base font-semibold text-foreground">
                  Instalar no iPhone / iPad
                </h3>
              </div>
              <button
                onClick={() => setShowIosModal(false)}
                className="rounded-lg p-1 text-muted-foreground hover:bg-muted transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 py-4">
              <p className="text-xs text-muted-foreground leading-relaxed">
                Siga os passos abaixo no Safari para adicionar o IBZS à sua tela de início:
              </p>

              <ol className="space-y-3 text-xs font-medium text-foreground">
                <li className="flex items-start gap-3 rounded-xl bg-muted/60 p-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-xs">
                    1
                  </span>
                  <div className="flex-1">
                    Toque no botão <span className="font-semibold text-primary">Compartilhar</span> na barra de navegação.
                    <div className="mt-1 flex items-center gap-1.5 text-muted-foreground font-normal">
                      <Share className="h-4 w-4 text-primary" /> (Ícone com uma seta apontando para cima)
                    </div>
                  </div>
                </li>

                <li className="flex items-start gap-3 rounded-xl bg-muted/60 p-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-xs">
                    2
                  </span>
                  <div className="flex-1">
                    Role as opções para baixo e toque em{' '}
                    <span className="font-semibold text-primary">Adicionar à Tela de Início</span>.
                    <div className="mt-1 flex items-center gap-1.5 text-muted-foreground font-normal">
                      <PlusSquare className="h-4 w-4 text-primary" /> (Ícone de quadrado com um símbolo +)
                    </div>
                  </div>
                </li>

                <li className="flex items-start gap-3 rounded-xl bg-muted/60 p-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-xs">
                    3
                  </span>
                  <div className="flex-1">
                    Toque em <span className="font-semibold text-primary">Adicionar</span> no canto superior direito para concluir.
                    <div className="mt-1 flex items-center gap-1 text-emerald-600 font-normal">
                      <Check className="h-4 w-4" /> Pronto! O app aparecerá na sua tela inicial.
                    </div>
                  </div>
                </li>
              </ol>
            </div>

            <div className="pt-2">
              <Button
                className="w-full rounded-xl bg-primary text-primary-foreground font-semibold"
                onClick={() => setShowIosModal(false)}
              >
                Entendi
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
