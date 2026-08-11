'use client'

import { useState } from 'react'
import { FileText, LinkIcon, Eye, ExternalLink } from 'lucide-react'
import { VisualizadorArquivo } from '@/components/shared/visualizador-arquivo'
import type { TipoMaterial } from '@/lib/supabase/types'

export interface MaterialAula {
  id: string
  titulo: string
  descricao: string | null
  tipo: TipoMaterial
  arquivoNome: string | null
  arquivoTamanho: number | null
}

function tamanhoLegivel(bytes: number | null): string | null {
  if (!bytes) return null
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/**
 * Materiais de uma aula.
 *
 * Documento abre num diálogo, sem sair da aula — quem está acompanhando a aula
 * perde o fio se o PDF sequestra a aba. Link externo, ao contrário, abre em
 * guia nova: ele leva para fora do app de qualquer jeito, e prender um site de
 * terceiro num iframe costuma dar tela branca (`X-Frame-Options`).
 *
 * O download não fica mais no item da lista. Ele mora dentro do diálogo, junto
 * do arquivo que a pessoa acabou de ver — ninguém precisa salvar um arquivo
 * para descobrir o que ele é.
 *
 * Tudo passa por `/api/ensino/material/[id]`, inclusive os links: a policy
 * `ensino_materiais_select` continua sendo quem autoriza, e o endereço do Drive
 * não fica no HTML de quem não deveria vê-lo.
 */
export function MateriaisAula({ materiais }: { materiais: MaterialAula[] }) {
  const [aberto, setAberto] = useState<MaterialAula | null>(null)

  const arquivos = materiais.filter((m) => m.tipo === 'arquivo')
  const links = materiais.filter((m) => m.tipo !== 'arquivo')

  if (materiais.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border py-10 text-center">
        <FileText className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">Nenhum material nesta aula ainda.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {arquivos.length > 0 && (
        <div className="rounded-2xl border border-border bg-card divide-y overflow-hidden">
          {arquivos.map((m) => {
            const tamanho = tamanhoLegivel(m.arquivoTamanho)

            return (
              <button
                key={m.id}
                type="button"
                onClick={() => setAberto(m)}
                className="flex w-full items-center gap-3 px-3 py-3 text-left group hover:bg-accent/50 transition-colors"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <FileText className="h-4 w-4" />
                </div>

                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium leading-snug group-hover:text-primary transition-colors">
                    {m.titulo}
                  </p>
                  {m.descricao && (
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                      {m.descricao}
                    </p>
                  )}
                  <p className="text-[11px] text-muted-foreground/70 mt-1 flex items-center gap-1.5 flex-wrap">
                    {m.arquivoNome && (
                      <span className="truncate max-w-[12rem]">{m.arquivoNome}</span>
                    )}
                    {tamanho && <span>{tamanho}</span>}
                  </p>
                </div>

                <span className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg bg-primary text-primary-foreground shrink-0">
                  <Eye className="h-3.5 w-3.5" />
                  Ver
                </span>
              </button>
            )
          })}
        </div>
      )}

      {links.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {links.map((m) => (
            <a
              key={m.id}
              href={`/api/ensino/material/${m.id}`}
              target="_blank"
              rel="noopener noreferrer"
              title={m.descricao ?? undefined}
              className="inline-flex items-center gap-2 text-sm font-medium px-3.5 py-2 rounded-xl border border-border bg-card hover:bg-accent transition-colors"
            >
              <LinkIcon className="h-4 w-4 text-primary shrink-0" />
              <span className="truncate max-w-[16rem]">{m.titulo}</span>
              <ExternalLink className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            </a>
          ))}
        </div>
      )}

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
    </div>
  )
}
