import { garantir, garantirTexto } from '../comum/erro-dominio.js';
import { gerarId } from '../comum/identificador.js';
import type { Papel } from '../enums/papel.js';
import type { FaixaPreco } from '../value-objects/faixa-preco.js';
import type { Intervalo } from '../value-objects/intervalo.js';
import type { Localizacao } from '../value-objects/localizacao.js';
import { VetorCompetencia } from '../value-objects/vetor-competencia.js';
import type { VisitanteProjeto, Visitavel } from '../visitante/visitante-projeto.js';
import type { Avaliacao } from './avaliacao.js';
import type { Competencia } from './competencia.js';
import type { ParticipacaoProjeto } from './participacao-projeto.js';

export interface DadosProfissional {
  id?: string;
  nome: string;
  especialidades: readonly Papel[];
  competencias: readonly Competencia[];
  avaliacoes?: readonly Avaliacao[];
  historico?: readonly ParticipacaoProjeto[];
  faixaPreco: FaixaPreco;
  disponibilidades: readonly Intervalo[];
  localizacao: Localizacao;
  ativo?: boolean;
}

export class Profissional implements Visitavel {
  readonly especialidades: ReadonlySet<Papel>;
  readonly vetorCompetencias: VetorCompetencia;
  readonly notaMedia: number;

  private constructor(
    readonly id: string,
    readonly nome: string,
    especialidades: readonly Papel[],
    readonly competencias: readonly Competencia[],
    readonly avaliacoes: readonly Avaliacao[],
    readonly historico: readonly ParticipacaoProjeto[],
    readonly faixaPreco: FaixaPreco,
    readonly disponibilidades: readonly Intervalo[],
    readonly localizacao: Localizacao,
    readonly ativo: boolean,
  ) {
    this.especialidades = new Set(especialidades);
    this.vetorCompetencias = VetorCompetencia.de(
      competencias.map((competencia) => [competencia.nome, competencia.nivelNormalizado] as const),
    );
    this.notaMedia =
      avaliacoes.length === 0
        ? 0
        : avaliacoes.reduce((soma, avaliacao) => soma + avaliacao.nota, 0) / avaliacoes.length;
  }

  static criar(dados: DadosProfissional): Profissional {
    garantir(
      dados.especialidades.length > 0,
      'Profissional precisa de ao menos uma especialidade.',
    );
    return new Profissional(
      dados.id ?? gerarId(),
      garantirTexto(dados.nome, 'Nome do profissional'),
      dados.especialidades,
      [...dados.competencias],
      [...(dados.avaliacoes ?? [])],
      [...(dados.historico ?? [])],
      dados.faixaPreco,
      [...dados.disponibilidades],
      dados.localizacao,
      dados.ativo ?? true,
    );
  }

  get totalAvaliacoes(): number {
    return this.avaliacoes.length;
  }

  atuaComo(papel: Papel): boolean {
    return this.especialidades.has(papel);
  }

  disponivelEm(periodo: Intervalo): boolean {
    return this.disponibilidades.some((disponibilidade) => disponibilidade.contem(periodo));
  }

  experienciaComo(papel: Papel): number {
    return this.historico.filter((participacao) => participacao.papel === papel).length;
  }

  aceitar<R>(visitante: VisitanteProjeto<R>): R {
    return visitante.visitarProfissional(this);
  }
}
