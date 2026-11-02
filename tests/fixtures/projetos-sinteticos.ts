import type { Projeto } from '../../src/domain/entidades/projeto.js';
import { RequisitoPapel } from '../../src/domain/entidades/requisito-papel.js';
import { PAPEIS } from '../../src/domain/enums/papel.js';
import { TIPOS_CAPTACAO } from '../../src/domain/enums/tipo-captacao.js';
import { Localizacao } from '../../src/domain/value-objects/localizacao.js';
import { DETALHES_PADRAO, fabricasTeste } from './fabricas.js';

const GENEROS = ['drama', 'comédia', 'suspense', 'social', 'infantil', 'biografia'];
const CIDADES = [
  { cidade: 'São Paulo', uf: 'SP', latitude: -23.5505, longitude: -46.6333 },
  { cidade: 'Rio de Janeiro', uf: 'RJ', latitude: -22.9068, longitude: -43.1729 },
  { cidade: 'Recife', uf: 'PE', latitude: -8.0476, longitude: -34.877 },
  { cidade: 'Porto Alegre', uf: 'RS', latitude: -30.0346, longitude: -51.2177 },
];

export function gerarProjetosSinteticos(total: number, semente = 7): Projeto[] {
  let estado = semente;
  const aleatorio = () => {
    estado = (estado * 1_103_515_245 + 12_345) % 2_147_483_648;
    return estado / 2_147_483_648;
  };
  const escolher = <T>(itens: readonly T[]): T =>
    itens[Math.floor(aleatorio() * itens.length)] as T;

  return Array.from({ length: total }, (_, indice) => {
    const produtorId = `produtor-${1 + Math.floor(aleatorio() * 300)}`;
    const genero = escolher(GENEROS);
    const tipoCaptacao = escolher(TIPOS_CAPTACAO);
    return fabricasTeste.para(tipoCaptacao).criarProjeto({
      id: `projeto-sintetico-${indice}`,
      titulo: `Projeto ${indice}`,
      produtorId,
      genero,
      detalhes: DETALHES_PADRAO[tipoCaptacao],
      duracaoMinutos: 20 + Math.floor(aleatorio() * 100),
      orcamento: 80_000 + Math.floor(aleatorio() * 320_000),
      dataInicio: new Date('2026-10-01T00:00:00.000Z'),
      dataEntrega: new Date('2027-02-28T00:00:00.000Z'),
      localizacao: Localizacao.criar(escolher(CIDADES)),
      requisitos: PAPEIS.map((papel) =>
        RequisitoPapel.criar(papel, 1 + Math.floor(aleatorio() * 10)),
      ),
      estrategia: 'similaridade-cosseno',
    });
  });
}
