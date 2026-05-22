import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import Link from 'next/link'
import { ArrowLeft, Users, Phone, User } from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import type { CampoFormulario } from '@/lib/supabase/types'

const statusConfig = {
  pendente:   { label: 'Pendente',   className: 'bg-yellow-100 text-yellow-700' },
  confirmado: { label: 'Confirmado', className: 'bg-green-100 text-green-700'  },
  cancelado:  { label: 'Cancelado',  className: 'bg-red-100 text-red-700'      },
}

export default async function InscritosList({ params }: { params: { eventoId: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const canView = ['pastor', 'admin', 'supervisor', 'supervisor_treinamento', 'lider'].includes(profile?.role ?? '')
  if (!canView) redirect('/home')

  const admin = createAdminClient()

  const [{ data: evento }, { data: inscritosRaw }] = await Promise.all([
    admin.from('eventos').select('titulo, data_hora, formulario_id').eq('id', params.eventoId).single(),
    admin.from('inscricoes_evento')
      .select('id, nome, telefone, dados, status, criado_em')
      .eq('evento_id', params.eventoId)
      .order('criado_em', { ascending: true }),
  ])

  if (!evento) notFound()

  let campos: CampoFormulario[] = []
  if (evento.formulario_id) {
    const { data: form } = await admin.from('formularios').select('campos').eq('id', evento.formulario_id).single()
    campos = (form?.campos ?? []) as CampoFormulario[]
  }

  const inscritos = inscritosRaw ?? []
  const ativos = inscritos.filter((i) => i.status !== 'cancelado')

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <Button variant="ghost" size="sm" render={<Link href="/eventos" />} className="-ml-1">
        <ArrowLeft className="h-4 w-4" />
        Voltar
      </Button>

      <div>
        <h1 className="text-xl font-bold">Inscritos</h1>
        <p className="text-sm text-muted-foreground">{evento.titulo}</p>
        <p className="text-xs text-muted-foreground capitalize">
          {format(new Date(evento.data_hora), "EEE, d 'de' MMM 'às' HH'h'mm", { locale: ptBR })}
        </p>
      </div>

      <div className="flex items-center gap-2">
        <Users className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">{ativos.length} {ativos.length === 1 ? 'inscrito' : 'inscritos'}</span>
      </div>

      {inscritos.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            Nenhuma inscrição ainda.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {inscritos.map((inscrito, i) => {
            const status = statusConfig[inscrito.status as keyof typeof statusConfig] ?? statusConfig.pendente
            const dados = inscrito.dados as Record<string, string>
            return (
              <Card key={inscrito.id}>
                <CardContent className="py-3 px-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-muted-foreground w-5">{i + 1}.</span>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <User className="h-3.5 w-3.5 text-muted-foreground" />
                          <p className="text-sm font-semibold">{inscrito.nome}</p>
                        </div>
                        {inscrito.telefone && (
                          <a
                            href={`https://wa.me/${inscrito.telefone.replace(/\D/g, '')}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-xs text-[#25D366] hover:underline mt-0.5"
                          >
                            <Phone className="h-3 w-3" />
                            {inscrito.telefone}
                          </a>
                        )}
                      </div>
                    </div>
                    <Badge className={`text-[10px] shrink-0 ${status.className}`}>
                      {status.label}
                    </Badge>
                  </div>

                  {/* Respostas do formulário */}
                  {campos.filter((c) => c.id !== 'nome' && c.id !== 'telefone').map((campo) => {
                    const resposta = dados[campo.id]
                    if (!resposta) return null
                    return (
                      <div key={campo.id} className="text-xs">
                        <span className="text-muted-foreground">{campo.label}: </span>
                        <span className="font-medium">{resposta}</span>
                      </div>
                    )
                  })}

                  <p className="text-[10px] text-muted-foreground">
                    {format(new Date(inscrito.criado_em), "d/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </p>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
