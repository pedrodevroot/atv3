import { Faker, base, pt_BR } from '@faker-js/faker';
import { AJUSTES_PERFIL_ANIMACAO } from '../../../application/familias/animacao/recomendador-animacao.js';
import { AJUSTES_PERFIL_DOCUMENTARIO } from '../../../application/familias/documentario/recomendador-documentario.js';
import { AJUSTES_PERFIL_FICCAO } from '../../../application/familias/ficcao/recomendador-ficcao.js';
import { AJUSTES_PERFIL_PUBLICITARIO } from '../../../application/familias/publicitario/recomendador-publicitario.js';
import { PERFIS_BASE } from '../../../application/strategies/catalogo-perfis.js';
import { Avaliacao } from '../../../domain/entidades/avaliacao.js';
import { Competencia } from '../../../domain/entidades/competencia.js';
import { ParticipacaoProjeto } from '../../../domain/entidades/participacao-projeto.js';
import { Profissional } from '../../../domain/entidades/profissional.js';
import { PAPEIS, type Papel } from '../../../domain/enums/papel.js';
import { TIPOS_CAPTACAO } from '../../../domain/enums/tipo-captacao.js';
import { FaixaPreco } from '../../../domain/value-objects/faixa-preco.js';
import { Intervalo } from '../../../domain/value-objects/intervalo.js';
import { Localizacao } from '../../../domain/value-objects/localizacao.js';

const CIDADES = [
  { cidade: 'São Paulo', uf: 'SP', latitude: -23.5505, longitude: -46.6333 },
  { cidade: 'Rio de Janeiro', uf: 'RJ', latitude: -22.9068, longitude: -43.1729 },
  { cidade: 'Belo Horizonte', uf: 'MG', latitude: -19.9167, longitude: -43.9345 },
  { cidade: 'Porto Alegre', uf: 'RS', latitude: -30.0346, longitude: -51.2177 },
  { cidade: 'Salvador', uf: 'BA', latitude: -12.9777, longitude: -38.5016 },
  { cidade: 'Recife', uf: 'PE', latitude: -8.0476, longitude: -34.877 },
  { cidade: 'Fortaleza', uf: 'CE', latitude: -3.7319, longitude: -38.5267 },
  { cidade: 'Curitiba', uf: 'PR', latitude: -25.4284, longitude: -49.2733 },
  { cidade: 'Brasília', uf: 'DF', latitude: -15.7939, longitude: -47.8828 },
  { cidade: 'Manaus', uf: 'AM', latitude: -3.119, longitude: -60.0217 },
  { cidade: 'Belém', uf: 'PA', latitude: -1.4558, longitude: -48.4902 },
  { cidade: 'Florianópolis', uf: 'SC', latitude: -27.5954, longitude: -48.548 },
  { cidade: 'Goiânia', uf: 'GO', latitude: -16.6869, longitude: -49.2648 },
  { cidade: 'São José dos Campos', uf: 'SP', latitude: -23.1896, longitude: -45.8841 },
  { cidade: 'Campinas', uf: 'SP', latitude: -22.9099, longitude: -47.0626 },
] as const;

const GENEROS = [
  'drama',
  'comédia',
  'suspense',
  'terror',
  'romance',
  'ficção científica',
  'social',
  'biografia',
  'musical',
  'infantil',
];

const PRECO_POR_PAPEL: Record<Papel, readonly [number, number]> = {
  DIRETOR: [15_000, 80_000],
  DIRETOR_FOTOGRAFIA: [10_000, 50_000],
  SONOPLASTA: [4_000, 25_000],
  EDITOR: [6_000, 35_000],
  ROTEIRISTA: [8_000, 40_000],
  EFEITOS_VISUAIS: [8_000, 45_000],
};

const INICIO_AGENDA = new Date('2026-09-01T00:00:00.000Z');
const FIM_AGENDA = new Date('2027-12-31T00:00:00.000Z');

const AJUSTES_DAS_FAMILIAS = [
  AJUSTES_PERFIL_DOCUMENTARIO,
  AJUSTES_PERFIL_ANIMACAO,
  AJUSTES_PERFIL_FICCAO,
  AJUSTES_PERFIL_PUBLICITARIO,
];

function competenciasDoPapel(papel: Papel): string[] {
  const doTipo = AJUSTES_DAS_FAMILIAS.flatMap((ajustes) => Object.keys(ajustes[papel] ?? {}));
  return [...new Set([...Object.keys(PERFIS_BASE[papel]), ...doTipo])];
}

const TODAS_COMPETENCIAS = [...new Set(PAPEIS.flatMap(competenciasDoPapel))];

export interface ProfissionalGerado {
  readonly profissional: Profissional;
  readonly qualidade: number;
}

export function gerarCadastroProfissionais(total: number, semente = 2026): Profissional[] {
  return gerarCadastroComQualidade(total, semente).map((gerado) => gerado.profissional);
}

export function gerarCadastroComQualidade(total: number, semente = 2026): ProfissionalGerado[] {
  const faker = new Faker({ locale: [pt_BR, base] });
  faker.seed(semente);
  const inteiro = (min: number, max: number) => faker.number.int({ min, max });
  const nivel = (qualidade: number) =>
    Math.min(5, Math.max(1, Math.round(qualidade * 5 + faker.number.float({ min: -1, max: 1 }))));

  return Array.from({ length: total }, (_, indice) => {
    const papel = PAPEIS[indice % PAPEIS.length] ?? 'DIRETOR';
    const especialidades: Papel[] = faker.datatype.boolean({ probability: 0.2 })
      ? [papel, faker.helpers.arrayElement(PAPEIS.filter((outro) => outro !== papel))]
      : [papel];
    const qualidade = faker.number.float({ min: 0.2, max: 1 });
    const cidade = faker.helpers.arrayElement(CIDADES);
    const [precoBase, precoTeto] = PRECO_POR_PAPEL[papel];
    const minimo = Math.round(inteiro(precoBase, precoTeto * 0.7) / 100) * 100;
    const maximo = Math.round((minimo * faker.number.float({ min: 1.1, max: 1.6 })) / 100) * 100;

    const profissional = Profissional.criar({
      id: faker.string.uuid(),
      nome: faker.person.fullName(),
      especialidades,
      competencias: [
        ...faker.helpers
          .arrayElements(competenciasDoPapel(papel), { min: 3, max: 5 })
          .map((nome) => Competencia.criar(nome, nivel(qualidade))),
        ...faker.helpers
          .arrayElements(TODAS_COMPETENCIAS, { min: 0, max: 2 })
          .map((nome) => Competencia.criar(nome, inteiro(1, 3))),
      ],
      avaliacoes: Array.from({ length: inteiro(0, 12) }, () =>
        Avaliacao.criar({
          id: faker.string.uuid(),
          nota: Math.min(
            5,
            Math.max(1, Math.round(1 + qualidade * 4 + faker.number.float({ min: -1.5, max: 1 }))),
          ),
          comentario: faker.helpers.arrayElement([
            '',
            'Pontual e criativo.',
            'Ótima entrega.',
            'Precisou de ajustes.',
          ]),
          data: faker.date.between({ from: '2019-01-01', to: '2026-08-31' }),
          produtorId: `produtor-${inteiro(1, 300)}`,
          projetoId: faker.string.uuid(),
          papel: faker.helpers.arrayElement(especialidades),
          genero: faker.helpers.arrayElement(GENEROS),
          tipoCaptacao: faker.helpers.arrayElement(TIPOS_CAPTACAO),
        }),
      ),
      historico: Array.from({ length: inteiro(0, 10) }, () =>
        ParticipacaoProjeto.criar({
          projetoId: faker.string.uuid(),
          titulo: faker.lorem.words({ min: 2, max: 4 }),
          papel: faker.helpers.arrayElement(especialidades),
          genero: faker.helpers.arrayElement(GENEROS),
          tipoCaptacao: faker.helpers.arrayElement(TIPOS_CAPTACAO),
          ano: inteiro(2010, 2026),
        }),
      ),
      faixaPreco: FaixaPreco.criar(minimo, Math.max(minimo, maximo)),
      disponibilidades: gerarAgenda(faker),
      localizacao: Localizacao.criar({
        cidade: cidade.cidade,
        uf: cidade.uf,
        latitude: cidade.latitude + faker.number.float({ min: -0.05, max: 0.05 }),
        longitude: cidade.longitude + faker.number.float({ min: -0.05, max: 0.05 }),
      }),
      ativo: faker.datatype.boolean({ probability: 0.95 }),
    });
    return { profissional, qualidade };
  });
}

function gerarAgenda(faker: Faker): Intervalo[] {
  if (faker.datatype.boolean({ probability: 0.75 })) {
    return [Intervalo.criar(INICIO_AGENDA, FIM_AGENDA)];
  }
  const inicioLacuna = faker.date.between({ from: INICIO_AGENDA, to: '2027-06-30' });
  const fimLacuna = new Date(
    inicioLacuna.getTime() + faker.number.int({ min: 15, max: 120 }) * 86_400_000,
  );
  return [Intervalo.criar(INICIO_AGENDA, inicioLacuna), Intervalo.criar(fimLacuna, FIM_AGENDA)];
}
