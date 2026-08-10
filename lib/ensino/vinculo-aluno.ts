/**
 * Liga o que o professor lançou à mão ao perfil que a pessoa criou depois.
 *
 * O aluno cadastrado pelo painel vive como `membros_pre_cadastro` sem conta: a
 * inscrição aponta para ele por `pre_cadastro_id` e tem `user_id` nulo. No dia
 * em que a pessoa entra no app e é reconhecida — pelo e-mail no onboarding, por
 * confirmação dela mesma ou pela mão da coordenação em `/pendencias` —, é esta
 * função que costura os dois lados: as inscrições e as presenças que já
 * existiam passam a ser dela.
 *
 * Chamada dos três pontos onde um pré-cadastro ganha `profile_id`
 * (`app/actions/onboarding.ts` e `app/actions/pre-cadastro.ts`), sempre depois
 * de o vínculo estar gravado.
 */

import type { createAdminClient } from '@/lib/supabase/admin'

type Admin = ReturnType<typeof createAdminClient>

/**
 * Devolve quantas inscrições passaram a ter dono. Nunca lança: o vínculo do
 * pré-cadastro é o que importa para quem chama, e o Ensino é consequência —
 * uma falha aqui não pode derrubar a criação do perfil.
 */
export async function vincularInscricoesEnsino(
  admin: Admin,
  preCadastroId: string,
  userId: string
): Promise<number> {
  try {
    const { data: manuais } = await admin
      .from('ensino_inscricoes')
      .select('id, turma_id')
      .eq('pre_cadastro_id', preCadastroId)
      .is('user_id', null)

    if (!manuais?.length) return 0

    // As inscrições que a própria pessoa já tinha feita, para saber onde há
    // duas linhas para a mesma turma.
    const { data: proprias } = await admin
      .from('ensino_inscricoes')
      .select('id, turma_id')
      .eq('user_id', userId)
      .in('turma_id', manuais.map((m) => m.turma_id))

    const propriaPorTurma = new Map(
      ((proprias ?? []) as { id: string; turma_id: string }[]).map((i) => [i.turma_id, i.id])
    )

    let vinculadas = 0

    for (const manual of manuais as { id: string; turma_id: string }[]) {
      const propria = propriaPorTurma.get(manual.turma_id)

      // Caso simples: a pessoa só existia na lista do professor. A inscrição
      // muda de dono no lugar, preservando presenças e histórico.
      if (!propria) {
        await admin.from('ensino_inscricoes').update({ user_id: userId }).eq('id', manual.id)
        await admin.from('ensino_presencas').update({ user_id: userId }).eq('inscricao_id', manual.id)
        vinculadas += 1
        continue
      }

      // Duas linhas para a mesma turma: a pessoa se inscreveu pelo app e o
      // professor também a digitou. Sobrevive a inscrição do app — é a que a
      // chave `(turma_id, user_id)` reserva —, mas com as presenças da linha
      // manual, que é onde a chamada foi de fato registrada. Em caso de choque
      // na mesma aula, vale a marcação do professor.
      const { data: presencas } = await admin
        .from('ensino_presencas')
        .select('aula_id, presente, observacao, registrado_por, registrado_em')
        .eq('inscricao_id', manual.id)

      if (presencas?.length) {
        await admin.from('ensino_presencas').upsert(
          presencas.map((p) => ({ ...p, inscricao_id: propria, user_id: userId })),
          { onConflict: 'aula_id,inscricao_id' }
        )
      }

      // O `on delete cascade` leva junto as presenças da linha manual.
      await admin.from('ensino_inscricoes').delete().eq('id', manual.id)
      vinculadas += 1
    }

    return vinculadas
  } catch {
    return 0
  }
}
