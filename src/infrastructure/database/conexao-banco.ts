import type { DataSource } from 'typeorm';

export interface OpcoesReconexao {
  readonly intervaloMs?: number;
  readonly aoConectar?: () => Promise<boolean>;
  readonly aoFalhar?: (erro: unknown) => void;
}

export class ConexaoBanco {
  private conectando: Promise<void> | undefined;
  private agendamento: NodeJS.Timeout | undefined;
  private parada = false;

  constructor(private readonly dataSource: DataSource) {}

  get conectada(): boolean {
    return this.dataSource.isInitialized;
  }

  garantir(): Promise<void> {
    if (this.dataSource.isInitialized) {
      return Promise.resolve();
    }
    this.conectando ??= this.dataSource
      .initialize()
      .then(() => undefined)
      .finally(() => {
        this.conectando = undefined;
      });
    return this.conectando;
  }

  reconectarEmSegundoPlano(opcoes: OpcoesReconexao = {}): void {
    const { intervaloMs = 2_000, aoConectar = () => Promise.resolve(true), aoFalhar } = opcoes;
    const tentar = async (): Promise<void> => {
      this.agendamento = undefined;
      if (this.parada) {
        return;
      }
      try {
        await this.garantir();
        if (await aoConectar()) {
          return;
        }
      } catch (erro) {
        aoFalhar?.(erro);
      }
      this.agendar(tentar, intervaloMs);
    };
    this.agendar(tentar, intervaloMs);
  }

  parar(): void {
    this.parada = true;
    clearTimeout(this.agendamento);
    this.agendamento = undefined;
  }

  private agendar(tentar: () => Promise<void>, intervaloMs: number): void {
    if (this.parada) {
      return;
    }
    this.agendamento = setTimeout(() => void tentar(), intervaloMs);
    this.agendamento.unref();
  }
}
