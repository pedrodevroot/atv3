import { Papel } from '../../domain/enums/papel.js';
import type { PerfilExterno } from './api-profissional-externa.js';

export interface PerfilLinkedIn extends PerfilExterno {
  readonly nomeCompleto: string;
  readonly cargo: string;
  readonly habilidades: readonly { readonly nome: string; readonly endossos: number }[];
  readonly localidade: {
    readonly cidade: string;
    readonly estado: string;
    readonly latitude: number;
    readonly longitude: number;
  };
  readonly pretensao: { readonly minimo: number; readonly maximo: number };
  readonly agenda: readonly { readonly de: string; readonly ate: string }[];
}

export interface PerfilIndeed extends PerfilExterno {
  readonly nome: string;
  readonly funcoes: readonly string[];
  readonly curriculo: Readonly<Record<string, number>>;
  readonly municipio: string;
  readonly uf: string;
  readonly coordenadas: readonly [number, number];
  readonly salarioCentavos: { readonly de: number; readonly ate: number };
  readonly disponivel: readonly { readonly inicio: string; readonly fim: string }[];
}

export const CARGOS_LINKEDIN: Readonly<Record<string, Papel>> = {
  'Direção de Cinema': Papel.DIRETOR,
  'Direção de Fotografia': Papel.DIRETOR_FOTOGRAFIA,
  'Design de Som': Papel.SONOPLASTA,
  'Edição de Vídeo': Papel.EDITOR,
  Roteiro: Papel.ROTEIRISTA,
  'Artista de VFX': Papel.EFEITOS_VISUAIS,
};

const AGENDA_LINKEDIN = [{ de: '2026-01-01T00:00:00.000Z', ate: '2035-12-31T00:00:00.000Z' }];
const AGENDA_INDEED = [{ inicio: '2026-01-01', fim: '2035-12-31' }];

function perfilLinkedIn(
  numero: number,
  nomeCompleto: string,
  cargo: string,
  habilidades: Readonly<Record<string, number>>,
): PerfilLinkedIn {
  return {
    id: `urn:li:member:${numero}`,
    nomeCompleto,
    cargo,
    habilidades: Object.entries(habilidades).map(([nome, endossos]) => ({ nome, endossos })),
    localidade: { cidade: 'São Paulo', estado: 'SP', latitude: -23.5505, longitude: -46.6333 },
    pretensao: { minimo: 5_000, maximo: 30_000 },
    agenda: AGENDA_LINKEDIN,
    notas: [4, 5],
  };
}

function perfilIndeed(
  numero: number,
  nome: string,
  funcao: Papel,
  curriculo: Readonly<Record<string, number>>,
): PerfilIndeed {
  return {
    id: `idx-${numero}`,
    nome,
    funcoes: [funcao],
    curriculo,
    municipio: 'Rio de Janeiro',
    uf: 'RJ',
    coordenadas: [-22.9068, -43.1729],
    salarioCentavos: { de: 400_000, ate: 2_500_000 },
    disponivel: AGENDA_INDEED,
    notas: [8, 9],
  };
}

export function criarPerfisLinkedIn(): PerfilLinkedIn[] {
  return [
    perfilLinkedIn(101, 'Lívia Direção', 'Direção de Cinema', {
      'direcao-de-atores': 90,
      decupagem: 70,
      lideranca: 80,
    }),
    perfilLinkedIn(102, 'Otávio Luz', 'Direção de Fotografia', {
      fotografia: 95,
      iluminacao: 85,
      'operacao-de-camera': 60,
    }),
    perfilLinkedIn(103, 'Sara Ondas', 'Design de Som', {
      'captacao-de-som': 88,
      mixagem: 75,
      'desenho-de-som': 50,
    }),
    perfilLinkedIn(104, 'Caio Corte', 'Edição de Vídeo', {
      montagem: 92,
      'edicao-nao-linear': 80,
      'ritmo-narrativo': 65,
    }),
    perfilLinkedIn(105, 'Nina Verso', 'Roteiro', { roteiro: 90, dramaturgia: 72, dialogos: 64 }),
    perfilLinkedIn(106, 'Téo Pixel', 'Artista de VFX', {
      'composicao-digital': 85,
      rastreamento: 55,
      'modelagem-3d': 70,
    }),
  ];
}

export function criarPerfisIndeed(): PerfilIndeed[] {
  return [
    perfilIndeed(201, 'Ravi Cena', Papel.DIRETOR, {
      'direcao-de-atores': 8,
      decupagem: 7,
      lideranca: 9,
    }),
    perfilIndeed(202, 'Bia Quadro', Papel.DIRETOR_FOTOGRAFIA, {
      fotografia: 9,
      iluminacao: 8,
      'color-grading': 6,
    }),
    perfilIndeed(203, 'Davi Som', Papel.SONOPLASTA, {
      'captacao-de-som': 9,
      mixagem: 8,
      'trilha-sonora': 5,
    }),
    perfilIndeed(204, 'Eva Timeline', Papel.EDITOR, {
      montagem: 8,
      'edicao-nao-linear': 9,
      'color-grading': 6,
    }),
    perfilIndeed(205, 'Gil Trama', Papel.ROTEIRISTA, { roteiro: 9, dramaturgia: 7, pesquisa: 6 }),
    perfilIndeed(206, 'Mel Render', Papel.EFEITOS_VISUAIS, {
      'composicao-digital': 8,
      'modelagem-3d': 9,
      animacao: 7,
    }),
  ];
}
