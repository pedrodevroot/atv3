import { EntitySchema } from 'typeorm';

export interface ProfissionalRow {
  id: string;
  nome: string;
  especialidades: string[];
  preco_minimo: number;
  preco_maximo: number;
  cidade: string;
  uf: string;
  latitude: number;
  longitude: number;
  ativo: boolean;
  nota_media: number;
  total_avaliacoes: number;
}

export interface CompetenciaRow {
  id?: number;
  profissional_id: string;
  nome: string;
  nivel: number;
}

export interface AvaliacaoRow {
  id: string;
  profissional_id: string;
  nota: number;
  comentario: string;
  data: Date;
  produtor_id: string;
  projeto_id: string;
  papel: string;
  genero: string;
  tipo_captacao: string;
}

export interface ParticipacaoRow {
  id?: number;
  profissional_id: string;
  projeto_id: string;
  titulo: string;
  papel: string;
  genero: string;
  tipo_captacao: string;
  ano: number;
}

export interface DisponibilidadeRow {
  id?: number;
  profissional_id: string;
  inicio: Date;
  fim: Date;
}

const id = { type: 'varchar', length: 64, primary: true } as const;
const idSerial = { type: 'bigint', primary: true, generated: 'increment' } as const;
const referencia = { type: 'varchar', length: 64 } as const;
const dinheiro = { type: 'numeric', precision: 14, scale: 2 } as const;

export const ProfissionalSchema = new EntitySchema<ProfissionalRow>({
  name: 'profissional',
  tableName: 'profissional',
  columns: {
    id,
    nome: { type: 'varchar', length: 200 },
    especialidades: { type: 'text', array: true },
    preco_minimo: dinheiro,
    preco_maximo: dinheiro,
    cidade: { type: 'varchar', length: 120 },
    uf: { type: 'char', length: 2 },
    latitude: { type: 'double precision' },
    longitude: { type: 'double precision' },
    ativo: { type: 'boolean', default: true },
    nota_media: { type: 'numeric', precision: 3, scale: 2, default: 0 },
    total_avaliacoes: { type: 'integer', default: 0 },
  },
});

export const CompetenciaSchema = new EntitySchema<CompetenciaRow>({
  name: 'competencia',
  tableName: 'competencia',
  columns: {
    id: idSerial,
    profissional_id: referencia,
    nome: { type: 'varchar', length: 120 },
    nivel: { type: 'smallint' },
  },
});

export const AvaliacaoSchema = new EntitySchema<AvaliacaoRow>({
  name: 'avaliacao',
  tableName: 'avaliacao',
  columns: {
    id,
    profissional_id: referencia,
    nota: { type: 'numeric', precision: 2, scale: 1 },
    comentario: { type: 'text', default: '' },
    data: { type: 'timestamptz' },
    produtor_id: referencia,
    projeto_id: referencia,
    papel: { type: 'varchar', length: 32 },
    genero: { type: 'varchar', length: 80 },
    tipo_captacao: { type: 'varchar', length: 20 },
  },
});

export const ParticipacaoSchema = new EntitySchema<ParticipacaoRow>({
  name: 'participacao_projeto',
  tableName: 'participacao_projeto',
  columns: {
    id: idSerial,
    profissional_id: referencia,
    projeto_id: referencia,
    titulo: { type: 'varchar', length: 200 },
    papel: { type: 'varchar', length: 32 },
    genero: { type: 'varchar', length: 80 },
    tipo_captacao: { type: 'varchar', length: 20 },
    ano: { type: 'smallint' },
  },
});

export const DisponibilidadeSchema = new EntitySchema<DisponibilidadeRow>({
  name: 'disponibilidade',
  tableName: 'disponibilidade',
  columns: {
    id: idSerial,
    profissional_id: referencia,
    inicio: { type: 'timestamptz' },
    fim: { type: 'timestamptz' },
  },
});
