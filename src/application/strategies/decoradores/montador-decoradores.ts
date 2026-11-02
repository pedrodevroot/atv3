import type { Projeto } from '../../../domain/entidades/projeto.js';
import { ErroAplicacao } from '../../erros/erro-aplicacao.js';
import type { RegistroFabricas } from '../../familias/registro-fabricas.js';
import type { RegistroAuditoria } from '../../ports/canais-saida.js';
import type { Logger } from '../../ports/logger.js';
import type { Relogio } from '../../ports/relogio.js';
import type { RecomendacaoStrategy } from '../estrategia-recomendacao.js';
import type { RegistroEstrategias } from '../registro-estrategias.js';
import { AuditoriaDecorator } from './auditoria-decorator.js';
import { CacheDecorator, type CacheRecomendacoes } from './cache-decorator.js';
import { CompressaoDecorator } from './compressao-decorator.js';

export const NOMES_DECORADORES = ['cache', 'auditoria', 'compressao'] as const;

export type NomeDecorador = (typeof NOMES_DECORADORES)[number];

export interface DependenciasMontador {
  readonly cache: CacheRecomendacoes;
  readonly auditoria: RegistroAuditoria;
  readonly fabricas: RegistroFabricas;
  readonly estrategias: RegistroEstrategias;
  readonly relogio?: Relogio;
  readonly logger?: Logger;
}

export interface PedidoEstrategia {
  readonly estrategia?: string;
  readonly decoradores?: readonly NomeDecorador[];
}

export class MontadorDecoradores {
  private readonly construtores: Readonly<
    Record<NomeDecorador, (interno: RecomendacaoStrategy) => RecomendacaoStrategy>
  >;

  constructor(
    private readonly dependencias: DependenciasMontador,
    readonly padrao: readonly NomeDecorador[] = [],
  ) {
    const { cache, auditoria, relogio, logger } = dependencias;
    this.construtores = {
      cache: (interno) => new CacheDecorator(interno, cache),
      auditoria: (interno) => new AuditoriaDecorator(interno, auditoria, relogio, logger),
      compressao: (interno) => new CompressaoDecorator(interno),
    };
    this.garantirSemRepeticao(padrao);
  }

  montar(
    base: RecomendacaoStrategy,
    pilha: readonly NomeDecorador[] = this.padrao,
  ): RecomendacaoStrategy {
    this.garantirSemRepeticao(pilha);
    return pilha.reduce((interno, decorador) => this.construtores[decorador](interno), base);
  }

  paraProjeto(
    projeto: Projeto,
    { estrategia, decoradores = this.padrao }: PedidoEstrategia,
  ): RecomendacaoStrategy | string | undefined {
    if (decoradores.length === 0) {
      return estrategia;
    }
    return this.montar(this.baseDe(projeto, estrategia ?? projeto.estrategia), decoradores);
  }

  private baseDe(projeto: Projeto, nome: string): RecomendacaoStrategy {
    const { fabricas, estrategias } = this.dependencias;
    const recomendador = fabricas.para(projeto.tipoCaptacao).criarRecomendador();
    return nome === recomendador.nome ? recomendador : estrategias.obter(nome);
  }

  private garantirSemRepeticao(pilha: readonly NomeDecorador[]): void {
    if (new Set(pilha).size !== pilha.length) {
      throw new ErroAplicacao(
        'PARAMETROS_INVALIDOS',
        `A pilha de decoradores não pode repetir itens: ${pilha.join(', ')}.`,
      );
    }
  }
}
