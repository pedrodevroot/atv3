import { randomUUID } from 'node:crypto';
import { ErroSistemaExterno } from './erro-sistema-externo.js';

export interface DadosTransacao {
  readonly pagador: string;
  readonly recebedor: string;
  readonly moeda: string;
}

export interface Transacao {
  readonly id: string;
  readonly valor: number;
  readonly dados: DadosTransacao;
  readonly status: string;
  readonly criadaEm: Date;
}

export interface PerfilGateway {
  readonly sistema: string;
  readonly prefixoId: string;
  readonly unidade: 'CENTAVOS' | 'REAIS';
  readonly statusAprovado: string;
  readonly statusEstornado: string;
}

export interface LivroTransacoes {
  registrar(sistema: string, transacao: Transacao): Promise<void>;
  obter(sistema: string, id: string): Promise<Transacao | undefined>;
  trocarStatus(sistema: string, id: string, de: string, para: string): Promise<boolean>;
}

export class LivroTransacoesMemoria implements LivroTransacoes {
  private readonly transacoes = new Map<string, Transacao>();

  registrar(sistema: string, transacao: Transacao): Promise<void> {
    this.transacoes.set(`${sistema}/${transacao.id}`, transacao);
    return Promise.resolve();
  }

  obter(sistema: string, id: string): Promise<Transacao | undefined> {
    return Promise.resolve(this.transacoes.get(`${sistema}/${id}`));
  }

  trocarStatus(sistema: string, id: string, de: string, para: string): Promise<boolean> {
    const atual = this.transacoes.get(`${sistema}/${id}`);
    if (atual?.status !== de) {
      return Promise.resolve(false);
    }
    this.transacoes.set(`${sistema}/${id}`, { ...atual, status: para });
    return Promise.resolve(true);
  }
}

export class GatewayPagamento {
  constructor(
    private readonly perfil: PerfilGateway,
    private readonly livro: LivroTransacoes,
  ) {}

  async processarPagamento(valor: number, dados: DadosTransacao): Promise<Transacao> {
    const { sistema, unidade, prefixoId, statusAprovado } = this.perfil;
    if (!Number.isFinite(valor) || valor <= 0) {
      throw new ErroSistemaExterno(sistema, 'valor deve ser maior que zero.');
    }
    if (unidade === 'CENTAVOS' && !Number.isInteger(valor)) {
      throw new ErroSistemaExterno(sistema, 'valor deve ser informado em centavos inteiros.');
    }
    const transacao: Transacao = {
      id: `${prefixoId}${randomUUID()}`,
      valor,
      dados,
      status: statusAprovado,
      criadaEm: new Date(),
    };
    await this.livro.registrar(sistema, transacao);
    return transacao;
  }

  estornarPagamento(id: string): Promise<boolean> {
    const { sistema, statusAprovado, statusEstornado } = this.perfil;
    return this.livro.trocarStatus(sistema, id, statusAprovado, statusEstornado);
  }

  async consultarStatus(id: string): Promise<string> {
    const transacao = await this.livro.obter(this.perfil.sistema, id);
    if (!transacao) {
      throw new ErroSistemaExterno(this.perfil.sistema, `transação ${id} não existe.`);
    }
    return transacao.status;
  }
}
