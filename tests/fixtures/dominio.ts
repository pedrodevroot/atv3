import { Avaliacao, type DadosAvaliacao } from '../../src/domain/entidades/avaliacao.js';
import { Competencia } from '../../src/domain/entidades/competencia.js';
import { Equipe, type DadosEquipe } from '../../src/domain/entidades/equipe.js';
import { MembroEquipe, type DadosMembroEquipe } from '../../src/domain/entidades/membro-equipe.js';
import { Profissional, type DadosProfissional } from '../../src/domain/entidades/profissional.js';
import type {
  DadosCriacaoProjeto,
  DadosProjeto,
  Projeto,
} from '../../src/domain/entidades/projeto.js';
import { RequisitoPapel } from '../../src/domain/entidades/requisito-papel.js';
import { Papel } from '../../src/domain/enums/papel.js';
import { TipoCaptacao } from '../../src/domain/enums/tipo-captacao.js';
import { FaixaPreco } from '../../src/domain/value-objects/faixa-preco.js';
import { Intervalo } from '../../src/domain/value-objects/intervalo.js';
import { Localizacao } from '../../src/domain/value-objects/localizacao.js';
import { DETALHES_PADRAO, fabricasTeste } from './fabricas.js';

export const INICIO_PROJETO = new Date('2026-10-01T00:00:00.000Z');
export const ENTREGA_PROJETO = new Date('2026-12-30T00:00:00.000Z');
export const ANO_TODO = Intervalo.criar(
  new Date('2026-01-01T00:00:00.000Z'),
  new Date('2027-12-31T00:00:00.000Z'),
);

export const SAO_PAULO = Localizacao.criar({
  cidade: 'São Paulo',
  uf: 'SP',
  latitude: -23.5505,
  longitude: -46.6333,
});

export const RIO_DE_JANEIRO = Localizacao.criar({
  cidade: 'Rio de Janeiro',
  uf: 'RJ',
  latitude: -22.9068,
  longitude: -43.1729,
});

export function criarProfissional(dados: Partial<DadosProfissional> = {}): Profissional {
  return Profissional.criar({
    nome: 'Ana Souza',
    especialidades: [Papel.DIRETOR],
    competencias: [Competencia.criar('direção de atores', 5), Competencia.criar('roteiro', 3)],
    faixaPreco: FaixaPreco.criar(10_000, 20_000),
    disponibilidades: [ANO_TODO],
    localizacao: SAO_PAULO,
    ...dados,
  });
}

export function criarAvaliacao(dados: Partial<DadosAvaliacao> = {}): Avaliacao {
  return Avaliacao.criar({
    nota: 5,
    data: new Date('2025-06-01T00:00:00.000Z'),
    produtorId: 'produtor-1',
    projetoId: 'projeto-antigo',
    papel: Papel.DIRETOR,
    genero: 'drama',
    tipoCaptacao: TipoCaptacao.FICCAO,
    ...dados,
  });
}

export type DadosProjetoTeste = Partial<DadosCriacaoProjeto> & { tipoCaptacao?: TipoCaptacao };

export function dadosProjetoBase(dados: Partial<DadosProjeto> = {}): DadosProjeto {
  return {
    titulo: 'Vozes do Sertão',
    produtorId: 'produtor-1',
    genero: 'drama',
    duracaoMinutos: 90,
    orcamento: 100_000,
    dataInicio: INICIO_PROJETO,
    dataEntrega: ENTREGA_PROJETO,
    localizacao: SAO_PAULO,
    requisitos: [RequisitoPapel.criar(Papel.DIRETOR, 5), RequisitoPapel.criar(Papel.EDITOR, 3)],
    estrategia: 'similaridade-cosseno',
    ...dados,
  };
}

export function criarProjeto({
  tipoCaptacao = TipoCaptacao.FICCAO,
  detalhes = DETALHES_PADRAO[tipoCaptacao],
  ...dados
}: DadosProjetoTeste = {}): Projeto {
  return fabricasTeste.para(tipoCaptacao).criarProjeto({ ...dadosProjetoBase(dados), detalhes });
}

export function criarMembro(
  papel: Papel,
  dados: Partial<Omit<DadosMembroEquipe, 'papel'>> = {},
): MembroEquipe {
  return MembroEquipe.criar({
    papel,
    profissional: dados.profissional ?? criarProfissional({ especialidades: [papel] }),
    custo: 15_000,
    score: 0.8,
    ...dados,
  });
}

export function criarEquipe(projeto: Projeto, dados: Partial<DadosEquipe> = {}): Equipe {
  return Equipe.criar({
    projetoId: projeto.id,
    estrategia: projeto.estrategia,
    membros: projeto.papeisObrigatorios.map((papel) => criarMembro(papel)),
    ...dados,
  });
}
