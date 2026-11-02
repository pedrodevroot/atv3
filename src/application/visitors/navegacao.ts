import type { Equipe } from '../../domain/entidades/equipe.js';
import type { Projeto } from '../../domain/entidades/projeto.js';

export function equipesRelevantes(projeto: Projeto): Equipe[] {
  const formada = projeto.equipeFormada;
  return formada ? [formada] : projeto.equipesAtivas;
}

const moeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export function formatarMoeda(valor: number): string {
  return moeda.format(valor).replace(/\s+/gu, ' ');
}

export function formatarData(data: Date): string {
  return data.toISOString().slice(0, 10);
}
