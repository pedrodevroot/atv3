import type { Equipe } from '../../../domain/entidades/equipe.js';
import type { Projeto } from '../../../domain/entidades/projeto.js';
import type {
  ProjetoAnimacao,
  TecnicaAnimacao,
} from '../../../domain/entidades/projetos/projeto-animacao.js';
import { Papel } from '../../../domain/enums/papel.js';
import { GeradorRelatorio } from '../../visitors/gerador-relatorio.js';
import { formatarMoeda } from '../../visitors/navegacao.js';

export const HORAS_RENDER_POR_QUADRO: Readonly<Record<TecnicaAnimacao, number>> = {
  '2D': 0.02,
  '3D': 0.25,
  STOP_MOTION: 0,
};

export interface MetricasRenderizacao {
  readonly quadros: number;
  readonly dias: number;
  readonly quadrosPorDia: number;
  readonly horasRender: number;
  readonly horasRenderPorDia: number;
}

export function calcularMetricasRenderizacao(projeto: ProjetoAnimacao): MetricasRenderizacao {
  const quadros = projeto.duracaoMinutos * 60 * projeto.quadrosPorSegundo;
  const dias = projeto.periodo.duracaoDias;
  const horasRender = quadros * HORAS_RENDER_POR_QUADRO[projeto.tecnica];
  return {
    quadros,
    dias,
    quadrosPorDia: Math.ceil(quadros / dias),
    horasRender,
    horasRenderPorDia: Math.round((horasRender / dias) * 10) / 10,
  };
}

const numero = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });
const fracao = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 });

export class GeradorRelatorioAnimacao extends GeradorRelatorio {
  private readonly metricas: MetricasRenderizacao;

  constructor(
    private readonly animacao: ProjetoAnimacao,
    geradoEm?: Date,
  ) {
    super(animacao, geradoEm);
    this.metricas = calcularMetricasRenderizacao(animacao);
  }

  override visitarProjeto(projeto: Projeto): string {
    const { quadros, dias, quadrosPorDia, horasRender, horasRenderPorDia } = this.metricas;
    return [
      super.visitarProjeto(projeto),
      '',
      '## Métricas de renderização',
      `- Técnica: ${this.animacao.tecnica} a ${this.animacao.quadrosPorSegundo} quadros/s; softwares: ${this.animacao.softwares.join(', ') || '-'}`,
      `- Quadros a produzir: ${numero.format(quadros)}`,
      `- Ritmo necessário: ${numero.format(quadrosPorDia)} quadros/dia em ${dias} dias`,
      `- Render estimado: ${numero.format(horasRender)} h (${fracao.format(HORAS_RENDER_POR_QUADRO[this.animacao.tecnica])} h por quadro), ${numero.format(horasRenderPorDia)} h por dia`,
    ].join('\n');
  }

  override visitarEquipe(equipe: Equipe): string {
    const relatorio = super.visitarEquipe(equipe);
    const efeitos = equipe.membro(Papel.EFEITOS_VISUAIS);
    return efeitos
      ? `${relatorio}\nCusto de efeitos visuais por quadro: ${formatarMoeda(efeitos.custo / this.metricas.quadros)}`
      : relatorio;
  }
}
