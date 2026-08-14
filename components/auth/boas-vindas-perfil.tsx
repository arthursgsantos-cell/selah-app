'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'

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
}

/**
 * Boas-vindas de quem entrou pela primeira vez.
 *
 * Quem chega pelo Google traz só nome e e-mail. Sem telefone e sem data de
 * nascimento a liderança não consegue chamar no WhatsApp nem parabenizar, e a
 * pessoa não descobre sozinha que existe uma tela de perfil.
 *
 * O convite tem um botão só, e ele carrega o caminho de volta: quem foi
 * interrompido no meio de uma inscrição de curso volta para o curso ao salvar
 * o perfil, em vez de aterrissar na home e ter de procurar tudo de novo. Ver
 * `?retorno=` em `app/(app)/perfil/page.tsx`.
 */
export function BoasVindasPerfil({ primeiroNome }: Props) {
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
            Bem-vindo{primeiroNome ? `, ${primeiroNome}` : ''}! 👋
          </DialogTitle>
          <DialogDescription className="text-center leading-relaxed">
            Falta pouco: preencha seus dados para a igreja saber como falar com
            você. Leva menos de um minuto.
          </DialogDescription>
        </DialogHeader>

        <Button size="lg" className="w-full" onClick={completar}>
          Preencher meus dados
        </Button>

        <button
          type="button"
          onClick={adiar}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Agora não
        </button>
      </DialogContent>
    </Dialog>
  )
}
