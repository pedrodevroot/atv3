export const StatusEquipe = {
  SUGERIDA: 'SUGERIDA',
  EM_FORMACAO: 'EM_FORMACAO',
  FORMADA: 'FORMADA',
  DESCARTADA: 'DESCARTADA',
} as const;

export type StatusEquipe = (typeof StatusEquipe)[keyof typeof StatusEquipe];

export const StatusMembro = {
  SUGERIDO: 'SUGERIDO',
  CONVIDADO: 'CONVIDADO',
  CONFIRMADO: 'CONFIRMADO',
  RECUSADO: 'RECUSADO',
} as const;

export type StatusMembro = (typeof StatusMembro)[keyof typeof StatusMembro];

export const StatusConvite = {
  PENDENTE: 'PENDENTE',
  ACEITO: 'ACEITO',
  RECUSADO: 'RECUSADO',
  EXPIRADO: 'EXPIRADO',
  CANCELADO: 'CANCELADO',
} as const;

export type StatusConvite = (typeof StatusConvite)[keyof typeof StatusConvite];
