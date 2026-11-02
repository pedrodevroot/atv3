import Type, { type Static } from 'typebox';

export const RespostaErro = Type.Object(
  {
    codigo: Type.String(),
    mensagem: Type.String(),
    detalhes: Type.Optional(Type.Array(Type.String())),
  },
  { $id: 'RespostaErro' },
);

export type RespostaErro = Static<typeof RespostaErro>;
