'use client'

import { useMemo, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { FileSpreadsheet, Loader2, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import { importarAlunosAction, type ResultadoImportacao } from '@/app/actions/ensino/alunos-manuais'
import { lerPlanilhaAlunos, separarValidas } from '@/lib/ensino/importar-alunos'

/**
 * Importar a turma de uma planilha.
 *
 * Aceita CSV e texto colado, não `.xlsx`: o formato do Excel é um zip de XML e
 * lê-lo exigiria uma biblioteca inteira no bundle para resolver o que
 * "Salvar como → CSV" resolve em dois cliques. Colar direto da planilha
 * também funciona — o Excel copia com tabulação entre as colunas, e o leitor
 * reconhece.
 *
 * A prévia aparece antes de qualquer gravação. Importar quarenta nomes é o
 * tipo de ação que ninguém quer descobrir errada depois de feita.
 */
export function ImportarAlunos({ turmaId }: { turmaId: string }) {
  const router = useRouter()
  const [aberto, setAberto] = useState(false)
  const [texto, setTexto] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [resultado, setResultado] = useState<ResultadoImportacao | null>(null)
  const [importando, iniciar] = useTransition()
  const arquivoRef = useRef<HTMLInputElement>(null)

  const analise = useMemo(() => {
    if (!texto.trim()) return null
    return separarValidas(lerPlanilhaAlunos(texto))
  }, [texto])

  async function aoEscolherArquivo(e: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0]
    e.target.value = ''
    if (!arquivo) return
    setErro(null)
    setResultado(null)
    if (/\.xlsx?$/i.test(arquivo.name)) {
      setErro('Este é um arquivo do Excel. Abra-o e use "Salvar como → CSV", ou copie as células e cole aqui embaixo.')
      return
    }
    setTexto(await arquivo.text())
  }

  function importar() {
    if (!analise || analise.validas.length === 0) return
    setErro(null)
    iniciar(async () => {
      const r = await importarAlunosAction(turmaId, analise.validas)
      if (!r.ok) { setErro(r.erro); return }
      setResultado(r.resultado)
      router.refresh()
    })
  }

  function fechar() {
    setAberto(false)
    setTexto('')
    setErro(null)
    setResultado(null)
  }

  return (
    <Dialog open={aberto} onOpenChange={(v) => (v ? setAberto(true) : fechar())}>
      <DialogTrigger render={<Button type="button" size="sm" variant="outline" />}>
        <FileSpreadsheet className="h-4 w-4" />
        Importar planilha
      </DialogTrigger>

      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Importar alunos</DialogTitle>
        </DialogHeader>

        {resultado ? (
          <div className="space-y-3">
            <p className="text-sm">
              <strong>{resultado.importados}</strong>{' '}
              {resultado.importados === 1 ? 'aluno importado' : 'alunos importados'}.
              {resultado.jaEstavam > 0 && (
                <> {resultado.jaEstavam} já {resultado.jaEstavam === 1 ? 'estava' : 'estavam'} na turma.</>
              )}
            </p>

            {resultado.falhas.length > 0 && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                <p className="text-xs font-semibold text-amber-800">
                  {resultado.falhas.length} {resultado.falhas.length === 1 ? 'linha não entrou' : 'linhas não entraram'}
                </p>
                <ul className="mt-1.5 space-y-1">
                  {resultado.falhas.map((f) => (
                    <li key={f.linha} className="text-xs text-amber-900">
                      Linha {f.linha} ({f.nome || 'sem nome'}): {f.motivo}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <Button className="w-full" onClick={fechar}>Fechar</Button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground leading-relaxed">
              Três colunas, nesta ordem: <strong>nome; telefone; e-mail</strong>. Só o
              nome é obrigatório. Se a planilha tiver uma linha de cabeçalho, ela é
              ignorada.
            </p>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => arquivoRef.current?.click()}
              >
                <Upload className="h-3.5 w-3.5" />
                Escolher arquivo CSV
              </Button>
              <input
                ref={arquivoRef}
                type="file"
                accept=".csv,.txt,text/csv,text/plain"
                className="hidden"
                onChange={aoEscolherArquivo}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="imp-texto" className="text-xs">
                …ou cole as células aqui
              </Label>
              <Textarea
                id="imp-texto"
                value={texto}
                onChange={(e) => { setTexto(e.target.value); setResultado(null) }}
                rows={6}
                placeholder={'Maria Silva;84999990000;maria@email.com\nJoão Souza;84988887777;joao@email.com'}
                className="text-sm font-mono resize-none"
              />
            </div>

            {analise && (
              <div className="rounded-xl border border-border p-3 space-y-2">
                <p className="text-xs font-semibold">
                  {analise.validas.length}{' '}
                  {analise.validas.length === 1 ? 'linha pronta' : 'linhas prontas'} para importar
                </p>

                {analise.validas.length > 0 && (
                  <div className="max-h-40 overflow-y-auto rounded-lg bg-muted/40">
                    {analise.validas.slice(0, 30).map((l) => (
                      <div key={l.linha} className="flex gap-2 px-2 py-1 text-xs">
                        <span className="w-6 shrink-0 text-right tabular-nums text-muted-foreground">
                          {l.linha}
                        </span>
                        <span className="min-w-0 flex-1 truncate">{l.nome}</span>
                        <span className="shrink-0 text-muted-foreground">
                          {l.telefone ?? '—'}
                        </span>
                      </div>
                    ))}
                    {analise.validas.length > 30 && (
                      <p className="px-2 py-1 text-xs text-muted-foreground">
                        e mais {analise.validas.length - 30}…
                      </p>
                    )}
                  </div>
                )}

                {analise.duplicadas.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {analise.duplicadas.length} repetida(s) na própria planilha —
                    entra só a primeira.
                  </p>
                )}

                {analise.invalidas.length > 0 && (
                  <ul className="space-y-0.5">
                    {analise.invalidas.slice(0, 5).map((l) => (
                      <li key={l.linha} className="text-xs text-destructive">
                        Linha {l.linha}: {l.erro}
                      </li>
                    ))}
                    {analise.invalidas.length > 5 && (
                      <li className="text-xs text-destructive">
                        e mais {analise.invalidas.length - 5} com problema…
                      </li>
                    )}
                  </ul>
                )}
              </div>
            )}

            {erro && <p className="text-sm text-destructive">{erro}</p>}

            <div className="flex gap-2">
              <Button
                className="flex-1"
                onClick={importar}
                disabled={importando || !analise || analise.validas.length === 0}
              >
                {importando && <Loader2 className="h-4 w-4 animate-spin" />}
                {importando
                  ? 'Importando…'
                  : `Importar ${analise?.validas.length ?? 0}`}
              </Button>
              <Button variant="ghost" onClick={fechar} disabled={importando}>
                Cancelar
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
