import { Competencia } from '../../src/domain/entidades/competencia.js';
import { ParticipacaoProjeto } from '../../src/domain/entidades/participacao-projeto.js';
import type { Profissional } from '../../src/domain/entidades/profissional.js';
import type { Projeto } from '../../src/domain/entidades/projeto.js';
import { Papel } from '../../src/domain/enums/papel.js';
import { TipoCaptacao } from '../../src/domain/enums/tipo-captacao.js';
import { FaixaPreco } from '../../src/domain/value-objects/faixa-preco.js';
import { Localizacao } from '../../src/domain/value-objects/localizacao.js';
import {
  RIO_DE_JANEIRO,
  SAO_PAULO,
  criarAvaliacao,
  criarProfissional,
  criarProjeto,
} from './dominio.js';

export const BELO_HORIZONTE = Localizacao.criar({
  cidade: 'Belo Horizonte',
  uf: 'MG',
  latitude: -19.9167,
  longitude: -43.9345,
});

export const IDS_DEMONSTRACAO = {
  DIRETORA_TECNICA: 'diretora-tecnica',
  DIRETORA_CONSAGRADA: 'diretora-consagrada',
  DIRETOR_LOCAL: 'diretor-local-economico',
  EDITOR: 'editor-versatil',
} as const;

function historicoComoDiretor(quantidade: number): ParticipacaoProjeto[] {
  return Array.from({ length: quantidade }, (_, indice) =>
    ParticipacaoProjeto.criar({
      projetoId: `longa-${indice + 1}`,
      titulo: `Longa ${indice + 1}`,
      papel: Papel.DIRETOR,
      genero: 'drama',
      tipoCaptacao: TipoCaptacao.FICCAO,
      ano: 2018 + indice,
    }),
  );
}

export function criarCadastroDemonstracao(): Profissional[] {
  return [
    criarProfissional({
      id: IDS_DEMONSTRACAO.DIRETORA_TECNICA,
      nome: 'Helena Técnica',
      especialidades: [Papel.DIRETOR],
      competencias: [
        Competencia.criar('Direção de atores', 5),
        Competencia.criar('Decupagem', 4),
        Competencia.criar('Liderança', 5),
        Competencia.criar('Roteiro', 2),
      ],
      historico: historicoComoDiretor(5),
      faixaPreco: FaixaPreco.criar(50_000, 60_000),
      localizacao: RIO_DE_JANEIRO,
    }),
    criarProfissional({
      id: IDS_DEMONSTRACAO.DIRETORA_CONSAGRADA,
      nome: 'Marta Consagrada',
      especialidades: [Papel.DIRETOR],
      competencias: [Competencia.criar('Fotografia', 3), Competencia.criar('Roteiro', 3)],
      avaliacoes: Array.from({ length: 6 }, (_, indice) =>
        criarAvaliacao({
          nota: 5,
          produtorId: `produtor-${indice + 10}`,
          projetoId: `drama-${indice}`,
          papel: Papel.DIRETOR,
          genero: 'drama',
          tipoCaptacao: TipoCaptacao.FICCAO,
        }),
      ),
      faixaPreco: FaixaPreco.criar(40_000, 50_000),
      localizacao: BELO_HORIZONTE,
    }),
    criarProfissional({
      id: IDS_DEMONSTRACAO.DIRETOR_LOCAL,
      nome: 'Caio Local',
      especialidades: [Papel.DIRETOR],
      competencias: [Competencia.criar('Direção de atores', 3), Competencia.criar('Liderança', 3)],
      historico: historicoComoDiretor(1),
      avaliacoes: [
        criarAvaliacao({ nota: 4, genero: 'social', tipoCaptacao: TipoCaptacao.DOCUMENTARIO }),
        criarAvaliacao({ nota: 4, genero: 'social', tipoCaptacao: TipoCaptacao.DOCUMENTARIO }),
      ],
      faixaPreco: FaixaPreco.criar(8_000, 12_000),
      localizacao: SAO_PAULO,
    }),
    criarProfissional({
      id: IDS_DEMONSTRACAO.EDITOR,
      nome: 'Bia Montagem',
      especialidades: [Papel.EDITOR],
      competencias: [Competencia.criar('Montagem', 5), Competencia.criar('Edição não linear', 4)],
      faixaPreco: FaixaPreco.criar(10_000, 15_000),
      localizacao: SAO_PAULO,
    }),
  ];
}

export function criarProjetoDemonstracao(estrategia = 'similaridade-cosseno'): Projeto {
  return criarProjeto({ estrategia, genero: 'Drama', tipoCaptacao: TipoCaptacao.FICCAO });
}
