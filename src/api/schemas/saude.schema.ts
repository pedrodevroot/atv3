import Type from 'typebox';

const EstadoDependencia = Type.Union([Type.Literal('disponivel'), Type.Literal('indisponivel')]);

export const RespostaSaude = Type.Object({
  status: Type.Union([Type.Literal('ok'), Type.Literal('degradado')]),
  timestamp: Type.String({ format: 'date-time' }),
  dependencias: Type.Record(Type.String(), EstadoDependencia),
});
