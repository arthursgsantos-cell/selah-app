'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Sparkles, MessageCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { linkSuporte } from '@/lib/suporte'
import type { Pendencia } from '@/lib/perfil-pendencias'

/** Onde a pessoa estava quando o convite apareceu — para voltar depois. */
const CHAVE_ADIADO = 'selah:boas-vindas-adiado'

/**
 * Telas onde o convite não faz sentido: já é a própria edição do perfil, ou é
 * o cadastro que ainda está acontecendo.
 */
const ROTAS_MUDAS = ['/perfil', '/onboarding', '/login', '/cadastro']

interface Props {
  /** Primeiro nome, para o convite falar com a pessoa e não com "usuário". */
  primeiroNome: string
  /** O que falta preencher. Vem calculado do servidor; nunca chega vazio. */
  pendencias: Pendencia[]
  /** Quem nunca salvou o perfil está chegando; o resto está voltando. */
  primeiroAcesso: boolean
}

/**
 * O convite para terminar o cadastro.
 *
 * Não é mais só boas-vindas de primeiro acesso: aparece para quem já está na
 * casa há meses e continua sem telefone no sistema. O que muda é o tom — e a
 * lista, que mostra exatamente o que falta em vez de mandar a pessoa procurar.
 *
 * O botão carrega o caminho de volta: quem foi interrompido no meio de uma
 * inscrição de curso volta para o curso ao salvar o perfil, em vez de
 * aterrissar na home e ter de procurar tudo de novo. Ver `?retorno=` em
 * `app/(app)/perfil/page.tsx`.
 */
export function BoasVindasPerfil({ primeiroNome, pendencias, primeiroAcesso }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [aberto, setAberto] = useState(false)

  useEffect(() => {
    if (ROTAS_MUDAS.some((r) => pathname.startsWith(r))) return
    // "Agora não" cala o convite até a aba fechar. Na próxima visita ele volta,
    // porque o perfil continua incompleto — mas ninguém fica preso num popup.
    try {
      if (sessionStorage.getItem(CHAVE_ADIADO)) return
    } catch {
      // Aba anônima com storage bloqueado: mostra o convite mesmo assim.
    }
    setAberto(true)
  }, [pathname])

  function completar() {
    const query = searchParams.toString()
    const retorno = `${pathname}${query ? `?${query}` : ''}`
    setAberto(false)
    router.push(`/perfil?retorno=${encodeURIComponent(retorno)}`)
  }

  function adiar() {
    try {
      sessionStorage.setItem(CHAVE_ADIADO, '1')
    } catch {
      // idem
    }
    setAberto(false)
  }

  return (
    <Dialog open={aberto} onOpenChange={(v) => (v ? setAberto(true) : adiar())}>
      <DialogContent className="sm:max-w-sm" showCloseButton={false}>
        <DialogHeader className="items-center text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Sparkles className="h-7 w-7" />
          </div>
          <DialogTitle className="text-lg">
            {primeiroAcesso
              ? `Bem-vindo${primeiroNome ? `, ${primeiroNome}` : ''}! 👋`
              : `${primeiroNome || 'Ei'}, falta terminar seu cadastro`}
          </DialogTitle>
          <DialogDescription className="text-center leading-relaxed">
            {pendencias.length === 1
              ? 'Falta um dado para a igreja saber como falar com você.'
              : `Faltam ${pendencias.length} dados para a igreja saber como falar com você.`}
            {' '}Leva menos de um minuto.
          </DialogDescription>
        </DialogHeader>

        {/* O que está pendente, item por item — some da lista assim que preenche */}
        <ul className="space-y-2 rounded-xl border border-amber-200 bg-amber-50/60 p-3">
          {pendencias.map((p) => (
            <li key={p.campo} className="flex items-start gap-2.5">
              <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
              <span className="min-w-0">
                <span className="block text-sm font-medium leading-tight text-amber-900">
                  {p.rotulo}
                </span>
                <span className="block text-xs leading-snug text-amber-800/80">
                  {p.porque}
                </span>
              </span>
            </li>
          ))}
        </ul>

        <Button size="lg" className="w-full" onClick={completar}>
          Preencher agora
        </Button>

        <div className="flex flex-col items-center gap-2">
          <a
            href={linkSuporte('Olá! Estou terminando meu cadastro no app da igreja e fiquei com uma dúvida.')}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 hover:text-emerald-800 transition-colors"
          >
            <MessageCircle className="h-3.5 w-3.5" />
            Tirar dúvida no WhatsApp
          </a>
          <button
            type="button"
            onClick={adiar}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Agora não
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
