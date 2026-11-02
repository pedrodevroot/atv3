import type { DadosServico } from '../../src/domain/entidades/servicos/servico-projeto.js';
import { Papel } from '../../src/domain/enums/papel.js';

export function semRequisitos<T extends object>(dados: T): Omit<T, 'requisitos'> {
  return Object.fromEntries(
    Object.entries(dados).filter(([chave]) => chave !== 'requisitos'),
  ) as Omit<T, 'requisitos'>;
}

export const SERVICO_RASO: DadosServico = {
  nome: 'Edição de vídeo',
  papel: Papel.EDITOR,
  custo: 8_000,
  prazoDias: 10,
  peso: 4,
};

export const SERVICO_DOIS_NIVEIS: DadosServico = {
  nome: 'Pós-produção',
  subservicos: [
    { nome: 'Edição', papel: Papel.EDITOR, custo: 8_000, prazoDias: 10, peso: 4 },
    { nome: 'Mixagem de áudio', papel: Papel.SONOPLASTA, custo: 3_000.5, prazoDias: 5, peso: 2 },
  ],
};

export const SERVICO_QUATRO_NIVEIS: DadosServico = {
  nome: 'Produção completa',
  subservicos: [
    { nome: 'Direção', papel: Papel.DIRETOR, custo: 20_000, prazoDias: 15, peso: 5 },
    {
      nome: 'Pós-produção',
      subservicos: [
        {
          nome: 'Imagem',
          subservicos: [
            {
              nome: 'Finalização',
              subservicos: [
                { nome: 'Coloração', papel: Papel.EDITOR, custo: 4_000, prazoDias: 4, peso: 2 },
                { nome: 'Efeitos', papel: Papel.EFEITOS_VISUAIS, custo: 6_000, prazoDias: 6 },
              ],
            },
            { nome: 'Edição', papel: Papel.EDITOR, custo: 9_000, prazoDias: 10, peso: 4 },
          ],
        },
        { nome: 'Mixagem de áudio', papel: Papel.SONOPLASTA, custo: 3_000, prazoDias: 5, peso: 3 },
      ],
    },
  ],
};

export const TOTAIS_QUATRO_NIVEIS = { custo: 42_000, prazo: 40 };
