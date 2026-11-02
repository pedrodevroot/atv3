import type { VerificadorDependencia } from '../ports/verificador-dependencia.js';

export type EstadoDependencia = 'disponivel' | 'indisponivel';

export interface RelatorioSaude {
  status: 'ok' | 'degradado';
  timestamp: string;
  dependencias: Record<string, EstadoDependencia>;
}

export class ConsultarSaude {
  constructor(
    private readonly verificadores: readonly VerificadorDependencia[],
    private readonly relogio: () => Date = () => new Date(),
  ) {}

  async executar(): Promise<RelatorioSaude> {
    const resultados = await Promise.all(
      this.verificadores.map(async (verificador) => {
        const disponivel = await verificador.verificar().catch(() => false);
        const estado: EstadoDependencia = disponivel ? 'disponivel' : 'indisponivel';
        return [verificador.nome, estado] as const;
      }),
    );
    const dependencias = Object.fromEntries(resultados);
    const todasDisponiveis = resultados.every(([, estado]) => estado === 'disponivel');

    return {
      status: todasDisponiveis ? 'ok' : 'degradado',
      timestamp: this.relogio().toISOString(),
      dependencias,
    };
  }
}
