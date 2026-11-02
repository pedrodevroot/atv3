import { Competencia } from '../../src/domain/entidades/competencia.js';
import type { Profissional } from '../../src/domain/entidades/profissional.js';
import { PAPEIS } from '../../src/domain/enums/papel.js';
import { FaixaPreco } from '../../src/domain/value-objects/faixa-preco.js';
import { criarAvaliacao, criarProfissional } from './dominio.js';

const COMPETENCIAS = [
  'direção de atores',
  'decupagem',
  'liderança',
  'roteiro',
  'fotografia',
  'iluminação',
  'montagem',
  'mixagem',
  'captação de som',
  'composição digital',
];

export function gerarCadastroSintetico(total: number, semente = 42): Profissional[] {
  let estado = semente;
  const aleatorio = () => {
    estado = (estado * 1_103_515_245 + 12_345) % 2_147_483_648;
    return estado / 2_147_483_648;
  };
  const inteiro = (maximo: number) => Math.floor(aleatorio() * maximo);

  return Array.from({ length: total }, (_, indice) => {
    const papel = PAPEIS[indice % PAPEIS.length] ?? 'DIRETOR';
    const minimo = 2_000 + inteiro(40_000);
    return criarProfissional({
      id: `prof-${indice}`,
      especialidades: [papel],
      competencias: Array.from({ length: 4 }, () =>
        Competencia.criar(COMPETENCIAS[inteiro(COMPETENCIAS.length)] ?? 'roteiro', 1 + inteiro(5)),
      ),
      avaliacoes: Array.from({ length: inteiro(8) }, () =>
        criarAvaliacao({ nota: 1 + inteiro(5), papel }),
      ),
      faixaPreco: FaixaPreco.criar(minimo, minimo + inteiro(20_000)),
    });
  });
}

export function medirMelhorTempo(repeticoes: number, acao: () => void): number {
  acao();
  let melhor = Number.POSITIVE_INFINITY;
  for (let rodada = 0; rodada < repeticoes; rodada += 1) {
    const inicio = performance.now();
    acao();
    melhor = Math.min(melhor, performance.now() - inicio);
  }
  return melhor;
}
