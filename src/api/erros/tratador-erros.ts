import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { ErroAplicacao, type CodigoErroAplicacao } from '../../application/erros/erro-aplicacao.js';
import { ErroDominio, type CodigoErroDominio } from '../../domain/comum/erro-dominio.js';
import type { RespostaErro } from '../schemas/comum.schema.js';

const STATUS_DOMINIO: Record<CodigoErroDominio, number> = {
  VALOR_INVALIDO: 422,
  REGRA_VIOLADA: 422,
  TRANSICAO_INVALIDA: 409,
  NAO_ENCONTRADO: 404,
};

const STATUS_APLICACAO: Record<CodigoErroAplicacao, number> = {
  ESTRATEGIA_DESCONHECIDA: 400,
  TIPO_PROJETO_DESCONHECIDO: 400,
  PARAMETROS_INVALIDOS: 400,
  RESTRICAO_VIOLADA: 422,
  NAO_ENCONTRADO: 404,
  FLUXO_INVARIAVEL: 500,
  CONFLITO_CONCORRENCIA: 409,
};

const CODIGOS_INDISPONIBILIDADE = new Set([
  'ECONNREFUSED',
  'ECONNRESET',
  'ETIMEDOUT',
  'ENOTFOUND',
  'EAI_AGAIN',
  'EHOSTUNREACH',
]);

function ehIndisponibilidade(erro: Error): boolean {
  const codigo = (erro as { code?: unknown }).code;
  return (
    (typeof codigo === 'string' && CODIGOS_INDISPONIBILIDADE.has(codigo)) ||
    /not connected|connection terminated|timeout exceeded when trying to connect|getaddrinfo/i.test(
      erro.message,
    )
  );
}

export function tratarErro(
  erro: FastifyError | Error,
  requisicao: FastifyRequest,
  resposta: FastifyReply,
) {
  if ('validation' in erro && erro.validation) {
    const corpo: RespostaErro = {
      codigo: 'REQUISICAO_INVALIDA',
      mensagem: 'A requisição não atende ao contrato esperado.',
      detalhes: erro.validation.map(
        (falha) =>
          `${falha.instancePath || erro.validationContext || 'corpo'}: ${falha.message ?? ''}`,
      ),
    };
    return resposta.status(400).send(corpo);
  }

  if (erro instanceof ErroDominio || erro instanceof ErroAplicacao) {
    const status =
      erro instanceof ErroDominio ? STATUS_DOMINIO[erro.codigo] : STATUS_APLICACAO[erro.codigo];
    if (status >= 500) {
      requisicao.log.error({ err: erro }, 'Erro de aplicação');
    }
    const corpo: RespostaErro = { codigo: erro.codigo, mensagem: erro.message };
    return resposta.status(status).send(corpo);
  }

  if (ehIndisponibilidade(erro)) {
    requisicao.log.warn({ err: erro }, 'Dependência indisponível');
    const corpo: RespostaErro = {
      codigo: 'SERVICO_INDISPONIVEL',
      mensagem: 'Uma dependência do serviço está indisponível. Tente novamente em instantes.',
    };
    return resposta.status(503).header('retry-after', '5').send(corpo);
  }

  const status = 'statusCode' in erro && erro.statusCode ? erro.statusCode : 500;
  if (status >= 500) {
    requisicao.log.error({ err: erro }, 'Erro não tratado');
    const corpo: RespostaErro = { codigo: 'ERRO_INTERNO', mensagem: 'Erro interno do servidor.' };
    return resposta.status(500).send(corpo);
  }

  const corpo: RespostaErro = {
    codigo: 'code' in erro && typeof erro.code === 'string' ? erro.code : 'ERRO',
    mensagem: erro.message,
  };
  return resposta.status(status).send(corpo);
}
