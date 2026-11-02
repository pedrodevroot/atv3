import type { Equipe } from '../../domain/entidades/equipe.js';
import type { MembroEquipe } from '../../domain/entidades/membro-equipe.js';
import type { Profissional } from '../../domain/entidades/profissional.js';
import type { Projeto } from '../../domain/entidades/projeto.js';
import type { VisitanteProjeto } from '../../domain/visitante/visitante-projeto.js';
import { CalculadorCompatibilidade } from './calculador-compatibilidade.js';
import { equipesRelevantes, formatarData, formatarMoeda } from './navegacao.js';
import { ValidadorConsistencia } from './validador-consistencia.js';

export class GeradorRelatorio implements VisitanteProjeto<string> {
  private readonly validador: ValidadorConsistencia;
  private readonly calculador: CalculadorCompatibilidade;

  constructor(
    private readonly projeto: Projeto,
    private readonly geradoEm: Date = new Date(),
  ) {
    this.validador = new ValidadorConsistencia(projeto);
    this.calculador = new CalculadorCompatibilidade(projeto);
  }

  visitarProjeto(projeto: Projeto): string {
    const equipes = equipesRelevantes(projeto);
    const secoesEquipes =
      equipes.length === 0
        ? ['Nenhuma equipe sugerida ou formada.']
        : equipes.map((equipe) => equipe.aceitar(this));
    return [
      `# Relatório do projeto "${projeto.titulo}"`,
      `Gerado em ${formatarData(this.geradoEm)}`,
      '',
      `- Produtor: ${projeto.produtorId}`,
      `- Gênero / captação: ${projeto.genero} / ${projeto.tipoCaptacao}`,
      ...linhaDetalhes(projeto),
      `- Duração: ${projeto.duracaoMinutos} min`,
      `- Orçamento: ${formatarMoeda(projeto.orcamento)}`,
      `- Período: ${formatarData(projeto.periodo.inicio)} a ${formatarData(projeto.dataEntrega)}`,
      `- Local: ${projeto.localizacao.cidade}/${projeto.localizacao.uf}`,
      `- Estratégia: ${projeto.estrategia}`,
      `- Papéis obrigatórios: ${projeto.requisitos
        .map((requisito) => `${requisito.papel} (peso ${requisito.peso})`)
        .join(', ')}`,
      '',
      secoesEquipes.join('\n\n'),
    ].join('\n');
  }

  visitarEquipe(equipe: Equipe): string {
    const validacao = equipe.aceitar(this.validador);
    const compatibilidade = equipe.aceitar(this.calculador);
    const saldo = this.projeto.orcamento - equipe.custoTotal;
    const membros = this.projeto.papeisObrigatorios.map((papel) => {
      const membro = equipe.membro(papel);
      return membro ? membro.aceitar(this) : `- ${papel}: vago`;
    });
    const pendencias =
      validacao.problemas.length === 0
        ? []
        : [
            '',
            '### Pendências',
            ...validacao.problemas.map(
              (problema) => `- [${problema.severidade}] ${problema.mensagem}`,
            ),
          ];
    return [
      `## Equipe ${equipe.id} (${equipe.status}, rodada ${equipe.rodada})`,
      `Custo total: ${formatarMoeda(equipe.custoTotal)} | Saldo: ${formatarMoeda(saldo)}`,
      `Compatibilidade: ${compatibilidade.toFixed(2)} | Consistência: ${validacao.valido ? 'OK' : 'com erros'}`,
      '',
      ...membros,
      ...pendencias,
    ].join('\n');
  }

  visitarMembro(membro: MembroEquipe): string {
    return [
      `- ${membro.papel}: ${membro.profissional.nome} (${membro.status}) - ${formatarMoeda(membro.custo)} - score ${membro.score.toFixed(2)}`,
      `  ${membro.profissional.aceitar(this)}`,
    ].join('\n');
  }

  visitarProfissional(profissional: Profissional): string {
    const nota =
      profissional.totalAvaliacoes === 0
        ? 'sem avaliações'
        : `nota ${profissional.notaMedia.toFixed(1)} (${profissional.totalAvaliacoes} avaliações)`;
    return `${profissional.localizacao.cidade}/${profissional.localizacao.uf}; ${nota}; ${profissional.historico.length} projeto(s) no histórico`;
  }
}

function linhaDetalhes(projeto: Projeto): string[] {
  const detalhes = Object.entries(projeto.detalhes).map(
    ([campo, valor]) =>
      `${campo}: ${Array.isArray(valor) ? valor.join(', ') || '-' : String(valor)}`,
  );
  return detalhes.length === 0 ? [] : [`- Detalhes do tipo: ${detalhes.join('; ')}`];
}

export function gerarRelatorio(projeto: Projeto, geradoEm?: Date): string {
  return projeto.aceitar(new GeradorRelatorio(projeto, geradoEm));
}
