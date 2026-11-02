import type { MigrationInterface } from 'typeorm';
import { CriarEsquemaInicial1790540000000 } from './1790540000000-criar-esquema-inicial.js';
import { AdicionarOrdemEquipe1790550000000 } from './1790550000000-adicionar-ordem-equipe.js';
import { AdicionarDescartadosEquipe1790560000000 } from './1790560000000-adicionar-descartados-equipe.js';
import { AdicionarVersaoProjeto1790570000000 } from './1790570000000-adicionar-versao-projeto.js';
import { AdicionarDetalhesProjeto1790580000000 } from './1790580000000-adicionar-detalhes-projeto.js';

export const migracoes: (new () => MigrationInterface)[] = [
  CriarEsquemaInicial1790540000000,
  AdicionarOrdemEquipe1790550000000,
  AdicionarDescartadosEquipe1790560000000,
  AdicionarVersaoProjeto1790570000000,
  AdicionarDetalhesProjeto1790580000000,
];
