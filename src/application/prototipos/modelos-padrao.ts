import type { DadosCriacaoProjeto } from '../../domain/entidades/projeto.js';
import { PacoteServico } from '../../domain/entidades/servicos/pacote-servico.js';
import { ServicoAtomico } from '../../domain/entidades/servicos/servico-atomico.js';
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

function servico(
  nome: string,
  papel: Papel,
  peso: number,
  custo: number,
  prazoDias: number,
): ServicoAtomico {
  return ServicoAtomico.criar({ nome, papel, peso, custo, prazoDias });
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
      servicoPrincipal: PacoteServico.criar('Documentário de entrevistas', [
        PacoteServico.criar('Pré-produção', [
          servico('Direção', Papel.DIRETOR, 5, 10_000, 10),
          servico('Roteiro de pesquisa', Papel.ROTEIRISTA, 3, 6_000, 10),
        ]),
        PacoteServico.criar('Captação e pós-produção', [
          servico('Som direto', Papel.SONOPLASTA, 4, 8_000, 10),
          servico('Montagem', Papel.EDITOR, 4, 8_000, 15),
          servico('Fotografia das entrevistas', Papel.DIRETOR_FOTOGRAFIA, 3, 8_000, 10),
        ]),
      ]),
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
      servicoPrincipal: PacoteServico.criar('Curta de animação 3D', [
        PacoteServico.criar('Produção', [
          servico('Direção', Papel.DIRETOR, 5, 10_000, 10),
          PacoteServico.criar('Pipeline 3D', [
            servico('Modelagem', Papel.EFEITOS_VISUAIS, 5, 8_000, 10),
            servico('Animação e renderização', Papel.EFEITOS_VISUAIS, 4, 8_000, 15),
          ]),
          servico('Roteiro', Papel.ROTEIRISTA, 3, 5_000, 5),
        ]),
        PacoteServico.criar('Pós-produção', [
          servico('Desenho de som', Papel.SONOPLASTA, 2, 4_000, 5),
          servico('Montagem', Papel.EDITOR, 3, 5_000, 5),
        ]),
      ]),
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
      servicoPrincipal: PacoteServico.criar('Campanha publicitária digital', [
        PacoteServico.criar('Filmagem', [
          servico('Direção', Papel.DIRETOR, 5, 5_000, 3),
          servico('Fotografia', Papel.DIRETOR_FOTOGRAFIA, 4, 4_000, 3),
        ]),
        PacoteServico.criar('Pós-produção', [
          servico('Edição', Papel.EDITOR, 4, 4_000, 3),
          servico('Trilha', Papel.SONOPLASTA, 2, 2_000, 3),
        ]),
      ]),
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
      servicoPrincipal: PacoteServico.criar('Longa de ficção', [
        PacoteServico.criar('Pré-produção', [
          servico('Direção', Papel.DIRETOR, 5, 20_000, 10),
          servico('Roteiro', Papel.ROTEIRISTA, 4, 10_000, 10),
        ]),
        servico('Fotografia', Papel.DIRETOR_FOTOGRAFIA, 4, 15_000, 10),
        PacoteServico.criar('Pós-produção', [
          PacoteServico.criar('Imagem', [
            servico('Edição', Papel.EDITOR, 4, 10_000, 10),
            servico('Coloração', Papel.EDITOR, 3, 5_000, 5),
          ]),
          servico('Mixagem de áudio', Papel.SONOPLASTA, 3, 8_000, 5),
          servico('Efeitos visuais', Papel.EFEITOS_VISUAIS, 2, 7_000, 5),
        ]),
      ]),
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
