import { EntitySchema } from 'typeorm';

export interface ObjetoExternoRow {
  sistema: string;
  chave: string;
  tipo_conteudo: string;
  conteudo: Buffer;
}

export interface TransacaoExternaRow {
  sistema: string;
  id: string;
  valor: number;
  dados: object;
  status: string;
  criada_em: Date;
}

export interface PagamentoMembroRow {
  id: string;
  projeto_id: string;
  equipe_id: string;
  papel: string;
  profissional_id: string;
  valor: number;
  provedor: string;
  criado_em: Date;
  cancelado: boolean;
}

const sistema = { type: 'varchar', length: 32, primary: true } as const;

export const ObjetoExternoSchema = new EntitySchema<ObjetoExternoRow>({
  name: 'objeto_externo',
  tableName: 'objeto_externo',
  columns: {
    sistema,
    chave: { type: 'text', primary: true },
    tipo_conteudo: { type: 'varchar', length: 120 },
    conteudo: { type: 'bytea' },
  },
});

export const TransacaoExternaSchema = new EntitySchema<TransacaoExternaRow>({
  name: 'transacao_externa',
  tableName: 'transacao_externa',
  columns: {
    sistema,
    id: { type: 'varchar', length: 64, primary: true },
    valor: { type: 'numeric', precision: 16, scale: 2 },
    dados: { type: 'jsonb' },
    status: { type: 'varchar', length: 20 },
    criada_em: { type: 'timestamptz' },
  },
});

export const PagamentoMembroSchema = new EntitySchema<PagamentoMembroRow>({
  name: 'pagamento_membro',
  tableName: 'pagamento_membro',
  columns: {
    id: { type: 'varchar', length: 64, primary: true },
    projeto_id: { type: 'varchar', length: 64 },
    equipe_id: { type: 'varchar', length: 64 },
    papel: { type: 'varchar', length: 32 },
    profissional_id: { type: 'varchar', length: 64 },
    valor: { type: 'numeric', precision: 14, scale: 2 },
    provedor: { type: 'varchar', length: 32 },
    criado_em: { type: 'timestamptz' },
    cancelado: { type: 'boolean', default: false },
  },
});
