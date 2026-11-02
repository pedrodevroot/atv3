import type { EventoRecomendacao, TipoEvento } from '../../domain/eventos/evento-recomendacao.js';
import type { Notificacao, TipoDestinatario } from '../ports/canais-saida.js';

export const EVENTOS_NOTIFICAVEIS: readonly TipoEvento[] = [
  'RECOMENDACAO_GERADA',
  'CONVITE_ENVIADO',
  'CONVITE_ACEITO',
  'CONVITE_RECUSADO',
  'CONVITE_EXPIRADO',
  'SUBSTITUICAO_INDISPONIVEL',
  'EQUIPE_FORMADA',
];

export function comporNotificacoes(evento: EventoRecomendacao): Notificacao[] {
  const para = (
    destinatarioId: string,
    tipoDestinatario: TipoDestinatario,
    assunto: string,
    corpo: string,
  ): Notificacao => ({ destinatarioId, tipoDestinatario, assunto, corpo, eventoId: evento.id });

  switch (evento.tipo) {
    case 'RECOMENDACAO_GERADA':
      return evento.dados.profissionais.map((profissional) =>
        para(
          profissional.profissionalId,
          'PROFISSIONAL',
          'Um produtor tem interesse no seu perfil',
          `Você foi recomendado(a) como ${profissional.papel} para o projeto ${evento.dados.projetoId}.`,
        ),
      );
    case 'CONVITE_ENVIADO':
      return [
        para(
          evento.dados.profissionalId,
          'PROFISSIONAL',
          `Convite para atuar como ${evento.dados.papel}`,
          `Você foi convidado(a) para o projeto ${evento.dados.projetoId}. Responda até ${evento.dados.expiraEm}.`,
        ),
      ];
    case 'CONVITE_ACEITO':
      return [
        para(
          evento.dados.produtorId,
          'PRODUTOR',
          `Convite aceito para ${evento.dados.papel}`,
          `O profissional ${evento.dados.profissionalId} aceitou o convite do projeto ${evento.dados.projetoId}.`,
        ),
      ];
    case 'CONVITE_RECUSADO':
      return [
        para(
          evento.dados.produtorId,
          'PRODUTOR',
          `Convite recusado para ${evento.dados.papel}`,
          `O profissional ${evento.dados.profissionalId} recusou o convite. O sistema vai buscar um substituto para ${evento.dados.papel}.`,
        ),
      ];
    case 'CONVITE_EXPIRADO':
      return [
        para(
          evento.dados.produtorId,
          'PRODUTOR',
          `Convite expirado para ${evento.dados.papel}`,
          `O profissional ${evento.dados.profissionalId} não respondeu ao convite do projeto ${evento.dados.projetoId} no prazo. O sistema vai buscar um substituto para ${evento.dados.papel}.`,
        ),
        para(
          evento.dados.profissionalId,
          'PROFISSIONAL',
          `Convite expirado para ${evento.dados.papel}`,
          `O prazo para responder ao convite do projeto ${evento.dados.projetoId} terminou.`,
        ),
      ];
    case 'SUBSTITUICAO_INDISPONIVEL':
      return [
        para(
          evento.dados.produtorId,
          'PRODUTOR',
          `Sem substituto automático para ${evento.dados.papel}`,
          `Não foi possível iniciar a nova rodada para ${evento.dados.papel} no projeto ${evento.dados.projetoId}: ${evento.dados.motivo} Escolha um substituto ou ajuste o projeto.`,
        ),
      ];
    case 'EQUIPE_FORMADA':
      return [
        para(
          evento.dados.produtorId,
          'PRODUTOR',
          'Equipe formada',
          `A equipe do projeto ${evento.dados.projetoId} foi formada com ${evento.dados.membros.length} membros.`,
        ),
        ...evento.dados.membros.map((membro) =>
          para(
            membro.profissionalId,
            'PROFISSIONAL',
            'Equipe formada',
            `Você faz parte da equipe do projeto ${evento.dados.projetoId} como ${membro.papel}.`,
          ),
        ),
      ];
    case 'SUBSTITUICAO_SOLICITADA':
    case 'MEMBRO_REJEITADO':
    case 'REAVALIACAO_SOLICITADA':
    case 'DETALHES_ATUALIZADOS':
      return [];
  }
}

export async function entregarNotificacoes(
  evento: EventoRecomendacao,
  entregar: (notificacao: Notificacao) => Promise<void>,
): Promise<void> {
  await Promise.all(comporNotificacoes(evento).map(entregar));
}
