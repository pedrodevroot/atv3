import { EntitySchema } from 'typeorm';

export interface ProjetoRow {
  id: string;
  titulo: string;
  produtor_id: string;
  genero: string;
  tipo_captacao: string;
  duracao_minutos: number;
  orcamento: number;
  data_inicio: Date;
  data_entrega: Date;
  cidade: string;
  uf: string;
  latitude: number;
  longitude: number;
  estrategia: string;
  criado_em: Date;
  detalhes: Record<string, unknown>;
}

export interface RequisitoPapelRow {
  projeto_id: string;
  papel: string;
  peso: number;
  ordem: number;
}

export interface EquipeRow {
  id: string;
  projeto_id: string;
  estrategia: string;
  status: string;
  rodada: number;
  criada_em: Date;
  ordem: number;
  descartados: string[];
}

export interface MembroEquipeRow {
  equipe_id: string;
  papel: string;
  profissional_id: string;
  custo: number;
  score: number;
  status: string;
  ordem: number;
}

export interface RecomendacaoRow {
  id: string;
  projeto_id: string;
  equipe_id: string | null;
  papel: string;
  profissional_id: string;
  score: number;
  posicao: number;
  estrategia: string;
  rodada: number;
  justificativa: string;
  criada_em: Date;
}

export interface ConviteRow {
  id: string;
  projeto_id: string;
  equipe_id: string;
  papel: string;
  profissional_id: string;
  produtor_id: string;
  status: string;
  criado_em: Date;
  expira_em: Date;
  respondido_em: Date | null;
}

const id = { type: 'varchar', length: 64, primary: true } as const;
const chave = { type: 'varchar', length: 64, primary: true } as const;
const referencia = { type: 'varchar', length: 64 } as const;
const dinheiro = { type: 'numeric', precision: 14, scale: 2 } as const;
const papel = { type: 'varchar', length: 32 } as const;
const status = { type: 'varchar', length: 20 } as const;

export const ProjetoSchema = new EntitySchema<ProjetoRow>({
  name: 'projeto',
  tableName: 'projeto',
  columns: {
    id,
    titulo: { type: 'varchar', length: 200 },
    produtor_id: referencia,
    genero: { type: 'varchar', length: 80 },
    tipo_captacao: { type: 'varchar', length: 20 },
    duracao_minutos: { type: 'integer' },
    orcamento: dinheiro,
    data_inicio: { type: 'timestamptz' },
    data_entrega: { type: 'timestamptz' },
    cidade: { type: 'varchar', length: 120 },
    uf: { type: 'char', length: 2 },
    latitude: { type: 'double precision' },
    longitude: { type: 'double precision' },
    estrategia: { type: 'varchar', length: 64 },
    criado_em: { type: 'timestamptz' },
    detalhes: { type: 'jsonb', default: () => "'{}'::jsonb" },
  },
});

export const RequisitoPapelSchema = new EntitySchema<RequisitoPapelRow>({
  name: 'requisito_papel',
  tableName: 'requisito_papel',
  columns: {
    projeto_id: chave,
    papel: { ...papel, primary: true },
    peso: { type: 'numeric', precision: 4, scale: 2 },
    ordem: { type: 'smallint' },
  },
});

export const EquipeSchema = new EntitySchema<EquipeRow>({
  name: 'equipe',
  tableName: 'equipe',
  columns: {
    id,
    projeto_id: referencia,
    estrategia: { type: 'varchar', length: 64 },
    status,
    rodada: { type: 'integer' },
    criada_em: { type: 'timestamptz' },
    ordem: { type: 'integer', default: 0 },
    descartados: { type: 'text', array: true, default: () => "'{}'" },
  },
});

export const MembroEquipeSchema = new EntitySchema<MembroEquipeRow>({
  name: 'membro_equipe',
  tableName: 'membro_equipe',
  columns: {
    equipe_id: chave,
    papel: { ...papel, primary: true },
    profissional_id: referencia,
    custo: dinheiro,
    score: { type: 'double precision' },
    status,
    ordem: { type: 'smallint' },
  },
});

export const RecomendacaoSchema = new EntitySchema<RecomendacaoRow>({
  name: 'recomendacao',
  tableName: 'recomendacao',
  columns: {
    id,
    projeto_id: referencia,
    equipe_id: { ...referencia, nullable: true },
    papel,
    profissional_id: referencia,
    score: { type: 'double precision' },
    posicao: { type: 'integer' },
    estrategia: { type: 'varchar', length: 64 },
    rodada: { type: 'integer' },
    justificativa: { type: 'text' },
    criada_em: { type: 'timestamptz' },
  },
});

export const ConviteSchema = new EntitySchema<ConviteRow>({
  name: 'convite',
  tableName: 'convite',
  columns: {
    id,
    projeto_id: referencia,
    equipe_id: referencia,
    papel,
    profissional_id: referencia,
    produtor_id: referencia,
    status,
    criado_em: { type: 'timestamptz' },
    expira_em: { type: 'timestamptz' },
    respondido_em: { type: 'timestamptz', nullable: true },
  },
});
