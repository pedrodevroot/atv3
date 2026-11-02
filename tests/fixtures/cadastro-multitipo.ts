import { Competencia } from '../../src/domain/entidades/competencia.js';
import type { Profissional } from '../../src/domain/entidades/profissional.js';
import { Papel } from '../../src/domain/enums/papel.js';
import { TipoCaptacao } from '../../src/domain/enums/tipo-captacao.js';
import { criarProfissional } from './dominio.js';

export const IDS_MULTITIPO = {
  DIRETOR_ENTREVISTADOR: 'diretor-entrevistador',
  DIRETOR_ANIMADOR: 'diretor-animador',
  DIRETOR_DE_ELENCO: 'diretor-de-elenco',
  VFX_ANIMADOR: 'vfx-animador',
  VFX_COMPOSITOR: 'vfx-compositor',
  SOM_DIRETO: 'som-direto',
  DESENHISTA_DE_SOM: 'desenhista-de-som',
  MONTADOR: 'montador',
} as const;

function especialista(id: string, nome: string, papel: Papel, competencias: string[]) {
  return criarProfissional({
    id,
    nome,
    especialidades: [papel],
    competencias: competencias.map((competencia) => Competencia.criar(competencia, 5)),
  });
}

export function criarCadastroMultitipo(): Profissional[] {
  return [
    especialista(IDS_MULTITIPO.DIRETOR_ENTREVISTADOR, 'Rita Entrevista', Papel.DIRETOR, [
      'Entrevista',
      'Pesquisa',
    ]),
    especialista(IDS_MULTITIPO.DIRETOR_ANIMADOR, 'Otto Quadro a Quadro', Papel.DIRETOR, [
      'Animação',
      'Decupagem',
    ]),
    especialista(IDS_MULTITIPO.DIRETOR_DE_ELENCO, 'Lia Elenco', Papel.DIRETOR, [
      'Direção de atores',
      'Liderança',
    ]),
    especialista(IDS_MULTITIPO.VFX_ANIMADOR, 'Nina Modelagem', Papel.EFEITOS_VISUAIS, [
      'Animação',
      'Modelagem 3D',
    ]),
    especialista(IDS_MULTITIPO.VFX_COMPOSITOR, 'Caio Composição', Papel.EFEITOS_VISUAIS, [
      'Composição digital',
      'Rastreamento',
    ]),
    especialista(IDS_MULTITIPO.SOM_DIRETO, 'Davi Som Direto', Papel.SONOPLASTA, [
      'Captação de som',
      'Mixagem',
    ]),
    especialista(IDS_MULTITIPO.DESENHISTA_DE_SOM, 'Iara Trilha', Papel.SONOPLASTA, [
      'Desenho de som',
      'Trilha sonora',
    ]),
    especialista(IDS_MULTITIPO.MONTADOR, 'Beto Montagem', Papel.EDITOR, [
      'Montagem',
      'Edição não linear',
      'Ritmo narrativo',
    ]),
  ];
}

export const DETALHES_MULTITIPO = {
  [TipoCaptacao.DOCUMENTARIO]: { tema: 'Rios do cerrado', entrevistados: ['Seu Tião', 'Dona Lia'] },
  [TipoCaptacao.ANIMACAO]: { tecnica: '3D', softwares: ['Blender'], quadrosPorSegundo: 24 },
  [TipoCaptacao.PUBLICITARIO]: { marca: 'Café Serrano', veiculacao: ['TV', 'DIGITAL'], pecas: 3 },
  [TipoCaptacao.FICCAO]: {},
} as const;
