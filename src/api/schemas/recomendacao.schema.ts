import Type, { type Static, type TSchema } from 'typebox';
import { NOMES_DECORADORES } from '../../application/strategies/decoradores/montador-decoradores.js';
import { DURACAO_MAXIMA_MINUTOS, ORCAMENTO_MAXIMO } from '../../domain/entidades/projeto.js';
import { PESO_MAXIMO } from '../../domain/entidades/requisito-papel.js';
import { PAPEIS } from '../../domain/enums/papel.js';
import { TIPOS_CAPTACAO } from '../../domain/enums/tipo-captacao.js';

const Id = Type.String({ minLength: 1, maxLength: 64 });
const DataHora = Type.String({ format: 'date-time' });
const Texto = (maximo: number) => Type.String({ minLength: 1, maxLength: maximo });
const NaoNegativo = Type.Number({ minimum: 0 });
const Orcamento = Type.Number({ exclusiveMinimum: 0, maximum: ORCAMENTO_MAXIMO });
const DuracaoMinutos = Type.Integer({ minimum: 1, maximum: DURACAO_MAXIMA_MINUTOS });

export const PapelSchema = Type.Enum([...PAPEIS]);
export const TipoCaptacaoSchema = Type.Enum([...TIPOS_CAPTACAO]);
export const DetalhesSchema = Type.Record(Type.String(), Type.Unknown(), { maxProperties: 20 });

const LocalizacaoSchema = Type.Object({
  cidade: Texto(120),
  uf: Type.String({ pattern: '^[A-Za-z]{2}$' }),
  latitude: Type.Number({ minimum: -90, maximum: 90 }),
  longitude: Type.Number({ minimum: -180, maximum: 180 }),
});

const RequisitosSchema = Type.Array(
  Type.Object({ papel: PapelSchema, peso: Type.Number({ exclusiveMinimum: 0, maximum: 10 }) }),
  { minItems: 1, maxItems: 6 },
);

const PROFUNDIDADE_MAXIMA_SERVICOS = 6;
const SUBSERVICOS_POR_PACOTE = 50;
const PRAZO_MAXIMO_SERVICO_DIAS = 36_500;

const ServicoAtomicoSchema = Type.Object(
  {
    nome: Texto(200),
    papel: PapelSchema,
    custo: Type.Number({ minimum: 0, maximum: ORCAMENTO_MAXIMO }),
    prazoDias: Type.Integer({ minimum: 0, maximum: PRAZO_MAXIMO_SERVICO_DIAS }),
    peso: Type.Optional(Type.Number({ exclusiveMinimum: 0, maximum: PESO_MAXIMO })),
  },
  { additionalProperties: false },
);

function pacoteComNiveis(niveis: number): TSchema {
  const subservico =
    niveis <= 1
      ? ServicoAtomicoSchema
      : Type.Union([ServicoAtomicoSchema, pacoteComNiveis(niveis - 1)]);
  return Type.Object(
    {
      nome: Texto(200),
      subservicos: Type.Array(subservico, { minItems: 1, maxItems: SUBSERVICOS_POR_PACOTE }),
    },
    { additionalProperties: false },
  );
}

export const ServicoSchema = Type.Union([
  ServicoAtomicoSchema,
  pacoteComNiveis(PROFUNDIDADE_MAXIMA_SERVICOS),
]);

const DecoradoresSchema = Type.Array(Type.Enum([...NOMES_DECORADORES]), {
  maxItems: NOMES_DECORADORES.length,
  uniqueItems: true,
});

const grupoNumerico = (chaves: readonly string[]) =>
  Type.Optional(
    Type.Object(Object.fromEntries(chaves.map((chave) => [chave, Type.Optional(NaoNegativo)])), {
      additionalProperties: false,
    }),
  );

export const ParametrosSchema = Type.Object(
  {
    topN: Type.Optional(Type.Integer({ minimum: 1, maximum: 100 })),
    folgaTetoPapel: Type.Optional(NaoNegativo),
    cosseno: grupoNumerico([
      'pesoSimilaridade',
      'pesoAderencia',
      'pesoExperiencia',
      'experienciaSaturacao',
    ]),
    colaborativa: grupoNumerico([
      'mediaPriori',
      'pesoPriori',
      'bonusMesmoGenero',
      'bonusMesmoTipo',
      'bonusMesmoPapel',
      'bonusMesmoProdutor',
    ]),
    orcamento: grupoNumerico([
      'folgaTeto',
      'pesoEconomia',
      'pesoNota',
      'pesoProximidade',
      'raioKm',
      'limiteOrcamentoReduzido',
    ]),
    orquestracao: grupoNumerico(['numeroSugestoes', 'scoreMinimo', 'custoMinimoPorPapel']),
  },
  { additionalProperties: false },
);

export const CorpoCriarProjeto = Type.Object(
  {
    titulo: Texto(200),
    produtorId: Id,
    genero: Texto(80),
    tipoCaptacao: TipoCaptacaoSchema,
    duracaoMinutos: DuracaoMinutos,
    orcamento: Orcamento,
    dataInicio: DataHora,
    dataEntrega: DataHora,
    localizacao: LocalizacaoSchema,
    requisitos: Type.Optional(RequisitosSchema),
    servicoPrincipal: Type.Optional(ServicoSchema),
    detalhes: Type.Optional(DetalhesSchema),
    estrategia: Type.Optional(Id),
    parametros: Type.Optional(ParametrosSchema),
    decoradores: Type.Optional(DecoradoresSchema),
  },
  { additionalProperties: false },
);

export const CorpoProjetoDeModelo = Type.Object(
  {
    titulo: Texto(200),
    produtorId: Id,
    dataInicio: DataHora,
    dataEntrega: DataHora,
    genero: Type.Optional(Texto(80)),
    duracaoMinutos: Type.Optional(DuracaoMinutos),
    orcamento: Type.Optional(Orcamento),
    localizacao: Type.Optional(LocalizacaoSchema),
    requisitos: Type.Optional(RequisitosSchema),
    servicoPrincipal: Type.Optional(ServicoSchema),
    detalhes: Type.Optional(DetalhesSchema),
    estrategia: Type.Optional(Id),
    parametros: Type.Optional(ParametrosSchema),
    decoradores: Type.Optional(DecoradoresSchema),
  },
  { additionalProperties: false },
);

export const CorpoDetalhes = Type.Object(
  { detalhes: DetalhesSchema },
  { additionalProperties: false },
);

export const CorpoRodada = Type.Object(
  {
    estrategia: Type.Optional(Id),
    parametros: Type.Optional(ParametrosSchema),
    decoradores: Type.Optional(DecoradoresSchema),
  },
  { additionalProperties: false },
);

export const CorpoReavaliacao = Type.Object(
  {
    orcamento: Type.Optional(Orcamento),
    dataEntrega: Type.Optional(DataHora),
    limiar: Type.Optional(Type.Number({ minimum: 0, maximum: 1 })),
  },
  { additionalProperties: false, minProperties: 1 },
);

export const CorpoSubstituicao = Type.Object(
  { estrategia: Type.Optional(Id), decoradores: Type.Optional(DecoradoresSchema) },
  { additionalProperties: false },
);

export const TAMANHO_MAXIMO_ARQUIVO_BASE64 = 14_000_000;

export const CorpoArquivo = Type.Object(
  {
    nome: Texto(200),
    tipoConteudo: Texto(120),
    conteudoBase64: Type.String({
      minLength: 1,
      maxLength: TAMANHO_MAXIMO_ARQUIVO_BASE64,
      pattern: '^[A-Za-z0-9+/]+={0,2}$',
    }),
  },
  { additionalProperties: false },
);

export const QueryArquivo = Type.Object({ id: Type.String({ minLength: 1, maxLength: 512 }) });

export const ArquivoResposta = Type.Object({ id: Type.String(), provedor: Type.String() });

export const ArquivosResposta = Type.Object({ arquivos: Type.Array(Type.String()) });

export const ConteudoArquivoResposta = Type.Object({
  id: Type.String(),
  conteudoBase64: Type.String(),
});

export const PagamentoResposta = Type.Object({
  id: Type.String(),
  projetoId: Type.String(),
  equipeId: Type.String(),
  papel: Type.String(),
  profissionalId: Type.String(),
  valor: Type.Number(),
  provedor: Type.String(),
  status: Type.String(),
  criadoEm: Type.String(),
});

export const CorpoRespostaConvite = Type.Object(
  { aceito: Type.Boolean() },
  { additionalProperties: false },
);

export const ParamsProjeto = Type.Object({ projetoId: Id });
export const ParamsPagamento = Type.Object({ projetoId: Id, pagamentoId: Id });
export const ParamsEquipe = Type.Object({ projetoId: Id, equipeId: Id });
export const ParamsMembro = Type.Object({ projetoId: Id, equipeId: Id, papel: PapelSchema });
export const ParamsConvite = Type.Object({ conviteId: Id });
export const ParamsModelo = Type.Object({ modeloId: Id });
export const ParamsDestinatario = Type.Object({ destinatarioId: Id });

export const MembroResposta = Type.Object({
  papel: Type.String(),
  status: Type.String(),
  custo: Type.Number(),
  score: Type.Number(),
  profissional: Type.Object({
    id: Type.String(),
    nome: Type.String(),
    cidade: Type.String(),
    uf: Type.String(),
    notaMedia: Type.Number(),
    totalAvaliacoes: Type.Integer(),
  }),
});

export const EquipeResposta = Type.Object({
  id: Type.String(),
  status: Type.String(),
  rodada: Type.Integer(),
  estrategia: Type.String(),
  custoTotal: Type.Number(),
  membros: Type.Array(MembroResposta),
});

export const ProjetoResposta = Type.Object({
  id: Type.String(),
  titulo: Type.String(),
  produtorId: Type.String(),
  genero: Type.String(),
  tipoCaptacao: Type.String(),
  duracaoMinutos: Type.Integer(),
  orcamento: Type.Number(),
  dataInicio: Type.String(),
  dataEntrega: Type.String(),
  localizacao: Type.Object({ cidade: Type.String(), uf: Type.String() }),
  estrategia: Type.String(),
  requisitos: Type.Array(Type.Object({ papel: Type.String(), peso: Type.Number() })),
  servicoPrincipal: DetalhesSchema,
  custoTotalServicos: Type.Number(),
  prazoTotalDias: Type.Integer(),
  detalhes: DetalhesSchema,
  equipes: Type.Array(EquipeResposta),
  equipeFormadaId: Type.Optional(Type.String()),
});

export const ModelosResposta = Type.Array(
  Type.Object({
    id: Type.String(),
    nome: Type.String(),
    descricao: Type.String(),
    tipoCaptacao: Type.String(),
    genero: Type.String(),
    duracaoMinutos: Type.Integer(),
    orcamento: Type.Number(),
    duracaoDias: Type.Integer(),
    estrategia: Type.String(),
    requisitos: Type.Array(Type.Object({ papel: Type.String(), peso: Type.Number() })),
    servicoPrincipal: DetalhesSchema,
    custoTotalServicos: Type.Number(),
    prazoTotalDias: Type.Integer(),
    detalhes: DetalhesSchema,
  }),
);

export const TiposProjetoResposta = Type.Array(
  Type.Object({
    tipo: Type.String(),
    descricao: Type.String(),
    recomendador: Type.Object({ nome: Type.String(), descricao: Type.String() }),
  }),
);

const CandidatoResposta = Type.Object({
  profissionalId: Type.String(),
  nome: Type.String(),
  score: Type.Number(),
  custoEstimado: Type.Number(),
  justificativa: Type.String(),
});

const InformacoesRodada = {
  rodada: Type.Integer(),
  estrategia: Type.String(),
  parcial: Type.Boolean(),
  avisos: Type.Array(Type.String()),
  papeisSemCandidatos: Type.Array(Type.String()),
  ranking: Type.Record(Type.String(), Type.Array(CandidatoResposta)),
};

export const RodadaResposta = Type.Object({ projeto: ProjetoResposta, ...InformacoesRodada });

export const ReavaliacaoResposta = Type.Object({
  projeto: ProjetoResposta,
  reavaliacao: Type.Object({
    significativa: Type.Boolean(),
    variacaoOrcamento: Type.Number(),
    variacaoPrazoDias: Type.Number(),
  }),
  novaRodada: Type.Optional(Type.Object(InformacoesRodada)),
});

export const ConviteResposta = Type.Object({
  id: Type.String(),
  projetoId: Type.String(),
  equipeId: Type.String(),
  papel: Type.String(),
  profissionalId: Type.String(),
  status: Type.String(),
  criadoEm: Type.String(),
  expiraEm: Type.String(),
  respondidoEm: Type.Optional(Type.String()),
});

export const AceiteResposta = Type.Object({ projeto: ProjetoResposta, convite: ConviteResposta });

export const AnaliseResposta = Type.Object({
  validacao: Type.Object({
    valido: Type.Boolean(),
    problemas: Type.Array(
      Type.Object({
        codigo: Type.String(),
        severidade: Type.String(),
        mensagem: Type.String(),
        equipeId: Type.Optional(Type.String()),
        papel: Type.Optional(Type.String()),
        profissionalId: Type.Optional(Type.String()),
      }),
    ),
  }),
  compatibilidade: Type.Number(),
  relatorio: Type.String(),
});

export const EstrategiasResposta = Type.Array(
  Type.Object({ nome: Type.String(), descricao: Type.String() }),
);

export const RecomendacoesResposta = Type.Array(
  Type.Object({
    id: Type.String(),
    papel: Type.String(),
    profissionalId: Type.String(),
    score: Type.Number(),
    posicao: Type.Integer(),
    estrategia: Type.String(),
    rodada: Type.Integer(),
    justificativa: Type.String(),
    criadaEm: Type.String(),
  }),
);

export const AuditoriaResposta = Type.Array(
  Type.Object({
    eventoId: Type.String(),
    tipo: Type.String(),
    ocorridoEm: Type.String(),
    origem: Type.String(),
    correlacaoId: Type.Optional(Type.String()),
    atorId: Type.String(),
    tipoAtor: Type.String(),
    dados: Type.Record(Type.String(), Type.Unknown()),
  }),
);

export const MensagensResposta = Type.Array(
  Type.Object({
    destinatarioId: Type.String(),
    tipoDestinatario: Type.String(),
    assunto: Type.String(),
    corpo: Type.String(),
    eventoId: Type.String(),
  }),
);

export type CorpoCriarProjeto = Static<typeof CorpoCriarProjeto>;
export type CorpoProjetoDeModelo = Static<typeof CorpoProjetoDeModelo>;
export type ParametrosEntrada = Static<typeof ParametrosSchema>;
