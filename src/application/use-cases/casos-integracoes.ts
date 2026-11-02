import { ErroDominio, garantir } from '../../domain/comum/erro-dominio.js';
import { StatusEquipe } from '../../domain/enums/status.js';
import { criarEvento } from '../../domain/eventos/evento-recomendacao.js';
import { naoEncontrado } from '../erros/erro-aplicacao.js';
import { ORIGEM_SERVICO } from '../eventos/fabrica-eventos.js';
import { prefixoArquivosDoProjeto } from '../ports/adaptador-armazenamento.js';
import type { StatusPagamento } from '../ports/adaptador-pagamento.js';
import type { RegistroPagamento } from '../ports/repositorio-pagamentos.js';
import type { AlvoMembro } from './casos-equipe.js';
import {
  obterProjeto,
  type ContextoRequisicao,
  type DependenciasCasosDeUso,
} from './dependencias.js';

export interface DadosArquivo {
  readonly projetoId: string;
  readonly nome: string;
  readonly tipoConteudo: string;
  readonly conteudo: Buffer;
}

export class ArquivosProjeto {
  constructor(private readonly deps: DependenciasCasosDeUso) {}

  get provedor(): string {
    return this.deps.sistema.armazenamento.provedor;
  }

  async anexar(dados: DadosArquivo, contexto: ContextoRequisicao): Promise<string> {
    const { sistema, projetos } = this.deps;
    const projeto = await obterProjeto(projetos, dados.projetoId);
    const { armazenamento } = sistema;
    const arquivoId = await armazenamento.salvarArquivo(dados.conteudo, {
      projetoId: projeto.id,
      nome: dados.nome,
      tipoConteudo: dados.tipoConteudo,
    });
    sistema.notificarObservadores(
      criarEvento(
        'ARQUIVO_ANEXADO',
        {
          projetoId: projeto.id,
          produtorId: projeto.produtorId,
          arquivoId,
          nome: dados.nome,
          provedor: armazenamento.provedor,
          tamanhoBytes: dados.conteudo.length,
        },
        { origem: ORIGEM_SERVICO, ...contexto },
      ),
    );
    return arquivoId;
  }

  async listar(projetoId: string): Promise<string[]> {
    const projeto = await obterProjeto(this.deps.projetos, projetoId);
    return this.deps.sistema.armazenamento.listarArquivos(prefixoArquivosDoProjeto(projeto.id));
  }

  async recuperar(projetoId: string, arquivoId: string): Promise<Buffer> {
    if (!(await this.listar(projetoId)).includes(arquivoId)) {
      throw naoEncontrado('Arquivo', arquivoId);
    }
    return this.deps.sistema.armazenamento.recuperarArquivo(arquivoId);
  }
}

export interface PagamentoComStatus {
  readonly pagamento: RegistroPagamento;
  readonly status: StatusPagamento;
}

export class PagamentosEquipe {
  constructor(private readonly deps: DependenciasCasosDeUso) {}

  async efetuar(alvo: AlvoMembro, contexto: ContextoRequisicao): Promise<PagamentoComStatus> {
    const { projetos, pagamentos, sistema, relogio } = this.deps;
    const projeto = await obterProjeto(projetos, alvo.projetoId);
    const equipe = projeto.equipe(alvo.equipeId);
    garantir(
      equipe.status === StatusEquipe.FORMADA,
      'Só é possível pagar membros de uma equipe formada.',
      'TRANSICAO_INVALIDA',
    );
    const membro = equipe.membro(alvo.papel);
    if (!membro) {
      throw naoEncontrado('Membro', alvo.papel);
    }
    garantir(membro.custo > 0, `O membro de ${alvo.papel} não tem valor a pagar.`, 'REGRA_VIOLADA');
    garantir(
      (await pagamentos.ativoDoPapel(alvo.equipeId, alvo.papel)) === undefined,
      `O papel ${alvo.papel} já foi pago nesta equipe.`,
      'TRANSICAO_INVALIDA',
    );

    const adaptador = sistema.pagamento;
    const id = await adaptador.efetuarPagamento(
      membro.custo,
      projeto.produtorId,
      membro.profissional.id,
    );
    const pagamento: RegistroPagamento = {
      id,
      projetoId: projeto.id,
      equipeId: alvo.equipeId,
      papel: alvo.papel,
      profissionalId: membro.profissional.id,
      valor: membro.custo,
      provedor: adaptador.provedor,
      criadoEm: relogio(),
      cancelado: false,
    };
    try {
      await pagamentos.registrar(pagamento);
    } catch (erro) {
      await adaptador.cancelarPagamento(id);
      throw erro;
    }
    sistema.notificarObservadores(
      criarEvento(
        'PAGAMENTO_EFETUADO',
        {
          projetoId: projeto.id,
          produtorId: projeto.produtorId,
          pagamentoId: id,
          equipeId: alvo.equipeId,
          papel: alvo.papel,
          profissionalId: membro.profissional.id,
          valor: membro.custo,
          provedor: adaptador.provedor,
        },
        { origem: ORIGEM_SERVICO, ...contexto },
      ),
    );
    return { pagamento, status: await adaptador.verificarPagamento(id) };
  }

  async consultar(projetoId: string, pagamentoId: string): Promise<PagamentoComStatus> {
    const pagamento = await this.obterDoProjeto(projetoId, pagamentoId);
    return { pagamento, status: await this.adaptadorDe(pagamento).verificarPagamento(pagamentoId) };
  }

  async cancelar(
    projetoId: string,
    pagamentoId: string,
    contexto: ContextoRequisicao,
  ): Promise<PagamentoComStatus> {
    const { pagamentos, projetos, sistema } = this.deps;
    const pagamento = await this.obterDoProjeto(projetoId, pagamentoId);
    const adaptador = this.adaptadorDe(pagamento);
    garantir(
      await adaptador.cancelarPagamento(pagamentoId),
      `O pagamento ${pagamentoId} não pode ser cancelado.`,
      'TRANSICAO_INVALIDA',
    );
    await pagamentos.marcarCancelado(pagamentoId);
    const projeto = await obterProjeto(projetos, projetoId);
    sistema.notificarObservadores(
      criarEvento(
        'PAGAMENTO_CANCELADO',
        {
          projetoId,
          produtorId: projeto.produtorId,
          pagamentoId,
          provedor: adaptador.provedor,
        },
        { origem: ORIGEM_SERVICO, ...contexto },
      ),
    );
    return {
      pagamento: { ...pagamento, cancelado: true },
      status: await adaptador.verificarPagamento(pagamentoId),
    };
  }

  private async obterDoProjeto(projetoId: string, pagamentoId: string): Promise<RegistroPagamento> {
    const pagamento = await this.deps.pagamentos.obter(pagamentoId);
    if (pagamento?.projetoId !== projetoId) {
      throw naoEncontrado('Pagamento', pagamentoId);
    }
    return pagamento;
  }

  private adaptadorDe(pagamento: RegistroPagamento) {
    const adaptador = this.deps.sistema.pagamento;
    if (adaptador.provedor !== pagamento.provedor) {
      throw new ErroDominio(
        'REGRA_VIOLADA',
        `O pagamento foi feito em ${pagamento.provedor}, mas o provedor configurado é ${adaptador.provedor}.`,
      );
    }
    return adaptador;
  }
}
