import { avaliarPrecisao } from '../../src/application/avaliacao/precisao.js';
import type { EstrategiaRecomendacao } from '../../src/application/strategies/estrategia-recomendacao.js';
import { resolverParametros } from '../../src/application/strategies/parametros-recomendacao.js';
import { criarRegistroEstrategias, criarRegistroFabricas } from '../../src/container.js';
import { gerarCadastroComQualidade } from '../../src/infrastructure/database/seeds/gerador-cadastro.js';
import { CaixaMensagensMemoria } from '../../src/infrastructure/notifications/canais-simulados.js';
import { gerarProjetosSinteticos } from '../fixtures/projetos-sinteticos.js';

const total = Number(process.env.PRECISAO_PROFISSIONAIS ?? 10_000);
const quantidadeProjetos = Number(process.env.PRECISAO_PROJETOS ?? 20);
const k = 5;

const registro = criarRegistroEstrategias();
const estrategia = (nome: string) => registro.obter(nome);
const fabricas = criarRegistroFabricas({ caixa: new CaixaMensagensMemoria() });
const recomendadorDoTipo: EstrategiaRecomendacao = {
  nome: 'recomendador-do-tipo',
  descricao: 'Usa o recomendador fabricado para o tipo de cada projeto (padrão da ATVII).',
  recomendar: (projeto, profissionais, parametros) =>
    fabricas
      .para(projeto.tipoCaptacao)
      .criarRecomendador()
      .recomendar(projeto, profissionais, parametros),
};
const aleatoria: EstrategiaRecomendacao = {
  nome: 'aleatoria',
  descricao: 'Linha de base: sorteia candidatos elegíveis.',
  recomendar: (projeto, profissionais, parametros) => {
    let semente = 99;
    const sortear = () => {
      semente = (semente * 1_103_515_245 + 12_345) % 2_147_483_648;
      return semente / 2_147_483_648;
    };
    return registro.obter('similaridade-cosseno').recomendar(
      projeto,
      [...profissionais].sort(() => sortear() - 0.5),
      {
        ...parametros,
        cosseno: {
          pesoSimilaridade: 0,
          pesoAderencia: 0,
          pesoExperiencia: 1,
          experienciaSaturacao: 1_000_000,
        },
      },
    );
  },
};

const inicio = performance.now();
const resultados = avaliarPrecisao({
  cadastro: gerarCadastroComQualidade(total, 2026),
  projetos: gerarProjetosSinteticos(quantidadeProjetos),
  k,
  fracaoRelevantes: 0.1,
  configuracoes: [
    {
      rotulo: 'linha de base (aleatória)',
      estrategia: aleatoria,
      parametros: resolverParametros(),
    },
    {
      rotulo: 'recomendador do tipo do projeto (padrão da ATVII)',
      estrategia: recomendadorDoTipo,
      parametros: resolverParametros(),
    },
    {
      rotulo: 'similaridade-cosseno (padrão)',
      estrategia: estrategia('similaridade-cosseno'),
      parametros: resolverParametros(),
    },
    {
      rotulo: 'similaridade-cosseno (só direção, versão original)',
      estrategia: estrategia('similaridade-cosseno'),
      parametros: resolverParametros({
        cosseno: { pesoSimilaridade: 1, pesoAderencia: 0, pesoExperiencia: 0 },
      }),
    },
    {
      rotulo: 'filtragem-colaborativa (padrão)',
      estrategia: estrategia('filtragem-colaborativa'),
      parametros: resolverParametros(),
    },
    {
      rotulo: 'filtragem-colaborativa (priori fraca)',
      estrategia: estrategia('filtragem-colaborativa'),
      parametros: resolverParametros({ colaborativa: { pesoPriori: 1 } }),
    },
    {
      rotulo: 'regras-orcamento (padrão)',
      estrategia: estrategia('regras-orcamento'),
      parametros: resolverParametros(),
    },
    {
      rotulo: 'regras-orcamento (prioriza nota)',
      estrategia: estrategia('regras-orcamento'),
      parametros: resolverParametros({
        orcamento: { pesoEconomia: 0.2, pesoNota: 0.7, pesoProximidade: 0.1 },
      }),
    },
  ],
});

console.table(
  resultados.map((resultado) => ({
    configuracao: resultado.rotulo,
    [`precision@${k}`]: resultado.precisao.toFixed(3),
    amostras: resultado.amostras,
  })),
);
console.info(
  `${total} profissionais, ${quantidadeProjetos} projetos x 6 papéis, relevantes = 10% mais qualificados entre os elegíveis; ${Math.round(performance.now() - inicio)} ms`,
);
