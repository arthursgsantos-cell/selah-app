'use client'

import { useState } from 'react'
import { FileText, LinkIcon, Video, Eye, ExternalLink, Lock, Globe } from 'lucide-react'
import { VisualizadorArquivo } from '@/components/shared/visualizador-arquivo'
import type { TipoMaterial } from '@/lib/supabase/types'

export interface MaterialItem {
  id: string
  titulo: string
  descricao: string | null
  tipo: TipoMaterial
  arquivoNome: string | null
  arquivoTamanho: number | null
  publico: boolean
  criadoEm: string
  aulaNumero: number | null
}

const ICONE: Record<TipoMaterial, React.ReactNode> = {
  arquivo: <FileText className="h-4 w-4" />,
  link: <LinkIcon className="h-4 w-4" />,
  video: <Video className="h-4 w-4" />,
}

function tamanhoLegivel(bytes: number | null): string | null {
  if (!bytes) return null
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/**
 * Lista de materiais de uma turma.
 *
 * Todos os itens apontam para `/api/ensino/material/[id]`, inclusive os links
 * externos: assim o controle de acesso é o mesmo para arquivo e para link, e a
 * URL do Drive não fica no HTML de quem não deveria vê-la.
 *
 * Arquivo abre no visualizador, sobre a tela. Antes o item baixava direto no
 * clique — para conferir se era o material certo a pessoa tinha que salvar o
 * arquivo e abrir fora do app. Agora o download é uma escolha dentro do
 * diálogo. Link e vídeo continuam indo para fora, que é o destino deles.
 */
export function MateriaisLista({
  materiais,
  acoes,
  vazio = 'Nenhum material publicado ainda.',
}: {
  materiais: MaterialItem[]
  /** Botões de editar/excluir, renderizados pelo painel do professor. */
  acoes?: (material: MaterialItem) => React.ReactNode
  vazio?: string
}) {
  const [aberto, setAberto] = useState<MaterialItem | null>(null)

  if (materiais.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border py-10 text-center">
        <FileText className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">{vazio}</p>
      </div>
    )
  }

  return (
    <>
      <div className="rounded-2xl border border-border divide-y overflow-hidden">
        {materiais.map((m) => {
          const tamanho = tamanhoLegivel(m.arquivoTamanho)
          const ehArquivo = m.tipo === 'arquivo'

          const miolo = (
            <>
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                {ICONE[m.tipo]}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium leading-snug group-hover:text-primary transition-colors">
                  {m.titulo}
                </p>
                {m.descricao && (
                  <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{m.descricao}</p>
                )}
                <p className="text-[11px] text-muted-foreground/70 mt-1 flex items-center gap-1.5 flex-wrap">
                  {m.aulaNumero !== null && <span>Aula {m.aulaNumero}</span>}
                  {m.arquivoNome && <span className="truncate max-w-[10rem]">{m.arquivoNome}</span>}
                  {tamanho && <span>{tamanho}</span>}
                  <span className="inline-flex items-center gap-0.5">
                    {m.publico ? <Globe className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
                    {m.publico ? 'Público' : 'Só da turma'}
                  </span>
                </p>
              </div>
              {ehArquivo
                ? <Eye className="h-4 w-4 shrink-0 text-muted-foreground" />
                : <ExternalLink className="h-4 w-4 shrink-0 text-muted-foreground" />}
            </>
          )

          return (
            <div key={m.id} className="flex items-center gap-3 px-3 py-3">
              {ehArquivo ? (
                <button
                  type="button"
                  onClick={() => setAberto(m)}
                  className="flex items-center gap-3 min-w-0 flex-1 group text-left"
                >
                  {miolo}
                </button>
              ) : (
                <a
                  href={`/api/ensino/material/${m.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 min-w-0 flex-1 group"
                >
                  {miolo}
                </a>
              )}
              {acoes && <div className="shrink-0 flex items-center gap-1">{acoes(m)}</div>}
            </div>
          )
        })}
      </div>

      {aberto && (
        <VisualizadorArquivo
          aberto
          aoFechar={() => setAberto(null)}
          titulo={aberto.titulo}
          nomeArquivo={aberto.arquivoNome}
          urlVer={`/api/ensino/material/${aberto.id}?modo=ver`}
          urlBaixar={`/api/ensino/material/${aberto.id}`}
        />
      )}
    </>
  )
}
