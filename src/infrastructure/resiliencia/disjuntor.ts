import { relogioDoSistema, type Relogio } from '../../application/ports/relogio.js';

export type EstadoCircuito = 'FECHADO' | 'ABERTO' | 'MEIO_ABERTO';

export class ErroCircuitoAberto extends Error {
  constructor(nome: string) {
    super(`Circuito "${nome}" aberto: dependência indisponível, tentativa bloqueada.`);
    this.name = 'ErroCircuitoAberto';
  }
}

export class ErroTempoEsgotado extends Error {
  constructor(descricao: string, limiteMs: number) {
    super(`${descricao} excedeu ${limiteMs} ms.`);
    this.name = 'ErroTempoEsgotado';
  }
}

export async function comTempoLimite<T>(
  promessa: Promise<T>,
  limiteMs: number,
  descricao: string,
): Promise<T> {
  let temporizador: NodeJS.Timeout | undefined;
  const esgotado = new Promise<never>((_, rejeitar) => {
    temporizador = setTimeout(() => {
      rejeitar(new ErroTempoEsgotado(descricao, limiteMs));
    }, limiteMs);
  });
  try {
    return await Promise.race([promessa, esgotado]);
  } finally {
    clearTimeout(temporizador);
  }
}

export interface OpcoesDisjuntor {
  readonly nome: string;
  readonly limiteFalhas: number;
  readonly esperaMs: number;
}

export class DisjuntorCircuito {
  private aberto = false;
  private falhasSeguidas = 0;
  private abertoEm = 0;

  constructor(
    private readonly opcoes: OpcoesDisjuntor,
    private readonly relogio: Relogio = relogioDoSistema,
  ) {}

  get estado(): EstadoCircuito {
    if (!this.aberto) {
      return 'FECHADO';
    }
    return this.relogio().getTime() - this.abertoEm >= this.opcoes.esperaMs
      ? 'MEIO_ABERTO'
      : 'ABERTO';
  }

  async executar<T>(acao: () => Promise<T>): Promise<T> {
    const estado = this.estado;
    if (estado === 'ABERTO') {
      throw new ErroCircuitoAberto(this.opcoes.nome);
    }
    try {
      const resultado = await acao();
      this.aberto = false;
      this.falhasSeguidas = 0;
      return resultado;
    } catch (erro) {
      this.falhasSeguidas += 1;
      if (estado === 'MEIO_ABERTO' || this.falhasSeguidas >= this.opcoes.limiteFalhas) {
        this.aberto = true;
        this.abertoEm = this.relogio().getTime();
      }
      throw erro;
    }
  }
}
