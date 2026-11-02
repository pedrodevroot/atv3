import type { CaixaMensagens } from '../../src/application/ports/canais-saida.js';
import { criarRegistroFabricas } from '../../src/container.js';
import type { DetalhesProjeto } from '../../src/domain/entidades/projeto.js';
import { TipoCaptacao } from '../../src/domain/enums/tipo-captacao.js';
import { CaixaMensagensMemoria } from '../../src/infrastructure/notifications/canais-simulados.js';

export const DETALHES_PADRAO: Readonly<Record<TipoCaptacao, DetalhesProjeto>> = {
  [TipoCaptacao.DOCUMENTARIO]: { tema: 'Memória do sertão', entrevistados: ['Dona Zefa'] },
  [TipoCaptacao.ANIMACAO]: { tecnica: '3D', softwares: ['Blender'], quadrosPorSegundo: 24 },
  [TipoCaptacao.PUBLICITARIO]: { marca: 'Café Serrano', veiculacao: ['DIGITAL'], pecas: 2 },
  [TipoCaptacao.FICCAO]: {},
};

export function criarFabricas(caixa: CaixaMensagens = new CaixaMensagensMemoria()) {
  return criarRegistroFabricas({ caixa });
}

export const fabricasTeste = criarFabricas();

export const fabricaFiccao = fabricasTeste.para(TipoCaptacao.FICCAO);
