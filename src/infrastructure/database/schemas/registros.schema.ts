import { EntitySchema } from 'typeorm';

export interface AuditoriaRow {
  id?: number;
  evento_id: string;
  tipo: string;
  ocorrido_em: Date;
  origem: string;
  correlacao_id: string | null;
  projeto_id: string;
  ator_id: string;
  tipo_ator: string;
  dados: object;
}

export interface MensagemInternaRow {
  id?: number;
  destinatario_id: string;
  tipo_destinatario: string;
  assunto: string;
  corpo: string;
  evento_id: string;
  criada_em?: Date;
  lida?: boolean;
}

const idSerial = { type: 'bigint', primary: true, generated: 'increment' } as const;
const referencia = { type: 'varchar', length: 64 } as const;

export const AuditoriaSchema = new EntitySchema<AuditoriaRow>({
  name: 'auditoria',
  tableName: 'auditoria',
  columns: {
    id: idSerial,
    evento_id: referencia,
    tipo: { type: 'varchar', length: 40 },
    ocorrido_em: { type: 'timestamptz' },
    origem: { type: 'varchar', length: 64 },
    correlacao_id: { ...referencia, nullable: true },
    projeto_id: referencia,
    ator_id: referencia,
    tipo_ator: { type: 'varchar', length: 20 },
    dados: { type: 'jsonb' },
  },
});

export const MensagemInternaSchema = new EntitySchema<MensagemInternaRow>({
  name: 'mensagem_interna',
  tableName: 'mensagem_interna',
  columns: {
    id: idSerial,
    destinatario_id: referencia,
    tipo_destinatario: { type: 'varchar', length: 20 },
    assunto: { type: 'varchar', length: 200 },
    corpo: { type: 'text' },
    evento_id: referencia,
    criada_em: { type: 'timestamptz', createDate: true },
    lida: { type: 'boolean', default: false },
  },
});
