import type { DadosCriacaoProjeto } from '../../domain/entidades/projeto.js';
import { RequisitoPapel } from '../../domain/entidades/requisito-papel.js';
import { Papel } from '../../domain/enums/papel.js';
import { TipoCaptacao } from '../../domain/enums/tipo-captacao.js';
import { Localizacao } from '../../domain/value-objects/localizacao.js';
import type { RegistroFabricas } from '../familias/registro-fabricas.js';
import type { ModeloProjeto } from './catalogo-modelos.js';

interface DefinicaoModelo {
  readonly id: string;
  readonly nome: string;
  readonly descricao: string;
  readonly tipo: string;
  readonly dados: Omit<DadosCriacaoProjeto, 'estrategia' | 'localizacao' | 'produtorId'>;
}

const INICIO_REFERENCIA = new Date('2027-01-04T00:00:00.000Z');

function diasDepois(dias: number): Date {
  return new Date(INICIO_REFERENCIA.getTime() + dias * 86_400_000);
}

function requisitos(pesos: Partial<Record<Papel, number>>): RequisitoPapel[] {
  return Object.entries(pesos).map(([papel, peso]) => RequisitoPapel.criar(papel as Papel, peso));
}

const DEFINICOES: readonly DefinicaoModelo[] = [
  {
    id: 'documentario-entrevistas',
    nome: 'Documentário de entrevistas',
    descricao:
      'Longa documental guiado por entrevistas: direção, roteiro de pesquisa, som direto e montagem.',
    tipo: TipoCaptacao.DOCUMENTARIO,
    dados: {
      titulo: 'Documentário de entrevistas',
      genero: 'social',
      duracaoMinutos: 75,
      orcamento: 180_000,
      dataInicio: INICIO_REFERENCIA,
      dataEntrega: diasDepois(120),
      requisitos: requisitos({
        [Papel.DIRETOR]: 5,
        [Papel.ROTEIRISTA]: 3,
        [Papel.SONOPLASTA]: 4,
        [Papel.EDITOR]: 4,
        [Papel.DIRETOR_FOTOGRAFIA]: 3,
      }),
      detalhes: { tema: 'Tema a definir', entrevistados: [] },
    },
  },
  {
    id: 'animacao-3d-curta',
    nome: 'Curta de animação 3D',
    descricao: 'Curta em 3D com pipeline de modelagem, animação e renderização.',
    tipo: TipoCaptacao.ANIMACAO,
    dados: {
      titulo: 'Curta de animação 3D',
      genero: 'infantil',
      duracaoMinutos: 15,
      orcamento: 250_000,
      dataInicio: INICIO_REFERENCIA,
      dataEntrega: diasDepois(180),
      requisitos: requisitos({
        [Papel.DIRETOR]: 5,
        [Papel.EFEITOS_VISUAIS]: 5,
        [Papel.ROTEIRISTA]: 3,
        [Papel.SONOPLASTA]: 2,
        [Papel.EDITOR]: 3,
      }),
      detalhes: { tecnica: '3D', softwares: ['Blender', 'Maya'], quadrosPorSegundo: 24 },
    },
  },
  {
    id: 'publicitario-digital',
    nome: 'Campanha publicitária digital',
    descricao: 'Pacote de peças curtas para redes e streaming, com foco em imagem e ritmo.',
    tipo: TipoCaptacao.PUBLICITARIO,
    dados: {
      titulo: 'Campanha publicitária digital',
      genero: 'publicidade',
      duracaoMinutos: 1,
      orcamento: 90_000,
      dataInicio: INICIO_REFERENCIA,
      dataEntrega: diasDepois(45),
      requisitos: requisitos({
        [Papel.DIRETOR]: 5,
        [Papel.DIRETOR_FOTOGRAFIA]: 4,
        [Papel.EDITOR]: 4,
        [Papel.SONOPLASTA]: 2,
      }),
      detalhes: { marca: 'Marca a definir', veiculacao: ['DIGITAL'], pecas: 3 },
    },
  },
  {
    id: 'ficcao-longa',
    nome: 'Longa de ficção',
    descricao: 'Longa-metragem de ficção com todos os papéis técnicos.',
    tipo: TipoCaptacao.FICCAO,
    dados: {
      titulo: 'Longa de ficção',
      genero: 'drama',
      duracaoMinutos: 100,
      orcamento: 600_000,
      dataInicio: INICIO_REFERENCIA,
      dataEntrega: diasDepois(150),
      requisitos: requisitos({
        [Papel.DIRETOR]: 5,
        [Papel.ROTEIRISTA]: 4,
        [Papel.DIRETOR_FOTOGRAFIA]: 4,
        [Papel.EDITOR]: 4,
        [Papel.SONOPLASTA]: 3,
        [Papel.EFEITOS_VISUAIS]: 2,
      }),
    },
  },
];

export const PRODUTOR_MODELO = 'cinebridge-modelos';

export const LOCAL_MODELO = Localizacao.criar({
  cidade: 'São Paulo',
  uf: 'SP',
  latitude: -23.5505,
  longitude: -46.6333,
});

export function criarModelosPadrao(fabricas: RegistroFabricas): ModeloProjeto[] {
  return DEFINICOES.filter((definicao) => fabricas.existe(definicao.tipo)).map((definicao) => {
    const fabrica = fabricas.para(definicao.tipo);
    return {
      id: definicao.id,
      nome: definicao.nome,
      descricao: definicao.descricao,
      prototipo: fabrica.criarProjeto({
        ...definicao.dados,
        id: `modelo-${definicao.id}`,
        produtorId: PRODUTOR_MODELO,
        localizacao: LOCAL_MODELO,
        estrategia: fabrica.criarRecomendador().nome,
        criadoEm: INICIO_REFERENCIA,
      }),
    };
  });
}
