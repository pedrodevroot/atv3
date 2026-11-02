import Type, { type Static } from 'typebox';
import { DURACAO_MAXIMA_MINUTOS, ORCAMENTO_MAXIMO } from '../../domain/entidades/projeto.js';
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
    requisitos: RequisitosSchema,
    detalhes: Type.Optional(DetalhesSchema),
    estrategia: Type.Optional(Id),
    parametros: Type.Optional(ParametrosSchema),
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
    detalhes: Type.Optional(DetalhesSchema),
    estrategia: Type.Optional(Id),
    parametros: Type.Optional(ParametrosSchema),
  },
  { additionalProperties: false },
);

export const CorpoDetalhes = Type.Object(
  { detalhes: DetalhesSchema },
  { additionalProperties: false },
);

export const CorpoRodada = Type.Object(
  { estrategia: Type.Optional(Id), parametros: Type.Optional(ParametrosSchema) },
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
  { estrategia: Type.Optional(Id) },
  { additionalProperties: false },
);

export const CorpoRespostaConvite = Type.Object(
  { aceito: Type.Boolean() },
  { additionalProperties: false },
);

export const ParamsProjeto = Type.Object({ projetoId: Id });
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
