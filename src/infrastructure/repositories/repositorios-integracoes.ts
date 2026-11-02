import type { DataSource } from 'typeorm';
import { conflitoConcorrencia } from '../../application/erros/erro-aplicacao.js';
import type {
  RegistroPagamento,
  RepositorioPagamentos,
} from '../../application/ports/repositorio-pagamentos.js';
import type { Papel } from '../../domain/enums/papel.js';
import { inserir, inserirOuAtualizar } from '../database/escrita.js';
import {
  ObjetoExternoSchema,
  PagamentoMembroSchema,
  TransacaoExternaSchema,
  type ObjetoExternoRow,
  type PagamentoMembroRow,
  type TransacaoExternaRow,
} from '../database/schemas/integracoes.schema.js';
import type { DepositoObjetos, ObjetoExterno } from '../externos/armazenamento-externo.js';
import type { DadosTransacao, LivroTransacoes, Transacao } from '../externos/gateway-pagamento.js';

const VIOLACAO_UNICIDADE = '23505';

export class DepositoObjetosTypeorm implements DepositoObjetos {
  constructor(private readonly dataSource: DataSource) {}

  async gravar(sistema: string, objeto: ObjetoExterno): Promise<void> {
    await inserirOuAtualizar(
      this.dataSource.manager,
      ObjetoExternoSchema,
      [
        {
          sistema,
          chave: objeto.chave,
          tipo_conteudo: objeto.tipoConteudo,
          conteudo: objeto.conteudo,
        },
      ],
      ['sistema', 'chave'],
    );
  }

  async ler(sistema: string, chave: string): Promise<ObjetoExterno | undefined> {
    const [linha] = await this.dataSource.query<ObjetoExternoRow[]>(
      'SELECT * FROM objeto_externo WHERE sistema = $1 AND chave = $2',
      [sistema, chave],
    );
    return linha
      ? { chave: linha.chave, tipoConteudo: linha.tipo_conteudo, conteudo: linha.conteudo }
      : undefined;
  }

  async listar(sistema: string, prefixo: string): Promise<string[]> {
    const linhas = await this.dataSource.query<{ chave: string }[]>(
      `SELECT chave FROM objeto_externo
       WHERE sistema = $1 AND left(chave, length($2)) = $2
       ORDER BY chave`,
      [sistema, prefixo],
    );
    return linhas.map((linha) => linha.chave);
  }
}

export class LivroTransacoesTypeorm implements LivroTransacoes {
  constructor(private readonly dataSource: DataSource) {}

  async registrar(sistema: string, transacao: Transacao): Promise<void> {
    await inserir(this.dataSource.manager, TransacaoExternaSchema, [
      {
        sistema,
        id: transacao.id,
        valor: transacao.valor,
        dados: transacao.dados,
        status: transacao.status,
        criada_em: transacao.criadaEm,
      },
    ]);
  }

  async obter(sistema: string, id: string): Promise<Transacao | undefined> {
    const [linha] = await this.dataSource.query<
      (Omit<TransacaoExternaRow, 'valor'> & { valor: number | string })[]
    >('SELECT * FROM transacao_externa WHERE sistema = $1 AND id = $2', [sistema, id]);
    return linha
      ? {
          id: linha.id,
          valor: Number(linha.valor),
          dados: linha.dados as DadosTransacao,
          status: linha.status,
          criadaEm: linha.criada_em,
        }
      : undefined;
  }

  async trocarStatus(sistema: string, id: string, de: string, para: string): Promise<boolean> {
    const trocadas = await this.dataSource.query<{ id: string }[]>(
      `WITH trocada AS (
         UPDATE transacao_externa SET status = $4
          WHERE sistema = $1 AND id = $2 AND status = $3
         RETURNING id)
       SELECT id FROM trocada`,
      [sistema, id, de, para],
    );
    return trocadas.length > 0;
  }
}

type LinhaPagamento = Omit<PagamentoMembroRow, 'valor'> & { valor: number | string };

function paraPagamento(linha: LinhaPagamento): RegistroPagamento {
  return {
    id: linha.id,
    projetoId: linha.projeto_id,
    equipeId: linha.equipe_id,
    papel: linha.papel as Papel,
    profissionalId: linha.profissional_id,
    valor: Number(linha.valor),
    provedor: linha.provedor,
    criadoEm: linha.criado_em,
    cancelado: linha.cancelado,
  };
}

export class RepositorioPagamentosTypeorm implements RepositorioPagamentos {
  constructor(private readonly dataSource: DataSource) {}

  async registrar(pagamento: RegistroPagamento): Promise<void> {
    try {
      await inserir(this.dataSource.manager, PagamentoMembroSchema, [
        {
          id: pagamento.id,
          projeto_id: pagamento.projetoId,
          equipe_id: pagamento.equipeId,
          papel: pagamento.papel,
          profissional_id: pagamento.profissionalId,
          valor: pagamento.valor,
          provedor: pagamento.provedor,
          criado_em: pagamento.criadoEm,
          cancelado: pagamento.cancelado,
        },
      ]);
    } catch (erro) {
      if ((erro as { code?: unknown }).code === VIOLACAO_UNICIDADE) {
        throw conflitoConcorrencia('Pagamento', `de ${pagamento.papel}`);
      }
      throw erro;
    }
  }

  async obter(id: string): Promise<RegistroPagamento | undefined> {
    const [linha] = await this.dataSource.query<LinhaPagamento[]>(
      'SELECT * FROM pagamento_membro WHERE id = $1',
      [id],
    );
    return linha ? paraPagamento(linha) : undefined;
  }

  async ativoDoPapel(equipeId: string, papel: Papel): Promise<RegistroPagamento | undefined> {
    const [linha] = await this.dataSource.query<LinhaPagamento[]>(
      'SELECT * FROM pagamento_membro WHERE equipe_id = $1 AND papel = $2 AND NOT cancelado',
      [equipeId, papel],
    );
    return linha ? paraPagamento(linha) : undefined;
  }

  async marcarCancelado(id: string): Promise<void> {
    await this.dataSource.query('UPDATE pagamento_membro SET cancelado = true WHERE id = $1', [id]);
  }
}
